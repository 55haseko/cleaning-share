// ===== scripts/initDatabase.js =====
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function initDatabase() {
  let connection;
  
  try {
    // データベース接続（データベース名なし）
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });
    
    console.log('MySQLに接続しました');
    
    // データベース作成（query を使用）
    await connection.query(
      'CREATE DATABASE IF NOT EXISTS cleaning_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
    console.log('データベースを作成しました');
    
    // データベース選択（query を使用）
    await connection.query('USE cleaning_system');
    console.log('データベースを選択しました');
    
    // テーブル作成
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(190) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        role ENUM('staff','client','admin') NOT NULL DEFAULT 'staff',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);
    console.log('usersテーブルを作成しました');
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS facilities (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(150) NOT NULL,
        address VARCHAR(255),
        client_user_id INT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_fac_client FOREIGN KEY (client_user_id) REFERENCES users(id)
          ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB
    `);
    console.log('facilitiesテーブルを作成しました');
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS staff_facilities (
        staff_user_id INT NOT NULL,
        facility_id INT NOT NULL,
        PRIMARY KEY (staff_user_id, facility_id),
        CONSTRAINT fk_sf_staff FOREIGN KEY (staff_user_id) REFERENCES users(id)
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_sf_fac FOREIGN KEY (facility_id) REFERENCES facilities(id)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB
    `);
    console.log('staff_facilitiesテーブルを作成しました');
    
    await connection.query(`
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
      ) ENGINE=InnoDB
    `);
    console.log('cleaning_sessionsテーブルを作成しました');
    
    await connection.query(`
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
      ) ENGINE=InnoDB
    `);
    console.log('photosテーブルを作成しました');
    
    // 初期ユーザーのパスワードをハッシュ化
    const adminPassword = await bcrypt.hash('admin123', 10);
    const staffPassword = await bcrypt.hash('staff123', 10);
    const clientPassword = await bcrypt.hash('client123', 10);
    
    // 初期データ投入（execute は使える）
    console.log('初期ユーザーを作成中...');
    
    // 管理者
    await connection.execute(
      'INSERT IGNORE INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
      ['admin@cleaning.com', adminPassword, '管理者', 'admin']
    );
    
    // クライアント
    await connection.execute(
      'INSERT IGNORE INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
      ['client1@example.com', clientPassword, '株式会社サンプル', 'client']
    );
    
    // スタッフ
    await connection.execute(
      'INSERT IGNORE INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
      ['staff1@cleaning.com', staffPassword, '山田太郎', 'staff']
    );
    
    console.log('✅ 初期データを投入しました');
    console.log('\n===== ログイン情報 =====');
    console.log('管理者: admin@cleaning.com / admin123');
    console.log('クライアント: client1@example.com / client123');
    console.log('スタッフ: staff1@cleaning.com / staff123');
    console.log('========================\n');
    
  } catch (error) {
    console.error('❌ データベース初期化エラー:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 実行
initDatabase();