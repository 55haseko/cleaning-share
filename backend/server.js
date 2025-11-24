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
const fsSync = require('fs');
const cron = require('node-cron');
const winston = require('winston');
const rateLimit = require('express-rate-limit');
const archiver = require('archiver');
require('dotenv').config();

// ===== 設定 =====
const app = express();
const PORT = process.env.PORT || 8000;
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
app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

// リクエストサイズ制限を拡大（バッチアップロード対応）
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

// アップロードエンドポイント用のレート制限（緩和）
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 200, // 200リクエスト（バッチアップロード対応: 20バッチ × 10リトライ想定）
  message: 'アップロードリクエストが多すぎます。しばらくお待ちください。'
});
app.use('/api/photos/upload', uploadLimiter);
app.use('/api/receipts/upload', uploadLimiter);

// ===== ファイルパス正規化関数 =====
/**
 * DBに保存されたファイルパスを正規化して相対URLパスに変換
 * 対応フォーマット:
 * - 絶対パス: /var/www/cleaning-share/backend/uploads/photos/... → photos/...
 * - 相対パス: uploads/photos/... → photos/...
 * - 旧形式: uploads_dev/photos/... → photos/...
 */
function normalizeFilePath(dbPath) {
  if (!dbPath) return '';

  let normalized = dbPath;

  // 絶対パスを相対パスに変換
  normalized = normalized.replace(/^.*\/uploads\//, '');

  // 旧形式（uploads_dev）を処理
  normalized = normalized.replace(/^uploads_dev\//, '');

  // Windowsパスセパレータを正規化
  normalized = normalized.replace(/\\/g, '/');

  return normalized;
}

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
    // MIMEタイプで判定（拡張子ではなく実際のファイル形式を見る）
    // HEIC/HEIF対応: browser-image-compressionがHEIC→JPEGに変換するはず
    // ただし、念のためバックエンド側でもHEICを受け入れ、JPEG変換処理を行う
    logger.info(`[写真フィルタ] ファイル処理開始: ${file.originalname}, MIME: ${file.mimetype}`);
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];

    if (allowedMimeTypes.includes(file.mimetype)) {
      logger.info(`[写真フィルタ] ファイル許可: ${file.originalname}`);
      return cb(null, true);
    } else {
      logger.error(`[写真フィルタ] ファイル拒否: ${file.originalname}, MIME: ${file.mimetype}`);
      cb(new Error(`画像ファイル（JPEG, PNG, GIF, WebP, HEIC）のみアップロード可能です。受信: ${file.mimetype}`));
    }
  }
});

