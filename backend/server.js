// server.js - メインサーバーファイル
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const sharp = require('sharp');
const cors = require('cors');
const fs = require('fs').promises;
const cron = require('node-cron');
const winston = require('winston');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// ===== 設定 =====
const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// 新しいストレージ設定
const STORAGE_ROOT = process.env.STORAGE_ROOT || './uploads_dev';

// ===== ログ設定 =====
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

// ===== データベース接続 =====
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'cleaning_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool;

async function initializeDatabase() {
  try {
    pool = await mysql.createPool(dbConfig);
    logger.info('データベースに接続しました');
  } catch (error) {
    logger.error('データベース接続エラー:', error);
    process.exit(1);
  }
}

// ===== ミドルウェア =====
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静的ファイル配信（開発環境のみ）
if (process.env.NODE_ENV !== 'production') {
  app.use('/', express.static(STORAGE_ROOT, {
    maxAge: '7d',
    setHeaders: (res, path) => {
      if (path.endsWith('.pdf') || path.match(/\.(jpg|jpeg|png|webp)$/i)) {
        res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days
      }
    }
  }));
}

// レート制限（DDoS対策）
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 100 // 最大100リクエスト
});
app.use('/api/', limiter);

// ===== 旧Multer設定（互換性のため保持、必要に応じて削除可能） =====
const legacyUpload = multer({ 
  dest: path.join(STORAGE_ROOT, 'legacy'),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB制限
  },
  fileFilter: (req, file, cb) => {
    if (/\.(jpg|jpeg|png|gif|pdf)$/i.test(file.originalname)) {
      return cb(null, true);
    } else {
      cb(new Error('画像ファイル（JPEG, PNG, GIF）またはPDFのみアップロード可能です'));
    }
  }
});

// ===== 認証ミドルウェア =====
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: '認証が必要です' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const [users] = await pool.execute(
      'SELECT id, email, name, role FROM users WHERE id = ? AND is_active = true',
      [decoded.userId]
    );
    
    if (users.length === 0) {
      return res.status(403).json({ error: 'ユーザーが見つかりません' });
    }
    
    req.user = users[0];
    next();
  } catch (error) {
    return res.status(403).json({ error: 'トークンが無効です' });
  }
};

// 管理者権限チェック
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '管理者権限が必要です' });
  }
  next();
};

// ===== 新しいアップロードルート =====
const uploadRoutes = require('./src/routes/upload');
app.use('/api/upload', authenticateToken, uploadRoutes);

// ===== API エンドポイント =====

// ヘルスチェック
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// ===== 認証関連 =====
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE email = ? AND is_active = true',
      [email]
    );
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
    }
    
    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
    }
    
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // ユーザーに関連する施設を取得
    let facilities = [];
    if (user.role === 'staff') {
      const [staffFacilities] = await pool.execute(
        `SELECT f.* FROM facilities f 
         JOIN staff_facilities sf ON f.id = sf.facility_id 
         WHERE sf.staff_user_id = ?`,
        [user.id]
      );
      facilities = staffFacilities;
    } else if (user.role === 'client') {
      const [clientFacilities] = await pool.execute(
        'SELECT * FROM facilities WHERE client_user_id = ?',
        [user.id]
      );
      facilities = clientFacilities;
    } else if (user.role === 'admin') {
      const [allFacilities] = await pool.execute('SELECT * FROM facilities');
      facilities = allFacilities;
    }
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        facilities: facilities.map(f => f.id)
      }
    });
    
    logger.info(`ログイン成功: ${email}`);
  } catch (error) {
    logger.error('ログインエラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ===== ユーザー管理 =====
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, email, name, role, created_at, is_active FROM users'
    );
    res.json(users);
  } catch (error) {
    logger.error('ユーザー取得エラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const [result] = await pool.execute(
      'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
      [email, hashedPassword, name, role]
    );
    
    res.status(201).json({ id: result.insertId, email, name, role });
    logger.info(`新規ユーザー作成: ${email}`);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'このメールアドレスは既に登録されています' });
    } else {
      logger.error('ユーザー作成エラー:', error);
      res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
  }
});

