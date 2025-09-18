// backend/src/routes/upload.js - アップロード専用ルート
const express = require('express');
const multer = require('multer');
const path = require('path');
const {
  ensureDir,
  photosPath,
  receiptsPath,
  generateSafeFilename,
  publicUrlFrom,
  validateFileType
} = require('../storage/local');

const router = express.Router();

// Multer設定
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: (parseInt(process.env.MAX_FILE_MB) || 20) * 1024 * 1024 // デフォルト20MB
  }
});

/**
 * 写真アップロード
 * POST /api/upload/photo
 * FormData: file, facilityId, date, tag (optional)
 */
router.post('/photo', upload.single('file'), async (req, res) => {
  try {
    const { facilityId, date, tag } = req.body;
    const file = req.file;

    // バリデーション
    if (!file) {
      return res.status(400).json({ ok: false, error: 'ファイルが指定されていません' });
    }
    if (!facilityId) {
      return res.status(400).json({ ok: false, error: 'facilityIdが必要です' });
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ ok: false, error: '有効な日付(YYYY-MM-DD)が必要です' });
    }

    // ファイルタイプチェック
    if (!validateFileType(file.mimetype, file.originalname, 'photo')) {
      return res.status(400).json({ 
        ok: false, 
        error: '画像ファイル（JPEG, PNG, WebP）のみアップロード可能です' 
      });
    }

    // 保存処理
    const saveDir = photosPath(facilityId, date);
    await ensureDir(saveDir);

    const filename = generateSafeFilename(file.originalname);
    const filePath = path.join(saveDir, filename);

    await require('fs').promises.writeFile(filePath, file.buffer);

    const url = publicUrlFrom(filePath);

    res.json({
      ok: true,
      url,
      bytes: file.size,
      filename
    });

  } catch (error) {
    console.error('写真アップロードエラー:', error);
    res.status(500).json({ ok: false, error: 'アップロードに失敗しました' });
  }
});

/**
 * 領収書アップロード
 * POST /api/upload/receipt
 * FormData: file, facilityId, month
 */
router.post('/receipt', upload.single('file'), async (req, res) => {
  try {
    const { facilityId, month } = req.body;
    const file = req.file;

    // バリデーション
    if (!file) {
      return res.status(400).json({ ok: false, error: 'ファイルが指定されていません' });
    }
    if (!facilityId) {
      return res.status(400).json({ ok: false, error: 'facilityIdが必要です' });
    }
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ ok: false, error: '有効な月(YYYY-MM)が必要です' });
    }

    // ファイルタイプチェック
    if (!validateFileType(file.mimetype, file.originalname, 'receipt')) {
      return res.status(400).json({ 
        ok: false, 
        error: 'PDFファイルのみアップロード可能です' 
      });
    }

    // 保存処理
    const saveDir = receiptsPath(facilityId, month);
    await ensureDir(saveDir);

    const filename = generateSafeFilename(file.originalname);
    const filePath = path.join(saveDir, filename);

    await require('fs').promises.writeFile(filePath, file.buffer);

    const url = publicUrlFrom(filePath);

    res.json({
      ok: true,
      url,
      bytes: file.size,
      filename
    });

  } catch (error) {
    console.error('領収書アップロードエラー:', error);
    res.status(500).json({ ok: false, error: 'アップロードに失敗しました' });
  }
});

module.exports = router;