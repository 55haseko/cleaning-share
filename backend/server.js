// server.js - メインサーバーファイル（改善版）
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
const PORT = process.env.PORT || 4001;
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
  app.use('/uploads', express.static(STORAGE_ROOT, {
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

// ===== ディレクトリ作成ヘルパー =====
async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

// ===== Multer設定（仕様準拠版） =====
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    const { facilityId, date: cleaningDate } = req.body;
    const targetDate = cleaningDate || new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const yearMonth = targetDate.substring(0, 7); // YYYY-MM

    // 仕様通りのディレクトリ構造: uploads_dev/photos/{facility_id}/{YYYY-MM}/{YYYY-MM-DD}/
    const uploadPath = path.join(STORAGE_ROOT, 'photos', facilityId.toString(), yearMonth, targetDate);

    try {
      await ensureDir(uploadPath);
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: function (req, file, cb) {
    const { facilityId, date: cleaningDate, type } = req.body;
    const targetDate = cleaningDate || new Date().toISOString().split('T')[0];
    const dateFormatted = targetDate.replace(/-/g, ''); // YYYYMMDD
    const uuid = require('crypto').randomUUID().substring(0, 8);
    const ext = path.extname(file.originalname).toLowerCase();

    // 仕様通りのファイル命名: fac-{id}_{YYYYMMDD}_{type}_{uuid}.{ext}
    const filename = `fac-${facilityId}_${dateFormatted}_${type || 'before'}_${uuid}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB制限
  },
  fileFilter: (req, file, cb) => {
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(file.originalname)) {
      return cb(null, true);
    } else {
      cb(new Error('画像ファイル（JPEG, PNG, GIF, WebP）のみアップロード可能です'));
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

    // 直接接続を作成
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'cleaning_user',
      password: process.env.DB_PASSWORD || 'strongpassword',
      database: process.env.DB_NAME || 'cleaning_system'
    });

    const [users] = await connection.execute(
      'SELECT id, email, name, role FROM users WHERE id = ? AND is_active = true',
      [decoded.userId]
    );

    await connection.end();
    
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

// ===== API エンドポイント =====

// ヘルスチェック
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// ===== 認証関連 =====
app.post('/api/auth/login', async (req, res) => {
  let connection;
  try {
    const { email, password } = req.body;
    
    // 直接接続を作成（環境変数を使用）
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'cleaning_user',
      password: process.env.DB_PASSWORD || 'strongpassword',
      database: process.env.DB_NAME || 'cleaning_system'
    });
    
    const [users] = await connection.execute(
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
      const [staffFacilities] = await connection.execute(
        `SELECT f.* FROM facilities f 
         JOIN staff_facilities sf ON f.id = sf.facility_id 
         WHERE sf.staff_user_id = ?`,
        [user.id]
      );
      facilities = staffFacilities;
    } else if (user.role === 'client') {
      const [clientFacilities] = await connection.execute(
        'SELECT * FROM facilities WHERE client_user_id = ?',
        [user.id]
      );
      facilities = clientFacilities;
    } else if (user.role === 'admin') {
      const [allFacilities] = await connection.execute('SELECT * FROM facilities');
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
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// 現在のユーザー情報取得
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'cleaning_user',
      password: process.env.DB_PASSWORD || 'strongpassword',
      database: process.env.DB_NAME || 'cleaning_system'
    });

    const [users] = await connection.execute(
      'SELECT id, email, name, role FROM users WHERE id = ? AND is_active = true',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }

    const user = users[0];

    // ユーザーに関連する施設を取得
    let facilities = [];
    if (user.role === 'staff') {
      const [staffFacilities] = await connection.execute(
        `SELECT f.* FROM facilities f
         JOIN staff_facilities sf ON f.id = sf.facility_id
         WHERE sf.staff_user_id = ?`,
        [user.id]
      );
      facilities = staffFacilities;
    } else if (user.role === 'client') {
      const [clientFacilities] = await connection.execute(
        'SELECT * FROM facilities WHERE client_user_id = ?',
        [user.id]
      );
      facilities = clientFacilities;
    } else if (user.role === 'admin') {
      const [allFacilities] = await connection.execute('SELECT * FROM facilities');
      facilities = allFacilities;
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        facilities: facilities.map(f => f.id)
      }
    });

    await connection.end();
  } catch (error) {
    logger.error('ユーザー情報取得エラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// パスワード変更
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // パスワードの強度チェック
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'パスワードは6文字以上である必要があります' });
    }
    
    // 現在のパスワードを確認
    const [users] = await pool.execute(
      'SELECT password_hash FROM users WHERE id = ?',
      [req.user.id]
    );
    
    const validPassword = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: '現在のパスワードが正しくありません' });
    }
    
    // 新しいパスワードをハッシュ化
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    
    // パスワードを更新
    await pool.execute(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [newPasswordHash, req.user.id]
    );
    
    res.json({ message: 'パスワードを変更しました' });
    logger.info(`パスワード変更: ${req.user.email}`);
  } catch (error) {
    logger.error('パスワード変更エラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// トークン検証
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// ===== ユーザー管理 =====
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, email, name, role, created_at, is_active FROM users'
    );
    
    // 各ユーザーの施設情報も取得
    for (const user of users) {
      if (user.role === 'staff') {
        const [facilities] = await pool.execute(
          `SELECT f.id, f.name FROM facilities f 
           JOIN staff_facilities sf ON f.id = sf.facility_id 
           WHERE sf.staff_user_id = ?`,
          [user.id]
        );
        user.facilities = facilities;
      } else if (user.role === 'client') {
        const [facilities] = await pool.execute(
          'SELECT id, name FROM facilities WHERE client_user_id = ?',
          [user.id]
        );
        user.facilities = facilities;
      } else {
        user.facilities = [];
      }
    }
    
    res.json(users);
  } catch (error) {
    logger.error('ユーザー取得エラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ユーザー作成（管理者のみ）
app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email, password, name, role, facilityIds = [] } = req.body;
    
    // バリデーション
    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: '必須項目を入力してください' });
    }
    
    if (!['staff', 'client', 'admin'].includes(role)) {
      return res.status(400).json({ error: '無効な役割です' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'パスワードは6文字以上である必要があります' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // ユーザーを作成
    const [result] = await pool.execute(
      'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
      [email, hashedPassword, name, role]
    );
    
    const userId = result.insertId;
    
    // スタッフの場合、施設を割り当て
    if (role === 'staff' && facilityIds.length > 0) {
      for (const facilityId of facilityIds) {
        await pool.execute(
          'INSERT INTO staff_facilities (staff_user_id, facility_id) VALUES (?, ?)',
          [userId, facilityId]
        );
      }
    }
    
    // クライアントの場合、施設を更新
    if (role === 'client' && facilityIds.length > 0) {
      for (const facilityId of facilityIds) {
        await pool.execute(
          'UPDATE facilities SET client_user_id = ? WHERE id = ?',
          [userId, facilityId]
        );
      }
    }
    
    res.status(201).json({ 
      id: userId, 
      email, 
      name, 
      role,
      message: 'ユーザーを作成しました'
    });
    
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

// ユーザー更新（管理者のみ）
app.put('/api/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, role, facilityIds, resetPassword, newPassword } = req.body;
    
    // ユーザー情報を更新
    await pool.execute(
      'UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?',
      [name, email, role, userId]
    );
    
    // パスワードリセット
    if (resetPassword && newPassword) {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await pool.execute(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [hashedPassword, userId]
      );
    }
    
    // スタッフの施設割り当てを更新
    if (role === 'staff') {
      // 既存の割り当てを削除
      await pool.execute(
        'DELETE FROM staff_facilities WHERE staff_user_id = ?',
        [userId]
      );
      
      // 新しい割り当てを追加
      if (facilityIds && facilityIds.length > 0) {
        for (const facilityId of facilityIds) {
          await pool.execute(
            'INSERT INTO staff_facilities (staff_user_id, facility_id) VALUES (?, ?)',
            [userId, facilityId]
          );
        }
      }
    }
    
    res.json({ message: 'ユーザー情報を更新しました' });
  } catch (error) {
    logger.error('ユーザー更新エラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
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
    const date = cleaningDate || new Date().toISOString().split('T')[0];
    
    // 既存のセッションをチェック
    const [existing] = await pool.execute(
      'SELECT id FROM cleaning_sessions WHERE facility_id = ? AND cleaning_date = ?',
      [facilityId, date]
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
        [facilityId, date, req.user.id, ventilationChecked, airFilterChecked]
      );
      res.status(201).json({ id: result.insertId, created: true });
    }
  } catch (error) {
    logger.error('セッション作成/更新エラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ===== 写真アップロード（改善版） =====
app.post('/api/photos/upload', authenticateToken, upload.array('photos', 20), async (req, res) => {
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
      if (/\.(jpg|jpeg|png|gif|webp)$/i.test(file.filename)) {
        const thumbDir = path.join(path.dirname(file.path), 'thumbnails');
        await ensureDir(thumbDir);
        
        thumbnailPath = path.join(thumbDir, `thumb_${file.filename}`);
        await sharp(file.path)
          .resize(300, 200, { fit: 'cover' })
          .toFile(thumbnailPath);
      }
      
      // データベースに記録
      const [result] = await pool.execute(
        'INSERT INTO photos (cleaning_session_id, file_path, thumbnail_path, type, file_size, original_name) VALUES (?, ?, ?, ?, ?, ?)',
        [actualSessionId, file.path, thumbnailPath, type, file.size, file.originalname]
      );
      
      // 相対パスを生成
      const relativePath = path.relative(STORAGE_ROOT, file.path);
      const relativeThumbPath = thumbnailPath ? path.relative(STORAGE_ROOT, thumbnailPath) : null;
      
      uploadedFiles.push({
        id: result.insertId,
        filename: file.filename,
        type: type,
        size: file.size,
        url: `/uploads/${relativePath.replace(/\\/g, '/')}`,
        thumbnailUrl: relativeThumbPath ? `/uploads/${relativeThumbPath.replace(/\\/g, '/')}` : null
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

// ===== テスト用アップロード（認証なし） =====
app.post('/api/photos/upload-test', upload.array('photos', 20), async (req, res) => {
  try {
    const { facilityId, type, date } = req.body;
    const uploadedFiles = [];

    logger.info(`テストアップロード開始: facilityId=${facilityId}, type=${type}, date=${date}, files=${req.files?.length || 0}`);

    // 各ファイルを処理（DBなし版）
    for (const file of req.files) {
      // 相対パスを生成
      const relativePath = path.relative(STORAGE_ROOT, file.path);

      uploadedFiles.push({
        filename: file.filename,
        type: type,
        size: file.size,
        path: file.path,
        url: `/uploads/${relativePath.replace(/\\/g, '/')}`
      });

      logger.info(`ファイル保存: ${file.path}`);
    }

    res.json({
      success: true,
      message: `${uploadedFiles.length}枚の写真をテストアップロードしました`,
      files: uploadedFiles
    });

  } catch (error) {
    logger.error('テストアップロードエラー:', error);
    res.status(500).json({ error: 'テストアップロードに失敗しました', details: error.message });
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
      
      // パスをURLに変換
      session.photos = photos.map(photo => ({
        ...photo,
        url: `/uploads/${path.relative(STORAGE_ROOT, photo.file_path).replace(/\\/g, '/')}`,
        thumbnailUrl: photo.thumbnail_path ? 
          `/uploads/${path.relative(STORAGE_ROOT, photo.thumbnail_path).replace(/\\/g, '/')}` : null
      }));
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

// ===== エラーハンドリング =====
app.use((err, req, res, next) => {
  logger.error('エラー:', err);
  res.status(500).json({ error: 'サーバーエラーが発生しました' });
});

// ===== サーバー起動 =====
async function startServer() {
  await initializeDatabase();
  
  // アップロードディレクトリを作成
  await ensureDir(STORAGE_ROOT);
  await ensureDir(path.join(STORAGE_ROOT, 'photos'));
  await ensureDir(path.join(STORAGE_ROOT, 'receipts'));
  
  app.listen(PORT, () => {
    logger.info(`サーバーが起動しました: http://localhost:${PORT}`);
    logger.info(`環境: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`ストレージ: ${STORAGE_ROOT}`);
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