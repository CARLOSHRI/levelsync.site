-- LotoGrana - Seed: Bolões padrão (Mega Sena, LotoFácil, Quina)
-- Execute após o schema.sql: mysql -u root -p lotograna_db < api/sql/seed_pools.sql

USE lotograna_db;

-- Mega Sena
INSERT INTO pools (name, lottery, lottery_name, total_spots, filled_spots, quota_price, numbers, draw_date, status)
SELECT 'Bolão da Sorte - Mega Sena', 'megasena', 'Mega Sena', 50, 0, 100.00, '[7, 14, 23, 35, 42, 58]', NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM pools WHERE lottery = 'megasena' LIMIT 1);

-- LotoFácil
INSERT INTO pools (name, lottery, lottery_name, total_spots, filled_spots, quota_price, numbers, draw_date, status)
SELECT 'Bolão LotoFácil', 'lotofacil', 'LotoFácil', 50, 0, 100.00, '[2, 5, 8, 11, 14, 17, 20, 21, 22, 23, 24, 25, 1, 3, 7]', NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM pools WHERE lottery = 'lotofacil' LIMIT 1);

-- Quina
INSERT INTO pools (name, lottery, lottery_name, total_spots, filled_spots, quota_price, numbers, draw_date, status)
SELECT 'Bolão Quina', 'quina', 'Quina', 50, 0, 100.00, '[5, 15, 25, 35, 55]', NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM pools WHERE lottery = 'quina' LIMIT 1);
