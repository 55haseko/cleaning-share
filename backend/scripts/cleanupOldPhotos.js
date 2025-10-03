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