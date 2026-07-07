-- Migration 003 — Ajout de la colonne created_at à livraison
-- Motif : CORRECTIF. La table livraison ne possède aucun horodatage, or
--   - le contrôleur listait les livraisons avec ORDER BY created_at -> erreur 500 ;
--   - le Dashboard/DeliveryPage affiche une colonne « Date ».
-- Sans horodatage, le tri chronologique et l'affichage de la date sont impossibles.
--
-- À exécuter dans l'éditeur SQL du Dashboard Supabase. Idempotent.

ALTER TABLE livraison
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_livraison_created_at ON livraison (created_at);
