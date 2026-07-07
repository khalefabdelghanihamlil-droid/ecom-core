-- Migration 002 — Ajout de la colonne created_at à verif_otp
-- Motif : CORRECTIF DE SÉCURITÉ. confirmation.service.js calcule l'expiration
-- des OTP à partir de created_at ; sans cette colonne, diffMinutes = NaN et
-- aucun OTP n'expire jamais (fenêtre de validité illimitée).
--
-- À exécuter dans l'éditeur SQL du Dashboard Supabase (projet rwqvzwspxknqgcceigjt).
-- Idempotent : peut être relancé sans risque.

-- 1. Ajouter la colonne horodatée (UTC), renseignée automatiquement à l'insertion.
ALTER TABLE verif_otp
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. Backfill de sécurité pour d'éventuelles lignes déjà présentes sans valeur
--    (les OTP historiques sont considérés comme expirés -> forcés dans le passé).
UPDATE verif_otp
  SET created_at = now() - interval '1 hour'
  WHERE created_at IS NULL;

-- 3. Index pour les requêtes de purge/expiration (optionnel mais recommandé).
CREATE INDEX IF NOT EXISTS idx_verif_otp_created_at ON verif_otp (created_at);
