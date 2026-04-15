-- LotoGrana - Schema MySQL
-- Execute este arquivo para criar o banco de dados

CREATE DATABASE IF NOT EXISTS lotograna_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE lotograna_db;

-- ==================== USERS ====================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20) DEFAULT NULL,
    password_hash VARCHAR(255) NOT NULL,
    balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    blocked TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role)
) ENGINE=InnoDB;

-- Se a tabela já existe e falta a coluna phone:
-- ALTER TABLE users ADD COLUMN phone VARCHAR(20) DEFAULT NULL AFTER email;

-- Se a tabela já existe e falta a coluna blocked:
-- ALTER TABLE users ADD COLUMN blocked TINYINT(1) NOT NULL DEFAULT 0 AFTER role;

-- ==================== BETS ====================
CREATE TABLE IF NOT EXISTS bets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    lottery_id VARCHAR(50) NOT NULL,
    lottery_name VARCHAR(100) NOT NULL,
    numbers JSON NOT NULL,
    value DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    status ENUM('active', 'won', 'lost') NOT NULL DEFAULT 'active',
    date VARCHAR(20),
    contest INT DEFAULT NULL,
    prize DECIMAL(12,2) DEFAULT NULL,
    hits INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- ==================== TRANSACTIONS ====================
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('deposit', 'withdraw', 'bet', 'pool', 'admin') NOT NULL,
    method VARCHAR(50) DEFAULT NULL,
    lottery VARCHAR(100) DEFAULT NULL,
    value DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    reason VARCHAR(255) DEFAULT NULL,
    date VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_type (type)
) ENGINE=InnoDB;

-- ==================== POOLS ====================
CREATE TABLE IF NOT EXISTS pools (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    lottery VARCHAR(50) NOT NULL,
    lottery_name VARCHAR(100) NOT NULL,
    total_spots INT NOT NULL DEFAULT 0,
    filled_spots INT NOT NULL DEFAULT 0,
    quota_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    numbers JSON NOT NULL,
    draw_date VARCHAR(20),
    status ENUM('active', 'closed') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- ==================== POOL PARTICIPATIONS ====================
CREATE TABLE IF NOT EXISTS pool_participations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pool_id INT NOT NULL,
    user_id INT NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    quotas INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pool_id) REFERENCES pools(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_pool_id (pool_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

-- ==================== DEPOSITS (PIX DUTTYFY) ====================
CREATE TABLE IF NOT EXISTS deposits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    transaction_id VARCHAR(255) NOT NULL UNIQUE,
    amount DECIMAL(12,2) NOT NULL,
    status ENUM('PENDING', 'COMPLETED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    pix_code TEXT,
    paid_at TIMESTAMP NULL DEFAULT NULL,
    credited TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_transaction_id (transaction_id),
    INDEX idx_status (status),
    INDEX idx_credited (credited)
) ENGINE=InnoDB;

-- ==================== LOTTERY RESULTS ====================
CREATE TABLE IF NOT EXISTS lottery_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lottery VARCHAR(50) NOT NULL,
    contest INT NOT NULL,
    date VARCHAR(20),
    numbers JSON NOT NULL,
    prize DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    acumulou TINYINT(1) NOT NULL DEFAULT 0,
    premiacao JSON,
    next_contest_date VARCHAR(50) DEFAULT NULL,
    next_contest_prize DECIMAL(15,2) DEFAULT NULL,
    raw_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY idx_lottery_contest (lottery, contest),
    INDEX idx_lottery (lottery),
    INDEX idx_contest (contest)
) ENGINE=InnoDB;

-- ==================== WITHDRAWALS ====================
CREATE TABLE IF NOT EXISTS withdrawals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    pix_key VARCHAR(255) NOT NULL,
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    admin_note VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- ==================== PUSH SUBSCRIPTIONS ====================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh VARCHAR(255) NOT NULL,
  auth VARCHAR(255) NOT NULL,
  user_agent VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

-- ==================== NOTIFICATION SCHEDULES ====================
CREATE TABLE IF NOT EXISTS notification_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  scheduled_at DATETIME NULL,
  recurrence ENUM('none','daily','draw_days') DEFAULT 'none',
  lottery_id VARCHAR(50) NULL,
  recurrence_hour TINYINT UNSIGNED NULL,
  recurrence_minute TINYINT UNSIGNED NULL,
  status ENUM('pending','sent','cancelled') DEFAULT 'pending',
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notification_sent_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  schedule_id INT NOT NULL,
  sent_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY idx_schedule_date (schedule_id, sent_date),
  FOREIGN KEY (schedule_id) REFERENCES notification_schedules(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==================== ADMIN SEED ====================
-- Crie um admin (troque a senha pelo hash gerado com password_hash('suasenha', PASSWORD_BCRYPT))
-- INSERT INTO users (name, email, password_hash, role) VALUES ('Admin', 'admin@lotograna.com', '$2y$10$...', 'admin');
