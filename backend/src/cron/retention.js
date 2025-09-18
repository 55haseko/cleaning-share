// backend/src/cron/retention.js - 写真保持期間管理
const fs = require('fs').promises;
const path = require('path');

/**
 * 古い写真を削除する
 * 領収書は削除対象外
 */
async function cleanupOldPhotos() {
  try {
    const storageRoot = process.env.STORAGE_ROOT || './uploads_dev';
    const retentionDays = parseInt(process.env.RETENTION_DAYS) || 60;
    const photosDir = path.join(storageRoot, 'photos');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    console.log(`写真削除処理開始: ${retentionDays}日前(${cutoffDate.toISOString().split('T')[0]})より古いファイルを削除`);

    let deletedCount = 0;

    async function processDirectory(dirPath) {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          
          if (entry.isDirectory()) {
            await processDirectory(fullPath);
            
            // ディレクトリが空なら削除
            try {
              const remaining = await fs.readdir(fullPath);
              if (remaining.length === 0) {
                await fs.rmdir(fullPath);
                console.log(`空ディレクトリ削除: ${fullPath}`);
              }
            } catch (err) {
              // 削除できなくても続行
            }
          } else {
            // ファイルの更新日時をチェック
            const stats = await fs.stat(fullPath);
            if (stats.mtime < cutoffDate) {
              await fs.unlink(fullPath);
              deletedCount++;
              console.log(`古いファイル削除: ${fullPath}`);
            }
          }
        }
      } catch (error) {
        console.error(`ディレクトリ処理エラー: ${dirPath}`, error);
      }
    }

    // photos ディレクトリが存在する場合のみ処理
    try {
      await fs.access(photosDir);
      await processDirectory(photosDir);
      console.log(`写真削除処理完了: ${deletedCount}件削除`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('photos ディレクトリが存在しません');
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.error('写真削除処理エラー:', error);
  }
}

module.exports = { cleanupOldPhotos };