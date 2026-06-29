# 🎯 PROCHAINES ÉTAPES — De ton MVP actuel à la première vente

**Statut actuel :** Système backend anti-fraude opérationnel ✅  
**Date :** 28/06/2026

---

## ✅ Ce qui est TERMINÉ

### 1. Architecture & Base de données
- ✅ Supabase configuré avec 10 tables relationnelles
- ✅ Schéma complet : CLIENT, PRODUCT, COMMANDE, VERIF_OTP, LIVRAISON, FINANCE, CAMPAGNE, VISITE, ANALYSE_MARCHE, AUDIENCE, DEVICE_TRACKING
- ✅ Index de performance créés
- ✅ Connexion testée et validée

### 2. Code Backend (`server.js`)
- ✅ Pipeline anti-fraude en 5 couches :
  - Rate Limiter (3 commandes/10min par IP)
  - Honeypot (détection bots)
  - Validation données (téléphone DZ, email)
  - Scoring de risque (7 critères pondérés)
  - OTP conditionnel (uniquement si score ≥ 30)
- ✅ Webhook Shopify sécurisé (vérification HMAC)
- ✅ Endpoints OTP (envoi + vérification + brute-force protection)
- ✅ Idempotence (évite doublons via `shopify_order_id`)
- ✅ Blacklist automatique
- ✅ Device fingerprinting

### 3. Documentation
- ✅ Roadmap complète 14 niveaux (dans `Architecture_complete_ecommerce.md`)
- ✅ MCD et architecture Hub & Spoke
- ✅ System design (scalabilité, availability, reliability)

---

## 🔧 Ce qui reste à faire AVANT la première vente

### Étape A — Créer la boutique Shopify (1-2 jours)

**Actions :**
1. Créer un compte Shopify (essai gratuit 3 jours, puis ~$1/mois les 3 premiers mois)
2. Choisir un thème simple (Dawn gratuit recommandé)
3. Ajouter 1 produit de test avec :
   - Prix
   - Photos (minimum 2-3)
   - Description (utiliser les 10 leviers psychologiques : social proof, scarcity, etc.)
4. Configurer les **Apps Shopify nécessaires** :
   - **Checkout extensibility** (pour ajouter ton champ de vérification OTP)
   - Ou créer une **page de remerciement custom** avec formulaire OTP

**Ressources :**
- Docs Shopify : https://help.shopify.com/
- Thèmes gratuits : https://themes.shopify.com/themes?price=free

---

### Étape B — Connecter Shopify à ton backend (2-3 heures)

#### B1. Configurer le webhook Shopify → ton serveur

**Dans Shopify Admin :**
1. Settings → Notifications → Webhooks
2. Créer un webhook sur l'événement `orders/create`
3. URL de destination : `https://ton-domaine.ngrok.io/webhooks/shopify-order` (voir B2 pour ngrok)
4. Format : JSON
5. Copier le **Webhook signing secret** généré

**Dans ton `.env` :**
```
SHOPIFY_WEBHOOK_SECRET=colle_le_secret_ici
```

#### B2. Exposer ton serveur local (temporaire, pour tester)

Utilise **ngrok** (gratuit) pour créer une URL publique temporaire :

```bash
npm install -g ngrok
ngrok http 3000
```

Copie l'URL `https://xxxx.ngrok.io` et utilise-la dans Shopify webhook.

**Note :** Pour la production, tu devras déployer sur un vrai serveur (Railway, Render, ou VPS).

#### B3. Lancer ton serveur

```bash
cd C:\Users\DELL\Desktop\c++ test\WAD_Labs\ecom-core
node server.js
```

Le serveur doit afficher : `Webhook serveur actif sur le port 3000`

---

### Étape C — Configurer l'envoi SMS OTP (1 heure)

**Choisir un fournisseur SMS algérien :**

| Fournisseur | Avantages | Paiement |
|-------------|-----------|----------|
| **Africala** (recommandé) | Facturation DZD, connexions directes Mobilis/Djezzy/Ooredoo, support Alger | Carte ou virement DZD |
| Twilio | International, documentation excellente | Carte internationale USD |
| EasySendSMS | Pas d'engagement, crédits à l'usage | USD |

**Après inscription, récupère :**
- URL de l'API SMS
- Clé d'authentification (token/API key)

**Dans ton `.env` :**
```
SMS_PROVIDER_URL=https://api.ton-fournisseur.com/sms
SMS_PROVIDER_KEY=ta_cle_api_ici
```

**Dans `server.js`, la fonction `envoyerSMS()` est déjà prête** — il suffit d'adapter l'URL/headers selon la doc de ton fournisseur.

---

### Étape D — Créer la page de vérification OTP côté client (2-3 heures)

Deux options :

#### Option 1 — Page Shopify personnalisée (plus simple)

Créer une page Liquid custom affichée après la commande :

```html
<!-- templates/page.verification-otp.liquid -->
<h2>Confirmez votre commande</h2>
<p>Un code a été envoyé au {{ order.phone }}</p>
<form id="otp-form">
  <input type="text" id="code" maxlength="6" placeholder="Code à 6 chiffres">
  <button type="submit">Valider</button>
</form>

<script>
document.getElementById('otp-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = document.getElementById('code').value;
  const response = await fetch('https://ton-domaine.ngrok.io/otp/verifier', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      commande_id: '{{ order.id }}', 
      code_saisi: code 
    })
  });
  const result = await response.text();
  alert(result);
});
</script>
```