// ===== 領収書用Multer設定 =====
const receiptStorage = multer.diskStorage({
  destination: async function (req, file, cb) {
    const { facilityId, month } = req.body;
    // month は YYYY-MM 形式
    const targetMonth = month || new Date().toISOString().substring(0, 7);

    // ディレクトリ構造: uploads_dev/receipts/{facility_id}/{YYYY-MM}/
    const uploadPath = path.join(STORAGE_ROOT, 'receipts', facilityId.toString(), targetMonth);

    try {
      await ensureDir(uploadPath);
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: function (req, file, cb) {
    const { facilityId, month } = req.body;
    const targetMonth = (month || new Date().toISOString().substring(0, 7)).replace(/-/g, ''); // YYYYMM
    const uuid = require('crypto').randomUUID().substring(0, 8);
    const ext = path.extname(file.originalname).toLowerCase();

    // ファイル命名: fac-{id}_{YYYYMM}_receipt_{uuid}.{ext}
    const filename = `fac-${facilityId}_${targetMonth}_receipt_${uuid}${ext}`;
    cb(null, filename);
  }
});

const receiptUpload = multer({
  storage: receiptStorage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB制限
  },
  fileFilter: (req, file, cb) => {
    // PDF、画像ファイルを許可
    if (/\.(pdf|jpg|jpeg|png|gif|webp)$/i.test(file.originalname)) {
      return cb(null, true);
    } else {
      cb(new Error('PDF、または画像ファイル（JPEG, PNG, GIF, WebP）のみアップロード可能です'));
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
    
    // ユーザーに関連する施設を取得（削除済みを除外）
    let facilities = [];
    if (user.role === 'staff') {
      // スタッフは全施設にアクセス可能（削除済みを除く）
      const [allFacilities] = await connection.execute('SELECT * FROM facilities WHERE is_deleted = FALSE');
      facilities = allFacilities;
    } else if (user.role === 'client') {
      const [clientFacilities] = await connection.execute(
        'SELECT * FROM facilities WHERE client_user_id = ? AND is_deleted = FALSE',
        [user.id]
      );
      facilities = clientFacilities;
    } else if (user.role === 'admin') {
      const [allFacilities] = await connection.execute('SELECT * FROM facilities WHERE is_deleted = FALSE');
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
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }

    const user = users[0];

    // ユーザーに関連する施設を取得（削除済みを除外）
    let facilities = [];
    if (user.role === 'staff') {
      // スタッフは全施設にアクセス可能（削除済みを除く）
      const [allFacilities] = await connection.execute('SELECT * FROM facilities WHERE is_deleted = FALSE');
      facilities = allFacilities;
    } else if (user.role === 'client') {
      const [clientFacilities] = await connection.execute(
        'SELECT * FROM facilities WHERE client_user_id = ? AND is_deleted = FALSE',
        [user.id]
      );
      facilities = clientFacilities;
    } else if (user.role === 'admin') {
      const [allFacilities] = await connection.execute('SELECT * FROM facilities WHERE is_deleted = FALSE');
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
        // スタッフは全施設にアクセス可能（削除済みを除く）
        const [facilities] = await pool.execute(
          'SELECT id, name FROM facilities WHERE is_deleted = FALSE'
        );
        user.facilities = facilities;
      } else if (user.role === 'client') {
        const [facilities] = await pool.execute(
          'SELECT id, name FROM facilities WHERE client_user_id = ? AND is_deleted = FALSE',
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

// パスワードリセット（管理者のみ）
app.put('/api/users/:userId/reset-password', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    // バリデーション
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'パスワードは6文字以上である必要があります' });
    }

    // ユーザーが存在するかチェック
    const [users] = await pool.execute(
      'SELECT id FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }

    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // パスワードを更新
    await pool.execute(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [hashedPassword, userId]
    );

    res.json({ message: 'パスワードをリセットしました' });
    logger.info(`パスワードリセット: ユーザーID=${userId}`);
  } catch (error) {
    logger.error('パスワードリセットエラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ユーザー削除
app.delete('/api/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { userId } = req.params;

    await connection.beginTransaction();

    // ユーザーが存在するかチェック
    const [users] = await connection.execute(
      'SELECT id, role FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }

    // 自分自身は削除できない
    if (parseInt(userId) === req.user.id) {
      await connection.rollback();
      return res.status(400).json({ error: '自分自身を削除することはできません' });
    }

    // 関連データを削除（外部キー制約に応じて）
    // staff_facilitiesテーブルから削除
    await connection.execute(
      'DELETE FROM staff_facilities WHERE staff_user_id = ?',
      [userId]
    );

    // スタッフが作成した清掃記録は残すが、staff_user_idをNULLに設定
    await connection.execute(
      'UPDATE cleaning_sessions SET staff_user_id = NULL WHERE staff_user_id = ?',
      [userId]
    );

    // 領収書のuploaded_byをNULLに設定（photosテーブルにはuploaded_byカラムが存在しない）
    await connection.execute(
      'UPDATE receipts SET uploaded_by = NULL WHERE uploaded_by = ?',
      [userId]
    );

    // ユーザーを削除
    await connection.execute(
      'DELETE FROM users WHERE id = ?',
      [userId]
    );

    await connection.commit();

    res.json({ message: 'ユーザーを削除しました' });
    logger.info(`ユーザー削除: ユーザーID=${userId}`);
  } catch (error) {
    await connection.rollback();
    logger.error('ユーザー削除エラー:', error);
    res.status(500).json({ error: 'ユーザーの削除に失敗しました' });
  } finally {
    connection.release();
  }
});

// ===== 施設管理 =====
app.get('/api/facilities', authenticateToken, async (req, res) => {
  try {
    let query;
    let params = [];

    if (req.user.role === 'admin') {
      query = 'SELECT * FROM facilities WHERE is_deleted = FALSE';
    } else if (req.user.role === 'client') {
      query = 'SELECT * FROM facilities WHERE client_user_id = ? AND is_deleted = FALSE';
      params = [req.user.id];
    } else if (req.user.role === 'staff') {
      // スタッフは全施設にアクセス可能（削除済みを除く）
      query = 'SELECT * FROM facilities WHERE is_deleted = FALSE';
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

// 施設更新（管理者のみ）
app.put('/api/facilities/:facilityId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { facilityId } = req.params;
    const { name, address, client_user_id } = req.body;

    // バリデーション
    if (!name) {
      return res.status(400).json({ error: '施設名は必須です' });
    }

    // 施設が存在するかチェック（削除済みを除外）
    const [existing] = await pool.execute(
      'SELECT id FROM facilities WHERE id = ? AND is_deleted = FALSE',
      [facilityId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: '施設が見つかりません' });
    }

    // 施設情報を更新
    await pool.execute(
      'UPDATE facilities SET name = ?, address = ?, client_user_id = ? WHERE id = ?',
      [name, address, client_user_id || null, facilityId]
    );

    res.json({
      id: parseInt(facilityId),
      name,
      address,
      client_user_id,
      message: '施設情報を更新しました'
    });
    logger.info(`施設更新: ID=${facilityId}, ${name}`);
  } catch (error) {
    logger.error('施設更新エラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// 施設削除（管理者のみ、論理削除）
app.delete('/api/facilities/:facilityId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { facilityId } = req.params;

    // 施設が存在するかチェック
    const [existing] = await pool.execute(
      'SELECT id, name FROM facilities WHERE id = ? AND is_deleted = FALSE',
      [facilityId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: '施設が見つかりません' });
    }

    // 施設を論理削除（is_deleted = TRUEに設定）
    await pool.execute(
      'UPDATE facilities SET is_deleted = TRUE WHERE id = ?',
      [facilityId]
    );

    // スタッフ施設の関連も削除
    await pool.execute(
      'DELETE FROM staff_facilities WHERE facility_id = ?',
      [facilityId]
    );

    res.json({ message: '施設を削除しました' });
    logger.info(`施設論理削除: ID=${facilityId}, ${existing[0].name}`);
  } catch (error) {
    logger.error('施設削除エラー:', error);
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
// multerエラーハンドリング用ミドルウェア
const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    logger.error('Multerエラー:', err.message);
    if (err.code === 'FILE_TOO_LARGE') {
      return res.status(400).json({ error: 'ファイルサイズが大きすぎます（最大20MB）' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: '一度にアップロードできるファイル数を超えています' });
    }
    return res.status(400).json({ error: `ファイルアップロードエラー: ${err.message}` });
  } else if (err instanceof Error) {
    logger.error('ファイルバリデーションエラー:', err.message);
    return res.status(400).json({ error: err.message });
  }
  next();
};

app.post('/api/photos/upload', authenticateToken, (req, res, next) => {
  upload.array('photos', 200)(req, res, (err) => {
    if (err) {
      logger.error('写真アップロード - multerエラー:', err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'FILE_TOO_LARGE') {
          return res.status(400).json({ error: 'ファイルサイズが大きすぎます（最大20MB）' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ error: '一度にアップロードできるファイル数を超えています' });
        }
        return res.status(400).json({ error: `ファイルアップロードエラー: ${err.message}` });
      } else if (err instanceof Error) {
        // fileFilterで発生したエラー（ファイル形式の検証など）
        logger.error('ファイルバリデーションエラー:', err.message);
        return res.status(400).json({ error: err.message });
      }
      return res.status(500).json({ error: 'アップロード処理中にエラーが発生しました' });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { facilityId, sessionId, type } = req.body;
    const uploadedFiles = [];

    // ファイルが無い場合はエラー
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'アップロードするファイルがありません' });
    }

    logger.info(`写真アップロード開始: facilityId=${facilityId}, 枚数=${req.files.length}, type=${type}`);

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
      logger.info(`ファイル処理中: ${file.originalname} (${file.size}bytes, mimetype: ${file.mimetype})`);

      let finalFilePath = file.path;
      let finalFileName = file.filename;
      let fileSize = file.size;

      // HEIC/HEIFをJPEGに変換
      if (file.mimetype === 'image/heic' || file.mimetype === 'image/heif') {
        try {
          logger.info(`HEIC→JPEG変換開始: ${file.originalname}`);
          // HEIC→JPEG変換
          const jpegFileName = file.filename.replace(/\.(heic|heif)$/i, '.jpeg');
          const jpegPath = path.join(path.dirname(file.path), jpegFileName);

          await sharp(file.path)
            .toFormat('jpeg')
            .toFile(jpegPath);

          // 元のHEICファイルを削除
          await fs.unlink(file.path);

          // 変換後のファイル情報を使用
          finalFilePath = jpegPath;
          finalFileName = jpegFileName;

          // 変換後のファイルサイズを取得
          const stats = await fs.stat(jpegPath);
          fileSize = stats.size;

          logger.info(`HEIC→JPEG変換完了: ${jpegFileName} (${fileSize}bytes)`);
        } catch (error) {
          logger.error(`HEIC→JPEG変換失敗: ${file.originalname}`, error);
          // 変換失敗時は元のファイルを使用
          finalFilePath = file.path;
          finalFileName = file.filename;
        }
      }

      // サムネイル生成（画像の場合）
      let thumbnailPath = null;
      if (/\.(jpg|jpeg|png|gif|webp)$/i.test(finalFileName)) {
        try {
          const thumbDir = path.join(path.dirname(finalFilePath), 'thumbnails');
          await ensureDir(thumbDir);

          thumbnailPath = path.join(thumbDir, `thumb_${finalFileName}`);
          await sharp(finalFilePath)
            .resize(300, 200, { fit: 'cover' })
            .jpeg({ quality: 80 })
            .toFile(thumbnailPath);

          logger.info(`サムネイル生成完了: ${finalFileName}`);
        } catch (error) {
          logger.error(`サムネイル生成失敗: ${finalFileName}`, error);
          // サムネイル生成失敗時は続行
          thumbnailPath = null;
        }
      }

      // 相対パスを先に生成
      const relativePath = path.relative(STORAGE_ROOT, finalFilePath);
      const relativeThumbPath = thumbnailPath ? path.relative(STORAGE_ROOT, thumbnailPath) : null;

      // データベースに相対パスを記録（URLで使用しやすいように）
      const [result] = await pool.execute(
        'INSERT INTO photos (cleaning_session_id, file_path, thumbnail_path, type, file_size, original_name) VALUES (?, ?, ?, ?, ?, ?)',
        [actualSessionId, `uploads/${relativePath.replace(/\\/g, '/')}`, relativeThumbPath ? `uploads/${relativeThumbPath.replace(/\\/g, '/')}` : null, type, fileSize, file.originalname]
      );

      uploadedFiles.push({
        id: result.insertId,
        filename: file.filename,
        type: type,
        size: file.size,
        url: `/uploads/${relativePath.replace(/\\/g, '/')}`,
        thumbnailUrl: relativeThumbPath ? `/uploads/${relativeThumbPath.replace(/\\/g, '/')}` : null,
        file_path: relativePath.replace(/\\/g, '/'),
        thumbnail_path: relativeThumbPath ? relativeThumbPath.replace(/\\/g, '/') : null
      });
    }

    res.json({
      success: true,
      sessionId: actualSessionId,
      files: uploadedFiles,
      message: `${uploadedFiles.length}枚の写真をアップロードしました`
    });

    logger.info(`写真アップロード完了: 施設${facilityId}, ${uploadedFiles.length}枚`);
  } catch (error) {
    logger.error('写真アップロードエラー:', error);
    res.status(500).json({ error: `サーバーエラーが発生しました: ${error.message}` });
  }
});

// ===== 領収書管理 =====
// 領収書一覧取得
app.get('/api/receipts/:facilityId', authenticateToken, async (req, res) => {
  try {
    const { facilityId } = req.params;
    const { month } = req.query;

    // 権限チェック: adminまたは該当施設のclient/staff
    if (req.user.role !== 'admin') {
      if (req.user.role === 'client') {
        const [facilities] = await pool.execute(
          'SELECT id FROM facilities WHERE id = ? AND client_user_id = ? AND is_deleted = FALSE',
          [facilityId, req.user.id]
        );
        if (facilities.length === 0) {
          return res.status(403).json({ error: 'この施設の領収書を閲覧する権限がありません' });
        }
      }
      // スタッフは全施設にアクセス可能なので権限チェック不要
    }

    let query = `
      SELECT
        r.id,
        r.facility_id,
        r.month,
        r.file_path,
        r.file_size,
        r.original_name,
        r.uploaded_at,
        r.uploaded_by,
        u.name as uploaded_by_name
      FROM receipts r
      LEFT JOIN users u ON r.uploaded_by = u.id
      WHERE r.facility_id = ?
    `;
    const params = [facilityId];

    if (month) {
      query += ' AND r.month = ?';
      params.push(month);
    }

    query += ' ORDER BY r.month DESC, r.uploaded_at DESC';

    const [receipts] = await pool.execute(query, params);

    // パスをURLに変換
    // DBから取得したパスがすでに "uploads/receipts/..." 形式なので
    // そのまま /uploads 以下に配置する URLとして返す
    const receiptsWithUrls = receipts.map(receipt => {
      const dbPath = receipt.file_path || '';
      return {
        ...receipt,
        url: `/${dbPath}`
      };
    });

    res.json(receiptsWithUrls);
  } catch (error) {
    logger.error('領収書一覧取得エラー:', error);
    res.status(500).json({ error: '領収書の取得に失敗しました' });
  }
});

// 領収書アップロード
app.post('/api/receipts/upload', authenticateToken, receiptUpload.array('receipts', 200), async (req, res) => {
  try {
    const { facilityId, sessionId, month } = req.body;
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
      // データベースに記録（receiptsテーブルに保存）
      const [result] = await pool.execute(
        'INSERT INTO receipts (cleaning_session_id, facility_id, month, file_path, file_size, original_name, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [actualSessionId, facilityId, month || new Date().toISOString().substring(0, 7), file.path, file.size, file.originalname, req.user.id]
      );

      // 相対パスを生成
      const relativePath = path.relative(STORAGE_ROOT, file.path);

      uploadedFiles.push({
        id: result.insertId,
        filename: file.filename,
        size: file.size,
        originalName: file.originalname,
        url: `/uploads/${relativePath.replace(/\\/g, '/')}`,
        file_path: relativePath.replace(/\\/g, '/')
      });
    }

    res.json({
      success: true,
      sessionId: actualSessionId,
      files: uploadedFiles,
      message: `${uploadedFiles.length}件の領収書をアップロードしました`
    });

    logger.info(`領収書アップロード: 施設${facilityId}, ${uploadedFiles.length}件`);
  } catch (error) {
    logger.error('領収書アップロードエラー:', error);
    res.status(500).json({ error: '領収書のアップロードに失敗しました', details: error.message });
  }
});

// ===== 月次点検保存 =====
app.post('/api/monthly-checks/save', authenticateToken, async (req, res) => {
  try {
    const { facilityId, sessionId, ventilation, airFilter } = req.body;

    // セッションIDを取得または作成
    let actualSessionId = sessionId;
    if (!actualSessionId) {
      const [result] = await pool.execute(
        'INSERT INTO cleaning_sessions (facility_id, cleaning_date, staff_user_id) VALUES (?, CURDATE(), ?)',
        [facilityId, req.user.id]
      );
      actualSessionId = result.insertId;
    }

    // 月次点検項目を更新
    await pool.execute(
      'UPDATE cleaning_sessions SET ventilation_checked = ?, air_filter_checked = ? WHERE id = ?',
      [ventilation ? 1 : 0, airFilter ? 1 : 0, actualSessionId]
    );

    res.json({
      success: true,
      sessionId: actualSessionId,
      message: '月次点検を保存しました',
      checks: {
        ventilation,
        airFilter
      }
    });

    logger.info(`月次点検保存: セッション${actualSessionId}, 換気扇=${ventilation}, エアコン=${airFilter}`);
  } catch (error) {
    logger.error('月次点検保存エラー:', error);
    res.status(500).json({ error: '月次点検の保存に失敗しました', details: error.message });
  }
});

// 写真削除エンドポイント（管理者のみ）
app.delete('/api/photos/:photoId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { photoId } = req.params;

    // 写真情報を取得
    const [photos] = await pool.execute(
      'SELECT file_path, thumbnail_path FROM photos WHERE id = ?',
      [photoId]
    );

    if (photos.length === 0) {
      return res.status(404).json({ error: '写真が見つかりません' });
    }

    const photo = photos[0];

    // ファイルを削除
    try {
      if (photo.file_path && fsSync.existsSync(photo.file_path)) {
        await fs.unlink(photo.file_path);
      }
      if (photo.thumbnail_path && fsSync.existsSync(photo.thumbnail_path)) {
        await fs.unlink(photo.thumbnail_path);
      }
    } catch (fileError) {
      logger.error('ファイル削除エラー:', fileError);
    }

    // DBから削除
    await pool.execute('DELETE FROM photos WHERE id = ?', [photoId]);

    res.json({ message: '写真を削除しました' });
    logger.info(`写真削除: photoId=${photoId}`);
  } catch (error) {
    logger.error('写真削除エラー:', error);
    res.status(500).json({ error: '写真の削除に失敗しました' });
  }
});

// セッション（アルバム）削除エンドポイント（管理者のみ）
app.delete('/api/sessions/:sessionId', authenticateToken, requireAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { sessionId } = req.params;

    await connection.beginTransaction();

    // セッションに紐づく写真を取得
    const [photos] = await connection.execute(
      'SELECT file_path, thumbnail_path FROM photos WHERE cleaning_session_id = ?',
      [sessionId]
    );

    // 写真ファイルを削除
    for (const photo of photos) {
      try {
        if (photo.file_path && fsSync.existsSync(photo.file_path)) {
          await fs.unlink(photo.file_path);
        }
        if (photo.thumbnail_path && fsSync.existsSync(photo.thumbnail_path)) {
          await fs.unlink(photo.thumbnail_path);
        }
      } catch (fileError) {
        logger.error('ファイル削除エラー:', fileError);
      }
    }

    // DBから写真を削除
    await connection.execute(
      'DELETE FROM photos WHERE cleaning_session_id = ?',
      [sessionId]
    );

    // 領収書も削除
    const [receipts] = await connection.execute(
      'SELECT file_path FROM receipts WHERE cleaning_session_id = ?',
      [sessionId]
    );

    for (const receipt of receipts) {
      try {
        if (receipt.file_path && fsSync.existsSync(receipt.file_path)) {
          await fs.unlink(receipt.file_path);
        }
      } catch (fileError) {
        logger.error('領収書ファイル削除エラー:', fileError);
      }
    }

    await connection.execute(
      'DELETE FROM receipts WHERE cleaning_session_id = ?',
      [sessionId]
    );

    // セッションを削除
    await connection.execute(
      'DELETE FROM cleaning_sessions WHERE id = ?',
      [sessionId]
    );

    await connection.commit();

    res.json({ message: 'アルバムを削除しました' });
    logger.info(`アルバム削除: sessionId=${sessionId}, 写真数=${photos.length}`);
  } catch (error) {
    await connection.rollback();
    logger.error('アルバム削除エラー:', error);
    res.status(500).json({ error: 'アルバムの削除に失敗しました' });
  } finally {
    connection.release();
  }
});

// ===== 月次点検状態取得 =====
app.get('/api/monthly-checks/:facilityId', authenticateToken, async (req, res) => {
  try {
    const { facilityId } = req.params;
    const { month } = req.query; // YYYY-MM形式

    // 指定された月のセッション情報を取得
    const startDate = month ? `${month}-01` : new Date().toISOString().split('T')[0].substring(0, 8) + '01';
    const endDate = month
      ? new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 0).toISOString().split('T')[0]
      : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

    const [sessions] = await pool.execute(
      `SELECT id, cleaning_date, ventilation_checked, air_filter_checked, staff_user_id
       FROM cleaning_sessions
       WHERE facility_id = ? AND cleaning_date BETWEEN ? AND ?
       ORDER BY cleaning_date DESC`,
      [facilityId, startDate, endDate]
    );

    // 月次点検が完了しているかチェック
    const hasVentilationCheck = sessions.some(s => s.ventilation_checked);
    const hasAirFilterCheck = sessions.some(s => s.air_filter_checked);

    res.json({
      facilityId: parseInt(facilityId),
      month: month || new Date().toISOString().substring(0, 7),
      checks: {
        ventilation: hasVentilationCheck,
        airFilter: hasAirFilterCheck
      },
      sessions: sessions.map(s => ({
        id: s.id,
        date: s.cleaning_date,
        ventilationChecked: Boolean(s.ventilation_checked),
        airFilterChecked: Boolean(s.air_filter_checked)
      }))
    });
  } catch (error) {
    logger.error('月次点検取得エラー:', error);
    res.status(500).json({ error: '月次点検の取得に失敗しました' });
  }
});

