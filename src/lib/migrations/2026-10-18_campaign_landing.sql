-- Per-campaign landing page: media buyer pins their ?c= link to variant A or B. NULL = follow admin A/B. Safe to re-run.
ALTER TABLE pixels ADD COLUMN IF NOT EXISTS landing_variant CHAR(1);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pixels_landing_variant_chk') THEN
    ALTER TABLE pixels ADD CONSTRAINT pixels_landing_variant_chk CHECK (landing_variant IN ('a', 'b'));
  END IF;
END $$;
