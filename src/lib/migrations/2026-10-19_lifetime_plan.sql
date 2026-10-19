-- Add Lifetime plan (499) — 36500 days used as sentinel for lifetime
BEGIN;

INSERT INTO plans (name, original_price, price, duration_days, description)
SELECT 'Lifetime', 999, 499, 36500, 'Ek baar lelo, zindagi bhar mazza'
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'Lifetime' AND duration_days = 36500);

COMMIT;

SELECT id, name, price, original_price, duration_days, is_active FROM plans ORDER BY is_active DESC, price;