// ===== テスト用アップロード（認証なし） =====
app.post('/api/photos/upload-test', upload.array('photos', 200), async (req, res) => {
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
        url: `/uploads/${relativePath.replace(/\\/g, '/')}`,
        file_path: relativePath.replace(/\\/g, '/')
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

// ===== テスト用アルバム取得（認証なし） =====
app.get('/api/albums-test/:facilityId', async (req, res) => {
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

      // パスをURLに変換（正規化関数を使用）
      session.photos = photos.map(photo => {
        // DBから取得したパスがすでに "uploads/photos/..." 形式なので
        // そのまま /uploads 以下に配置する URLとして返す
        const dbPath = photo.file_path || '';
        const dbThumbPath = photo.thumbnail_path || '';

        return {
          ...photo,
          url: `/${dbPath}`,
          thumbnailUrl: dbThumbPath ? `/${dbThumbPath}` : null
        };
      });
    }

    res.json(sessions);
  } catch (error) {
    logger.error('テストアルバム取得エラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました', details: error.message });
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
      
      // パスをURLに変換（正規化関数を使用）
      session.photos = photos.map(photo => {
        // DBから取得したパスがすでに "uploads/photos/..." 形式なので
        // そのまま /uploads 以下に配置する URLとして返す
        const dbPath = photo.file_path || '';
        const dbThumbPath = photo.thumbnail_path || '';

        return {
          ...photo,
          url: `/${dbPath}`,
          thumbnailUrl: dbThumbPath ? `/${dbThumbPath}` : null
        };
      });
    }
    
    res.json(sessions);
  } catch (error) {
    logger.error('アルバム取得エラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// アルバムの写真を一括ダウンロード（ZIP）
app.get('/api/albums/:facilityId/:sessionId/download', authenticateToken, async (req, res) => {
  try {
    const { facilityId, sessionId } = req.params;

    logger.info(`ダウンロード試行: userId=${req.user.id}, role=${req.user.role}, facilityId=${facilityId}, sessionId=${sessionId}`);

    // 権限チェック：admin、またはfacilityのclient/staff
    if (req.user.role !== 'admin') {
      if (req.user.role === 'client') {
        const [facilities] = await pool.execute(
          'SELECT id FROM facilities WHERE id = ? AND client_user_id = ? AND is_deleted = FALSE',
          [facilityId, req.user.id]
        );
        logger.info(`クライアント権限チェック: facilityId=${facilityId}, userId=${req.user.id}, 結果=${facilities.length}件`);
        if (facilities.length === 0) {
          logger.warn(`ダウンロード権限なし: userId=${req.user.id}, facilityId=${facilityId}`);
          return res.status(403).json({ error: 'この施設の写真をダウンロードする権限がありません' });
        }
      }
      // スタッフは全施設にアクセス可能なので権限チェック不要
    }

    // セッション情報と写真を取得
    const [sessions] = await pool.execute(
      'SELECT cs.*, f.name as facility_name FROM cleaning_sessions cs JOIN facilities f ON cs.facility_id = f.id WHERE cs.id = ? AND cs.facility_id = ? AND f.is_deleted = FALSE',
      [sessionId, facilityId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({ error: 'アルバムが見つかりません' });
    }

    const session = sessions[0];

    // 写真を取得
    const [photos] = await pool.execute(
      'SELECT id, type, file_path, original_name FROM photos WHERE cleaning_session_id = ?',
      [sessionId]
    );

    if (photos.length === 0) {
      return res.status(404).json({ error: '写真が見つかりません' });
    }

    // ZIPファイル名を生成
    const date = new Date(session.cleaning_date).toISOString().split('T')[0];
    const zipFilename = `${session.facility_name}_${date}_photos.zip`.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

    // レスポンスヘッダーを設定
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipFilename)}"`);

    // archiverでZIPを作成
    const archive = archiver('zip', {
      zlib: { level: 6 } // 圧縮レベル
    });

    // エラーハンドリング
    archive.on('error', (err) => {
      logger.error('ZIP作成エラー:', err);
      res.status(500).json({ error: 'ZIPファイルの作成に失敗しました' });
    });

    // アーカイブをレスポンスにパイプ
    archive.pipe(res);

    // 写真をZIPに追加
    for (const photo of photos) {
      const filePath = photo.file_path;

      // ファイルが存在するか確認
      if (fsSync.existsSync(filePath)) {
        const fileName = `${photo.type}_${photo.id}_${photo.original_name || path.basename(filePath)}`;
        archive.file(filePath, { name: fileName });
      }
    }

    // ZIPを確定して送信
    await archive.finalize();

    logger.info(`写真一括ダウンロード: sessionId=${sessionId}, 写真数=${photos.length}`);
  } catch (error) {
    logger.error('写真一括ダウンロードエラー:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'ダウンロードに失敗しました' });
    }
  }
});

// ===== 月次チェック管理 =====
// 月次チェック状況取得
app.get('/api/monthly-checks', authenticateToken, async (req, res) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    let query;
    let params = [];

    if (req.user.role === 'admin' || req.user.role === 'staff') {
      // 管理者・スタッフ：全施設の月次チェック状況
      query = `
        SELECT
          f.id as facility_id,
          f.name as facility_name,
          f.address,
          MAX(CASE WHEN cs.ventilation_checked = 1 AND DATE_FORMAT(cs.cleaning_date, '%Y-%m') = ? THEN cs.cleaning_date END) as last_ventilation_check,
          MAX(CASE WHEN cs.air_filter_checked = 1 AND DATE_FORMAT(cs.cleaning_date, '%Y-%m') = ? THEN cs.cleaning_date END) as last_air_filter_check,
          (MAX(CASE WHEN cs.ventilation_checked = 1 AND DATE_FORMAT(cs.cleaning_date, '%Y-%m') = ? THEN 1 ELSE 0 END)) as ventilation_done,
          (MAX(CASE WHEN cs.air_filter_checked = 1 AND DATE_FORMAT(cs.cleaning_date, '%Y-%m') = ? THEN 1 ELSE 0 END)) as air_filter_done
        FROM facilities f
        LEFT JOIN cleaning_sessions cs ON f.id = cs.facility_id
        GROUP BY f.id, f.name, f.address
        ORDER BY f.name
      `;
      params = [currentMonth, currentMonth, currentMonth, currentMonth];
    } else {
      return res.status(403).json({ error: 'アクセス権限がありません' });
    }

    const [results] = await pool.execute(query, params);

    res.json({
      month: currentMonth,
      facilities: results
    });
  } catch (error) {
    logger.error('月次チェック状況取得エラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// 月次チェック統計（管理者用）
app.get('/api/monthly-checks/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    // 施設総数
    const [totalFacilities] = await pool.execute('SELECT COUNT(*) as count FROM facilities');

    // 換気扇チェック完了数
    const [ventilationDone] = await pool.execute(`
      SELECT COUNT(DISTINCT facility_id) as count
      FROM cleaning_sessions
      WHERE ventilation_checked = 1 AND DATE_FORMAT(cleaning_date, '%Y-%m') = ?
    `, [currentMonth]);

    // エアコンフィルターチェック完了数
    const [airFilterDone] = await pool.execute(`
      SELECT COUNT(DISTINCT facility_id) as count
      FROM cleaning_sessions
      WHERE air_filter_checked = 1 AND DATE_FORMAT(cleaning_date, '%Y-%m') = ?
    `, [currentMonth]);

    // 両方完了の施設数
    const [bothDone] = await pool.execute(`
      SELECT COUNT(*) as count FROM (
        SELECT facility_id
        FROM cleaning_sessions
        WHERE DATE_FORMAT(cleaning_date, '%Y-%m') = ?
        GROUP BY facility_id
        HAVING MAX(ventilation_checked) = 1 AND MAX(air_filter_checked) = 1
      ) as completed_facilities
    `, [currentMonth]);

    res.json({
      month: currentMonth,
      total_facilities: totalFacilities[0].count,
      ventilation_completed: ventilationDone[0].count,
      air_filter_completed: airFilterDone[0].count,
      both_completed: bothDone[0].count,
      completion_rate: {
        ventilation: Math.round((ventilationDone[0].count / totalFacilities[0].count) * 100),
        air_filter: Math.round((airFilterDone[0].count / totalFacilities[0].count) * 100),
        both: Math.round((bothDone[0].count / totalFacilities[0].count) * 100)
      }
    });
  } catch (error) {
    logger.error('月次チェック統計取得エラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ===== 統計情報 =====
app.get('/api/stats/daily', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 今日のアップロード数（セッション数）
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

    // 今日の失敗数（仮: 実装により異なる）
    // ここでは0として返す（将来的にエラーログテーブルから取得）
    const failures = 0;

    res.json({
      date: today,
      uploads: uploads[0].count,
      facilities: facilities[0].count,
      photos: photos[0].count,
      failures: failures
    });
  } catch (error) {
    logger.error('統計取得エラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// 最近のアップロード履歴取得（管理者用）
app.get('/api/stats/recent-uploads', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // 最近のアップロード履歴を取得
    const [uploads] = await pool.query(
      `SELECT
        cs.id,
        cs.facility_id,
        cs.cleaning_date,
        cs.created_at as uploaded_at,
        f.name as facility_name,
        u.name as staff_name,
        (SELECT COUNT(*) FROM photos p WHERE p.cleaning_session_id = cs.id) as photo_count
      FROM cleaning_sessions cs
      JOIN facilities f ON cs.facility_id = f.id
      LEFT JOIN users u ON cs.staff_user_id = u.id
      ORDER BY cs.created_at DESC
      LIMIT ?`,
      [limit]
    );

    res.json(uploads);
  } catch (error) {
    logger.error('最近のアップロード取得エラー:', error);
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
  
  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`サーバーが起動しました: http://localhost:${PORT}`);
    logger.info(`外部アクセス用: http://192.168.137.97:${PORT}`);
    logger.info(`環境: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`ストレージ: ${STORAGE_ROOT}`);
  });

  // タイムアウト設定（バッチアップロード対応）
  server.timeout = 120000; // 120秒（2分）
  server.keepAliveTimeout = 65000; // 65秒
  server.headersTimeout = 66000; // 66秒
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