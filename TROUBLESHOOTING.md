# トラブルシューティングガイド

## よくある問題と解決方法

### 🔴 ログインできない

#### 原因1: フロントエンドとバックエンドのURL設定ミス

**症状**:
```
Failed to load resource: net::ERR_CONNECTION_TIMED_OUT
API Error: TypeError: Failed to fetch
```

**解決方法**:

1. バックエンドの `.env` を確認:
```bash
cat backend/.env | grep CORS_ORIGIN
# 出力: CORS_ORIGIN=http://localhost:3000
```

2. フロントエンドの `.env` を確認:
```bash
cat frontend/.env | grep REACT_APP_API_URL
# 出力: REACT_APP_API_URL=http://localhost:4000/api
```

3. 設定を修正したら、両方のサーバーを再起動:
```bash
./stop.sh
./start.sh
```

#### 原因2: パスワードが間違っている

**デフォルトのログイン情報**:
- 管理者: `admin@cleaning.com` / `admin123`
- スタッフ: `staff1@cleaning.com` / `staff123`
- クライアント: `client1@example.com` / `client123`

### 🔴 ポートが既に使用されている

**症状**:
```
Error: listen EADDRINUSE: address already in use :::4000
```

**解決方法**:

```bash
# ポート使用中のプロセスを確認
lsof -ti:4000
lsof -ti:3000

# プロセスを停止
kill $(lsof -ti:4000)
kill $(lsof -ti:3000)

# または停止スクリプトを使用
./stop.sh
```

### 🔴 データベース接続エラー

**症状**:
```
Error: ER_ACCESS_DENIED_ERROR: Access denied for user 'cleaning_user'@'localhost'
```

**解決方法**:

1. MySQLサービスが起動しているか確認:
```bash
# macOS
brew services list | grep mysql

# 起動していない場合
brew services start mysql
```

2. データベースとユーザーを作成:
```bash
mysql -u root -p

# MySQL内で実行
CREATE DATABASE IF NOT EXISTS cleaning_system;
CREATE USER IF NOT EXISTS 'cleaning_user'@'localhost' IDENTIFIED BY 'strongpassword';
GRANT ALL PRIVILEGES ON cleaning_system.* TO 'cleaning_user'@'localhost';
FLUSH PRIVILEGES;
exit;
```

3. スキーマを適用:
```bash
mysql -u cleaning_user -pstrongpassword cleaning_system < backend/database_schema.sql
```

### 🔴 写真がアップロードできない

**症状**: アップロードボタンを押しても反応がない、またはエラーが出る

**解決方法**:

1. アップロードディレクトリの権限を確認:
```bash
ls -la backend/uploads_dev
# ディレクトリが存在しない場合は作成
mkdir -p backend/uploads_dev/photos
chmod 755 backend/uploads_dev
```

2. ファイルサイズの上限を確認:
```bash
cat backend/.env | grep MAX_FILE_MB
# デフォルト: 20MB
```

3. ブラウザのコンソールでエラーを確認（F12キー）

### 🔴 CORSエラー

**症状**:
```
Access to fetch at 'http://localhost:4000/api/...' from origin 'http://localhost:3000'
has been blocked by CORS policy
```

**解決方法**:

バックエンドの `.env` を修正:
```bash
CORS_ORIGIN=http://localhost:3000
```

サーバーを再起動:
```bash
./stop.sh
./start.sh
```

### 🔴 フロントエンドのコンパイルエラー

**症状**:
```
Module not found: Can't resolve '...'
```

**解決方法**:

1. node_modules を再インストール:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

2. キャッシュをクリア:
```bash
rm -rf frontend/build
rm -rf frontend/node_modules/.cache
```

### 🔴 バックエンドが起動しない

**症状**: `start.sh` を実行してもバックエンドが起動しない

**解決方法**:

1. ログを確認:
```bash
tail -f backend/backend.log
```

2. 依存関係を再インストール:
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

3. 環境変数を確認:
```bash
cat backend/.env
# 必要な変数がすべて設定されているか確認
```

## 🔍 デバッグ方法

### バックエンドのログ確認

```bash
# リアルタイムでログを監視
tail -f backend/backend.log
tail -f backend/combined.log

# エラーログのみ
tail -f backend/error.log
```

### フロントエンドのログ確認

```bash
# リアルタイムでログを監視
tail -f frontend/frontend.log
```

### データベースの状態確認

```bash
# MySQLに接続
mysql -u cleaning_user -pstrongpassword cleaning_system

# ユーザー一覧を確認
SELECT id, email, name, role FROM users;

# 施設一覧を確認
SELECT id, name, address FROM facilities;

# 写真のアップロード状況を確認
SELECT COUNT(*) as photo_count, facility_id, cleaning_date
FROM photos
GROUP BY facility_id, cleaning_date
ORDER BY cleaning_date DESC
LIMIT 10;
```

### ネットワーク接続の確認

```bash
# バックエンドAPIの健全性チェック
curl http://localhost:4000/api/health

# ログインAPIのテスト
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cleaning.com","password":"admin123"}'
```

## 📞 サポート

上記の方法で解決しない場合は、以下の情報を添えてお問い合わせください：

1. エラーメッセージの全文
2. ブラウザのコンソールログ（F12キー → Console）
3. バックエンドのログ（`backend/backend.log`）
4. 実行環境（OS、Node.jsバージョン、MySQLバージョン）

```bash
# 環境情報の確認
node --version
npm --version
mysql --version
```
