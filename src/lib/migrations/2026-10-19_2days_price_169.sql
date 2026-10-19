-- Update 2 Days plan price from 149 to 169
BEGIN;

UPDATE plans SET price = 169 WHERE name = '2 Days' AND price = 149 AND duration_days = 2;

COMMIT;

SELECT id, name, price, original_price, duration_days, is_active FROM plans ORDER BY is_active DESC, price;
