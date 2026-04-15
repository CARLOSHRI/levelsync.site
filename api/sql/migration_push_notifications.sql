-- LotoGrana - Migration: Push Notifications
-- Execute: mysql -u usuario -p database < api/sql/migration_push_notifications.sql

-- Subscriptions push (por usuário)
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

-- Notificações agendadas
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

-- Log de envios recorrentes (evitar reenviar no mesmo dia)
CREATE TABLE IF NOT EXISTS notification_sent_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  schedule_id INT NOT NULL,
  sent_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY idx_schedule_date (schedule_id, sent_date),
  FOREIGN KEY (schedule_id) REFERENCES notification_schedules(id) ON DELETE CASCADE
) ENGINE=InnoDB;
