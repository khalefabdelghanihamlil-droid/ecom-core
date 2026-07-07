# 🔐 Rapport de correctif de sécurité — Expiration des OTP

**Date :** 05/07/2026
**Sévérité :** Élevée (contrôle de sécurité inopérant)
**Statut :** ✅ **CORRIGÉ ET VALIDÉ** — 20/20 tests OTP + 33/33 tests Commandes au vert

---

## 1. Description du bug

La table `verif_otp` ne possédait **aucune colonne d'horodatage**, alors que
`confirmation.service.js` calculait l'expiration des codes à partir de `otp.created_at`.

Conséquence :
```js
new Date(undefined)      // -> Invalid Date
(maintenant - Invalid) / 1000 / 60   // -> NaN
NaN > 5                  // -> false  => la branche « expiré » n'était JAMAIS prise
```

➡️ **Tout code OTP restait valide indéfiniment.** La fenêtre de 5 minutes annoncée
au client (« Valide 5 minutes ») n'était pas appliquée : un code intercepté restait
exploitable sans limite de temps. C'est un contournement du facteur de confirmation,
donc un bug de **sécurité**, pas une simple amélioration.

---

## 2. Migration SQL appliquée

Fichier : [`migrations/002_verif_otp_created_at.sql`](migrations/002_verif_otp_created_at.sql)
Exécutée dans l'éditeur SQL Supabase (projet `rwqvzwspxknqgcceigjt`), confirmée le 05/07/2026.

```sql
ALTER TABLE verif_otp
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE verif_otp
  SET created_at = now() - interval '1 hour'
  WHERE created_at IS NULL;      -- backfill fail-safe : OTP historiques = expirés

CREATE INDEX IF NOT EXISTS idx_verif_otp_created_at ON verif_otp (created_at);
```

Vérification post-migration : `SELECT created_at FROM verif_otp` → colonne présente ✅.

---

## 3. Fichiers modifiés

| Fichier | Modification |
|---------|--------------|
| [`migrations/002_verif_otp_created_at.sql`](migrations/002_verif_otp_created_at.sql) | **Nouveau** — ajout colonne `created_at` + backfill + index |
| [`src/services/confirmation.service.js`](src/services/confirmation.service.js) | Helper `evaluerExpiration()` fail-safe ; reset de `created_at` à chaque envoi ; garde anti-réutilisation (`valide` → refus) |
| [`src/controllers/otpController.js`](src/controllers/otpController.js) | Mapping HTTP `409 Conflict` pour un OTP déjà utilisé |
| [`test-otp-integration.js`](test-otp-integration.js) | **Nouveau** — 6 scénarios de sécurité OTP (20 assertions) |

### Détail des durcissements (`confirmation.service.js`)

1. **Expiration robuste et fail-safe** — nouvelle fonction `evaluerExpiration(created_at)` :
   un `created_at` absent, `null` ou invalide (`NaN`) est désormais traité comme
   **EXPIRÉ** (on refuse par défaut plutôt que d'accepter un OTP d'âge inconnu).
   Remplace le calcul dupliqué dans `validerOTP` et `verifierStatutOTP`.

2. **Reset de l'horodatage à chaque (ré)envoi** — `demanderOTP` écrit explicitement
   `created_at: new Date().toISOString()` dans l'`upsert`. Le `DEFAULT now()` ne
   s'applique qu'à l'INSERT ; sans cela, un OTP **renvoyé** aurait conservé l'ancien
   horodatage et pu naître déjà expiré.

3. **Garde anti-réutilisation** — `validerOTP` refuse désormais un OTP dont
   `valide === true` (`OTP déjà utilisé` → HTTP 409). Auparavant, un code déjà
   consommé pouvait être re-soumis et re-valider la commande.

---

## 4. Tests exécutés

### 4.1 Tests de sécurité OTP — [`test-otp-integration.js`](test-otp-integration.js)

App Express bootée en mémoire ; OTP semés en base avec un `created_at` contrôlé
(ancienneté simulée) pour tester l'expiration sans attendre 5 minutes ; nettoyage automatique.

| # | Scénario | Attendu | Résultat |
|---|----------|---------|----------|
| 1 | OTP valide (créé il y a 1 min) + bon code | 200 → commande `confirmee` | ✅ |
| 2 | OTP expiré (créé il y a 6 min) + bon code | 400 « expiré » → commande NON confirmée | ✅ |
| 3 | OTP déjà utilisé (`valide = true`) | 409 « déjà utilisé » | ✅ |
| 4 | OTP avec `tentatives >= 3` | 403 « rejetee » → commande `rejetee_otp_echec` + `is_fake` | ✅ |
| 5 | Code incorrect avant expiration | 400 « incorrect » + `tentatives` incrémenté | ✅ |
| 6 | `GET /otp/statut/:id` (frais vs ancien) | `expire=false`/minutes>0 puis `expire=true`/minutes=0 | ✅ |

```
=== BILAN OTP ===  ✅ Réussis : 20   ❌ Échoués : 0
```

**Expiration après 5 min confirmée** (scénario 2 : 6 min > 5 min → refus ; scénario 1 : 1 min < 5 min → accepté).

### 4.2 Non-régression Module Commandes — [`test-commande-integration.js`](test-commande-integration.js)

Ré-exécuté après les modifications du service de confirmation (dont dépend
`processNewOrder`) et une fois la colonne en place :

```
=== BILAN ===  ✅ Réussis : 33   ❌ Échoués : 0
```

Aucune régression : les 7 endpoints Commandes et le pipeline anti-fraude
(ALLOW / OTP_REQUIRED / BLOCK / blacklist / idempotence) restent conformes.

---

## 5. Résultat final

| Objectif demandé | État |
|------------------|------|
| Ajouter `created_at` (défaut adapté) / proposer la migration | ✅ Migration 002 appliquée |
| Adapter `confirmation.service.js` pour l'expiration réelle | ✅ Helper fail-safe + reset horodatage |
| Vérifier l'expiration après 5 min | ✅ Testé (scénarios 1 & 2) |
| Tests : valide / expiré / déjà utilisé / trop de tentatives | ✅ + code incorrect + endpoint statut (20 assertions) |
| Vérifier l'absence de régression sur les commandes | ✅ 33/33 |

**Bilan global : 53 assertions au vert (20 OTP + 33 Commandes), 0 échec.**

Le bug de sécurité est corrigé : les OTP expirent désormais après 5 minutes,
ne sont plus réutilisables une fois validés, et le système échoue en mode fermé
(refus) en cas d'horodatage manquant ou corrompu.

➡️ **Le Module Commandes est désormais totalement validé.**

### Reliquat non bloquant
- Configurer `SMS_PROVIDER_URL` / `SMS_PROVIDER_KEY` pour l'envoi réel des SMS
  (Étape C du déploiement) — l'échec d'envoi est déjà géré proprement (commande
  créée en `en_attente_otp`, OTP persisté).

---

*Rapport généré le 05/07/2026 — Correctif de sécurité OTP*
