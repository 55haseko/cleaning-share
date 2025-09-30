// ===== scripts/initDatabase.js =====
// データベース初期化スクリプト
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
    
    console.log('データベースに接続しました');
    
    // データベース作成
    await connection.execute(
      'CREATE DATABASE IF NOT EXISTS cleaning_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
    console.log('データベースを作成しました');
    
    // データベース選択
    await connection.execute('USE cleaning_system');
    
    // スキーマファイルを読み込む
    const schemaPath = path.join(__dirname, '../database_schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');
    
    // SQLを個別のステートメントに分割
    const statements = schema
      .split(';')
      .filter(stmt => stmt.trim().length > 0)
      .map(stmt => stmt.trim() + ';');
    
    // 各ステートメントを実行
    for (const statement of statements) {
      if (statement.includes('CREATE TABLE') || statement.includes('CREATE DATABASE')) {
        await connection.execute(statement);
        console.log('実行完了:', statement.substring(0, 50) + '...');
      }
    }
    
    // 初期ユーザーのパスワードをハッシュ化
    const adminPassword = await bcrypt.hash('admin123', 10);
    const staffPassword = await bcrypt.hash('staff123', 10);
    const clientPassword = await bcrypt.hash('client123', 10);
    
    // 初期データ投入
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
    
    console.log('初期データを投入しました');
    console.log('\n===== ログイン情報 =====');
    console.log('管理者: admin@cleaning.com / admin123');
    console.log('クライアント: client1@example.com / client123');
    console.log('スタッフ: staff1@cleaning.com / staff123');
    console.log('========================\n');
    
  } catch (error) {
    console.error('データベース初期化エラー:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 実行
initDatabase();

// ===== scripts/cleanupOldPhotos.js =====
// 古い写真を削除するスクリプト（手動実行用）
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function cleanupOldPhotos() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'cleaning_system'
    });
    
    // 2ヶ月前の日付を計算
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const cutoffDate = twoMonthsAgo.toISOString().split('T')[0];
    
    console.log(`${cutoffDate}以前の写真を削除します`);
    
    // 削除対象の写真を取得
    const [photos] = await connection.execute(
      'SELECT * FROM photos WHERE DATE(uploaded_at) < ?',
      [cutoffDate]
    );
    
    console.log(`削除対象: ${photos.length}枚`);
    
    // ファイルを削除
    let deletedCount = 0;
    for (const photo of photos) {
      try {
        await fs.unlink(photo.file_path);
        if (photo.thumbnail_path) {
          await fs.unlink(photo.thumbnail_path);
        }
        deletedCount++;
      } catch (err) {
        console.error(`ファイル削除エラー: ${photo.file_path}`, err.message);
      }
    }
    
    // データベースから削除
    await connection.execute(
      'DELETE FROM photos WHERE DATE(uploaded_at) < ?',
      [cutoffDate]
    );
    
    // 空のセッションも削除
    const [deletedSessions] = await connection.execute(
      'DELETE FROM cleaning_sessions WHERE id NOT IN (SELECT DISTINCT cleaning_session_id FROM photos)'
    );
    
    console.log(`完了: ${deletedCount}個のファイルを削除しました`);
    console.log(`空のセッション${deletedSessions.affectedRows}件を削除しました`);
    
    // 古いフォルダも削除
    const uploadDir = process.env.UPLOAD_DIR || '/var/www/cleaning-app/uploads';
    const twoMonthsAgoYM = `${twoMonthsAgo.getFullYear()}-${String(twoMonthsAgo.getMonth() + 1).padStart(2, '0')}`;
    
    try {
      const oldDir = path.join(uploadDir, twoMonthsAgoYM);
      await fs.rmdir(oldDir, { recursive: true });
      console.log(`古いフォルダを削除: ${oldDir}`);
    } catch (err) {
      console.log('古いフォルダが見つかりません');
    }
    
  } catch (error) {
    console.error('クリーンアップエラー:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 実行
cleanupOldPhotos();