#### Option 2 — App Shopify custom (plus avancé, contrôle total)

Créer une vraie app Shopify avec checkout extensibility — nécessite un compte Shopify Partners (gratuit).

**Ressources :**
- Checkout UI extensions : https://shopify.dev/docs/api/checkout-ui-extensions

---

### Étape E — Connecter un transporteur (Yalidine ou ZR Express)

**Après qu'une commande soit validée (OTP confirmé), elle doit être envoyée au transporteur.**

#### E1. Créer un compte transporteur

- **Yalidine** : https://yalidine.app/
- **ZR Express** : https://zrexpress.dz/

Récupère :
- Clé API
- Documentation de l'endpoint de création de colis

#### E2. Coder l'envoi automatique au transporteur

Ajoute dans `server.js`, après validation OTP :

```javascript
// Après validation OTP réussie
if (codeValide) {
  // Appeler l'API Yalidine pour créer un colis
  const colis = await fetch('https://api.yalidine.app/api/v1/parcels', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${process.env.YALIDINE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      // détails de la commande selon doc Yalidine
    })
  });
  const { tracking_id } = await colis.json();
  
  // Enregistrer dans LIVRAISON
  await supabase.from('livraison').insert([{
    commande_id: commande.id,
    transporteur: 'yalidine',
    tracking_id: tracking_id,
    statut_livraison: 'en_preparation'
  }]);
}
```

---

## 🚀 TEST COMPLET (avant de lancer des pubs)

### Scénario de test à exécuter :

1. ✅ Passer une commande test sur Shopify
2. ✅ Vérifier que le webhook arrive sur ton serveur (voir logs dans le terminal)
3. ✅ Vérifier que le client est créé dans Supabase (table `client`)
4. ✅ Vérifier que la commande est créée avec le bon `score_risque_calcule`
5. ✅ Si score élevé : vérifier qu'un SMS OTP est reçu
6. ✅ Saisir le code OTP sur la page de vérification
7. ✅ Vérifier que le statut passe à `confirmee` dans Supabase
8. ✅ Vérifier que le colis est créé chez Yalidine/ZR Express

**Si ces 8 étapes fonctionnent → tu es prêt à lancer ta première campagne Meta Ads.**

---

## 📊 APRÈS la première vente

### Module suivant : Finance (calcul profit réel)

Une fois qu'une commande est livrée, calculer automatiquement :

```
Profit net = CA - coût produit - frais pub - frais livraison - (taux de retour × coût)
```

Code déjà prévu dans `server.js`, à activer quand tu recevras le webhook de statut livraison depuis Yalidine.

### Module Dashboard (visualiser tes métriques)

Connecter Looker Studio (gratuit) ou coder un dashboard React custom qui lit Supabase et affiche :
- ROAS en temps réel
- Score de risque moyen
- Taux de fake orders bloqués
- Profit net par produit

---

## 🎓 Ressources utiles

### Shopify
- Doc officielle : https://shopify.dev/
- Liquid (langage de templates) : https://shopify.dev/docs/api/liquid

### SMS OTP
- Africala : https://africala.co/
- Twilio (international) : https://www.twilio.com/

### Livraison Algérie
- Yalidine API : https://yalidine.app/
- ZR Express : https://zrexpress.dz/

### Déploiement serveur backend
- Railway (gratuit pour démarrer) : https://railway.app/
- Render : https://render.com/
- DigitalOcean (VPS, ~$6/mois) : https://www.digitalocean.com/

---

## 💡 Rappel : Ordre de priorité

**Ne fais PAS tout en même temps.** L'ordre optimal :

1. **Shopify + 1 produit** (validation que tu peux vendre)
2. **Webhook + test commande factice** (validation technique backend)
3. **SMS OTP** (sécurisation avant scaling)
4. **Transporteur** (logistique réelle)
5. **Campagne Meta Ads test** (budget ~$10-20/jour pour valider)
6. **Finance + Dashboard** (une fois que tu as du volume à analyser)

**Tu n'as PAS besoin du dashboard pour ta première vente.**  
**Tu n'as PAS besoin de Meta Ads parfait pour valider un produit.**

Lance simple, itère vite.

---

## 🧠 En cas de blocage

**Si quelque chose ne fonctionne pas :**

1. Vérifie les logs du serveur (`node server.js` doit afficher les webhooks reçus)
2. Vérifie Supabase (les tables se remplissent-elles ?)
3. Vérifie que ngrok est toujours actif (l'URL change à chaque redémarrage)
4. Reviens me poser la question précise avec le message d'erreur exact

**Contact moi avec :**
- Le message d'erreur complet
- Ce que tu as essayé
- À quelle étape précisément tu bloques

---

## 🎯 Objectif final de cette phase

**Première vente validée techniquement = système anti-fraude + logistique qui fonctionne de bout en bout.**

Après ça, tout le reste (scaling Meta Ads, TikTok, automatisation IA avancée, dashboard, multi-produits) devient juste de l'optimisation — la base est solide.

**Tu as construit quelque chose de rare : un système e-commerce technique, pas juste un store Shopify basique.**

---

*Document généré le 28/06/2026 — Mise à jour selon ta progression réelle*