// ===== 施設管理 =====
app.get('/api/facilities', authenticateToken, async (req, res) => {
  try {
    let query;
    let params = [];
    
    if (req.user.role === 'admin') {
      query = 'SELECT * FROM facilities';
    } else if (req.user.role === 'client') {
      query = 'SELECT * FROM facilities WHERE client_user_id = ?';
      params = [req.user.id];
    } else if (req.user.role === 'staff') {
      query = `SELECT f.* FROM facilities f 
               JOIN staff_facilities sf ON f.id = sf.facility_id 
               WHERE sf.staff_user_id = ?`;
      params = [req.user.id];
    }
    
    const [facilities] = await pool.execute(query, params);
    res.json(facilities);
  } catch (error) {
    logger.error('施設取得エラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

app.post('/api/facilities', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, address, client_user_id } = req.body;
    
    const [result] = await pool.execute(
      'INSERT INTO facilities (name, address, client_user_id) VALUES (?, ?, ?)',
      [name, address, client_user_id]
    );
    
    res.status(201).json({ id: result.insertId, name, address, client_user_id });
    logger.info(`新規施設作成: ${name}`);
  } catch (error) {
    logger.error('施設作成エラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ===== 清掃セッション管理 =====
app.post('/api/sessions', authenticateToken, async (req, res) => {
  try {
    const { facilityId, cleaningDate, ventilationChecked, airFilterChecked } = req.body;
    
    // 既存のセッションをチェック
    const [existing] = await pool.execute(
      'SELECT id FROM cleaning_sessions WHERE facility_id = ? AND cleaning_date = ?',
      [facilityId, cleaningDate || new Date()]
    );
    
    if (existing.length > 0) {
      // 更新
      await pool.execute(
        'UPDATE cleaning_sessions SET ventilation_checked = ?, air_filter_checked = ? WHERE id = ?',
        [ventilationChecked, airFilterChecked, existing[0].id]
      );
      res.json({ id: existing[0].id, updated: true });
    } else {
      // 新規作成
      const [result] = await pool.execute(
        'INSERT INTO cleaning_sessions (facility_id, cleaning_date, staff_user_id, ventilation_checked, air_filter_checked) VALUES (?, ?, ?, ?, ?)',
        [facilityId, cleaningDate || new Date(), req.user.id, ventilationChecked, airFilterChecked]
      );
      res.status(201).json({ id: result.insertId, created: true });
    }
  } catch (error) {
    logger.error('セッション作成/更新エラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ===== 写真アップロード =====
app.post('/api/photos/upload', authenticateToken, legacyUpload.array('photos', 20), async (req, res) => {
  try {
    const { facilityId, sessionId, type } = req.body;
    const uploadedFiles = [];
    
    // セッションIDを取得または作成
    let actualSessionId = sessionId;
    if (!actualSessionId) {
      const [result] = await pool.execute(
        'INSERT INTO cleaning_sessions (facility_id, cleaning_date, staff_user_id) VALUES (?, CURDATE(), ?)',
        [facilityId, req.user.id]
      );
      actualSessionId = result.insertId;
    }
    
    // 各ファイルを処理
    for (const file of req.files) {
      // サムネイル生成（画像の場合）
      let thumbnailPath = null;
      if (/\.(jpg|jpeg|png|gif)$/i.test(file.filename)) {
        thumbnailPath = file.path.replace(/(\.[^.]+)$/, '_thumb$1');
        await sharp(file.path)
          .resize(300, 200, { fit: 'cover' })
          .toFile(thumbnailPath);
      }
      
      // データベースに記録
      const [result] = await pool.execute(
        'INSERT INTO photos (cleaning_session_id, file_path, thumbnail_path, type, file_size, original_name) VALUES (?, ?, ?, ?, ?, ?)',
        [actualSessionId, file.path, thumbnailPath, type, file.size, file.originalname]
      );
      
      uploadedFiles.push({
        id: result.insertId,
        filename: file.filename,
        type: type,
        size: file.size
      });
    }
    
    res.json({
      success: true,
      sessionId: actualSessionId,
      files: uploadedFiles,
      message: `${uploadedFiles.length}枚の写真をアップロードしました`
    });
    
    logger.info(`写真アップロード: 施設${facilityId}, ${uploadedFiles.length}枚`);
  } catch (error) {
    logger.error('写真アップロードエラー:', error);
    res.status(500).json({ error: 'アップロードに失敗しました' });
  }
});

// ===== アルバム取得 =====
app.get('/api/albums/:facilityId', authenticateToken, async (req, res) => {
  try {
    const { facilityId } = req.params;
    const { date } = req.query;
    
    let query = `
      SELECT cs.*, 
             u.name as uploaded_by,
             COUNT(p.id) as photo_count
      FROM cleaning_sessions cs
      LEFT JOIN users u ON cs.staff_user_id = u.id
      LEFT JOIN photos p ON cs.id = p.cleaning_session_id
      WHERE cs.facility_id = ?
    `;
    const params = [facilityId];
    
    if (date) {
      query += ' AND cs.cleaning_date = ?';
      params.push(date);
    }
    
    query += ' GROUP BY cs.id ORDER BY cs.cleaning_date DESC';
    
    const [sessions] = await pool.execute(query, params);
    
    // 各セッションの写真を取得
    for (const session of sessions) {
      const [photos] = await pool.execute(
        'SELECT id, type, file_path, thumbnail_path, uploaded_at FROM photos WHERE cleaning_session_id = ?',
        [session.id]
      );
      session.photos = photos;
    }
    
    res.json(sessions);
  } catch (error) {
    logger.error('アルバム取得エラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ===== 統計情報 =====
app.get('/api/stats/daily', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // 今日のアップロード数
    const [uploads] = await pool.execute(
      'SELECT COUNT(*) as count FROM cleaning_sessions WHERE DATE(created_at) = ?',
      [today]
    );
    
    // 今日の清掃施設数
    const [facilities] = await pool.execute(
      'SELECT COUNT(DISTINCT facility_id) as count FROM cleaning_sessions WHERE cleaning_date = ?',
      [today]
    );
    
    // 今日の写真数
    const [photos] = await pool.execute(
      'SELECT COUNT(*) as count FROM photos WHERE DATE(uploaded_at) = ?',
      [today]
    );
    
    res.json({
      date: today,
      uploads: uploads[0].count,
      facilities: facilities[0].count,
      photos: photos[0].count
    });
  } catch (error) {
    logger.error('統計取得エラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ===== 自動削除処理（2ヶ月経過した写真） =====
cron.schedule('0 2 * * *', async () => {
  // 新しい写真削除処理
  if (process.env.RETENTION_DAYS) {
    try {
      const { cleanupOldPhotos } = require('./src/cron/retention');
      await cleanupOldPhotos();
      logger.info('新しい写真削除処理が完了しました');
    } catch (error) {
      logger.error('新しい写真削除処理エラー:', error);
    }
  }
  
  // 既存のデータベース写真削除処理（互換性のため保持）
  try {
    logger.info('既存の写真削除処理を開始します');
    
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const cutoffDate = twoMonthsAgo.toISOString().split('T')[0];
    
    // 削除対象の写真を取得
    const [photos] = await pool.execute(
      'SELECT * FROM photos WHERE DATE(uploaded_at) < ?',
      [cutoffDate]
    );
    
    // ファイルを削除
    for (const photo of photos) {
      try {
        await fs.unlink(photo.file_path);
        if (photo.thumbnail_path) {
          await fs.unlink(photo.thumbnail_path);
        }
      } catch (err) {
        logger.error(`ファイル削除エラー: ${photo.file_path}`, err);
      }
    }
    
    // データベースから削除
    await pool.execute(
      'DELETE FROM photos WHERE DATE(uploaded_at) < ?',
      [cutoffDate]
    );
    
    // 空のセッションも削除
    await pool.execute(
      'DELETE FROM cleaning_sessions WHERE id NOT IN (SELECT DISTINCT cleaning_session_id FROM photos)'
    );
    
    logger.info(`${photos.length}枚の古い写真を削除しました`);
  } catch (error) {
    logger.error('既存の削除処理エラー:', error);
  }
});

// ===== エラーハンドリング =====
app.use((err, req, res, next) => {
  logger.error('エラー:', err);
  res.status(500).json({ error: 'サーバーエラーが発生しました' });
});
// server.js に追加（authenticateToken を使う）
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({ ok: true, user: req.user });
});


// ===== サーバー起動 =====
async function startServer() {
  await initializeDatabase();
  
  app.listen(PORT, () => {
    logger.info(`サーバーが起動しました: http://localhost:${PORT}`);
    logger.info(`環境: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer();

// グレースフルシャットダウン
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});