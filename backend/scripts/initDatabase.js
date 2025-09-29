// backend/scripts/initDatabase.js
// データベース初期化スクリプト（改善版）

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
    
    // データベース作成
    await connection.execute(
      'CREATE DATABASE IF NOT EXISTS cleaning_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
    console.log('データベースを作成しました');
    
    // データベース選択
    await connection.execute('USE cleaning_system');
    
    // テーブル作成
    console.log('テーブルを作成中...');
    
    // ユーザーテーブル
    await connection.execute(`
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
    
    // 施設テーブル
    await connection.execute(`
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
    
    // スタッフと施設の割当（多対多）
    await connection.execute(`
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
    
    // 清掃セッション
    await connection.execute(`
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
    
    // 写真
    await connection.execute(`
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
    
    console.log('テーブル作成完了');
    
    // 初期データの確認
    const [existingUsers] = await connection.execute('SELECT COUNT(*) as count FROM users');
    
    if (existingUsers[0].count > 0) {
      console.log('既存のデータが存在するため、初期データの投入をスキップします');
    } else {
      console.log('初期データを投入中...');
      
      // パスワードのハッシュ化
      const defaultPassword = await bcrypt.hash('password123', 10);
      
      // 管理者ユーザー
      const [adminResult] = await connection.execute(
        'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
        ['admin@cleaning.com', defaultPassword, 'システム管理者', 'admin']
      );
      const adminId = adminResult.insertId;
      
      // クライアントユーザー
      const [client1Result] = await connection.execute(
        'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
        ['client1@example.com', defaultPassword, '株式会社サンプル', 'client']
      );
      const client1Id = client1Result.insertId;
      
      const [client2Result] = await connection.execute(
        'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
        ['client2@example.com', defaultPassword, '株式会社テスト', 'client']
      );
      const client2Id = client2Result.insertId;
      
      // スタッフユーザー
      const [staff1Result] = await connection.execute(
        'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
        ['staff1@cleaning.com', defaultPassword, '山田太郎', 'staff']
      );
      const staff1Id = staff1Result.insertId;
      
      const [staff2Result] = await connection.execute(
        'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
        ['staff2@cleaning.com', defaultPassword, '佐藤花子', 'staff']
      );
      const staff2Id = staff2Result.insertId;
      
      // 施設データ
      const [facility1Result] = await connection.execute(
        'INSERT INTO facilities (name, address, client_user_id) VALUES (?, ?, ?)',
        ['サンプルビル 3F', '東京都千代田区1-1-1', client1Id]
      );
      const facility1Id = facility1Result.insertId;
      
      const [facility2Result] = await connection.execute(
        'INSERT INTO facilities (name, address, client_user_id) VALUES (?, ?, ?)',
        ['サンプルオフィス', '東京都港区2-2-2', client1Id]
      );
      const facility2Id = facility2Result.insertId;
      
      const [facility3Result] = await connection.execute(
        'INSERT INTO facilities (name, address, client_user_id) VALUES (?, ?, ?)',
        ['テストセンター', '東京都渋谷区3-3-3', client2Id]
      );
      const facility3Id = facility3Result.insertId;
      
      // スタッフと施設の割り当て
      await connection.execute(
        'INSERT INTO staff_facilities (staff_user_id, facility_id) VALUES (?, ?)',
        [staff1Id, facility1Id]
      );
      
      await connection.execute(
        'INSERT INTO staff_facilities (staff_user_id, facility_id) VALUES (?, ?)',
        [staff1Id, facility2Id]
      );
      
      await connection.execute(
        'INSERT INTO staff_facilities (staff_user_id, facility_id) VALUES (?, ?)',
        [staff2Id, facility2Id]
      );
      
      await connection.execute(
        'INSERT INTO staff_facilities (staff_user_id, facility_id) VALUES (?, ?)',
        [staff2Id, facility3Id]
      );
      
      console.log('初期データ投入完了');
      
      console.log('\n=====================================');
      console.log('初期ログイン情報');
      console.log('=====================================');
      console.log('【管理者】');
      console.log('  メール: admin@cleaning.com');
      console.log('  パスワード: password123');
      console.log('');
      console.log('【クライアント】');
      console.log('  メール: client1@example.com');
      console.log('  パスワード: password123');
      console.log('');
      console.log('  メール: client2@example.com');
      console.log('  パスワード: password123');
      console.log('');
      console.log('【スタッフ】');
      console.log('  メール: staff1@cleaning.com');
      console.log('  パスワード: password123');
      console.log('');
      console.log('  メール: staff2@cleaning.com');
      console.log('  パスワード: password123');
      console.log('=====================================\n');
    }
    
    // アップロードディレクトリの作成
    const uploadsDir = path.join(__dirname, '..', process.env.STORAGE_ROOT || 'uploads_dev');
    const photosDir = path.join(uploadsDir, 'photos');
    const receiptsDir = path.join(uploadsDir, 'receipts');
    
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
      await fs.mkdir(photosDir, { recursive: true });
      await fs.mkdir(receiptsDir, { recursive: true });
      console.log('アップロードディレクトリを作成しました:', uploadsDir);
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
    
    console.log('\n✅ データベース初期化が完了しました！');
    
  } catch (error) {
    console.error('❌ データベース初期化エラー:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('データベース接続を閉じました');
    }
  }
}

// 実行
initDatabase();