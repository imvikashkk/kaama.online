-- Per-campaign bot cloaking variant override
ALTER TABLE pixels ADD COLUMN IF NOT EXISTS bot_variant CHAR(1);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pixels_bot_variant_chk') THEN
    ALTER TABLE pixels ADD CONSTRAINT pixels_bot_variant_chk CHECK (bot_variant IN ('a', 'b'));
  END IF;
END $$;
