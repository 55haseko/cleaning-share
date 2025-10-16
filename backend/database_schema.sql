CREATE DATABASE IF NOT EXISTS cleaning_system
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cleaning_system;

-- ユーザー
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role ENUM('staff','client','admin') NOT NULL DEFAULT 'staff',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 施設
CREATE TABLE IF NOT EXISTS facilities (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  address VARCHAR(255),
  client_user_id INT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fac_client FOREIGN KEY (client_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- スタッフと施設の割当（多対多）
CREATE TABLE IF NOT EXISTS staff_facilities (
  staff_user_id INT NOT NULL,
  facility_id INT NOT NULL,
  PRIMARY KEY (staff_user_id, facility_id),
  CONSTRAINT fk_sf_staff FOREIGN KEY (staff_user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_sf_fac FOREIGN KEY (facility_id) REFERENCES facilities(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 清掃セッション
CREATE TABLE IF NOT EXISTS cleaning_sessions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  facility_id INT NOT NULL,
  cleaning_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  staff_user_id INT,
  ventilation_checked BOOLEAN NOT NULL DEFAULT FALSE,
  air_filter_checked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cs_fac FOREIGN KEY (facility_id) REFERENCES facilities(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cs_staff FOREIGN KEY (staff_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_cs_fac_date (facility_id, cleaning_date)
) ENGINE=InnoDB;

-- 写真
CREATE TABLE IF NOT EXISTS photos (
  id INT PRIMARY KEY AUTO_INCREMENT,
  cleaning_session_id INT NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  thumbnail_path VARCHAR(500),
  type ENUM('before','after','general') NOT NULL DEFAULT 'general',
  file_size INT,
  original_name VARCHAR(255),
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ph_session FOREIGN KEY (cleaning_session_id) REFERENCES cleaning_sessions(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_ph_session (cleaning_session_id)
) ENGINE=InnoDB;

-- 領収書
CREATE TABLE IF NOT EXISTS receipts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  cleaning_session_id INT,
  facility_id INT NOT NULL,
  month VARCHAR(7) NOT NULL COMMENT 'YYYY-MM形式',
  file_path VARCHAR(512) NOT NULL,
  file_size INT,
  original_name VARCHAR(255),
  uploaded_by INT,
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rec_session FOREIGN KEY (cleaning_session_id) REFERENCES cleaning_sessions(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_rec_facility FOREIGN KEY (facility_id) REFERENCES facilities(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_rec_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_rec_facility_month (facility_id, month),
  INDEX idx_rec_session (cleaning_session_id)
) ENGINE=InnoDB;
