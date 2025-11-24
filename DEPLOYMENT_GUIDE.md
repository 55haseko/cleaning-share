# VPSデプロイメントガイド

清掃写真・領収書共有システムをVPS上で起動させるための完全ガイド

## 前提条件

- VPS（Ubuntu 20.04/22.04 または CentOS 8推奨）
- root または sudo 権限を持つユーザー
- ドメイン名（オプション、IPアドレスでも可）

---

## ステップ1: VPSの初期セットアップ

### 1.1 VPSにSSH接続

```bash
ssh root@your-vps-ip
# または
ssh username@your-vps-ip
```

### 1.2 システムのアップデート

```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y

# CentOS/RHEL
sudo yum update -y
```

### 1.3 必要なパッケージのインストール

```bash
# Ubuntu/Debian
sudo apt install -y curl wget git build-essential

# CentOS/RHEL
sudo yum install -y curl wget git gcc-c++ make
```

---

## ステップ2: Node.jsのインストール

### 2.1 Node.js 18.x (LTS) のインストール

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# バージョン確認
node --version  # v18.x.x が表示されればOK
npm --version   # 9.x.x 以上が表示されればOK
```

---

## ステップ3: MySQLのインストールと設定

### 3.1 MySQLのインストール

```bash
# Ubuntu/Debian
sudo apt install -y mysql-server

# CentOS/RHEL
sudo yum install -y mysql-server
sudo systemctl start mysqld
sudo systemctl enable mysqld
```

### 3.2 MySQLの初期設定

```bash
sudo mysql_secure_installation
```

以下の質問に答える：
- Set root password? → **Y** (rootパスワードを設定)
- Remove anonymous users? → **Y**
- Disallow root login remotely? → **Y**
- Remove test database? → **Y**
- Reload privilege tables? → **Y**

### 3.3 データベースとユーザーの作成

```bash
sudo mysql -u root -p
```

MySQLプロンプトで以下を実行：

```sql
-- データベース作成
CREATE DATABASE cleaning_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ユーザー作成（パスワードは強力なものに変更してください）
CREATE USER 'cleaning_user'@'localhost' IDENTIFIED BY 'your-strong-password-here';

-- 権限付与
GRANT ALL PRIVILEGES ON cleaning_system.* TO 'cleaning_user'@'localhost';
FLUSH PRIVILEGES;

-- 確認
SHOW DATABASES;
SELECT user, host FROM mysql.user WHERE user = 'cleaning_user';

-- 終了
EXIT;
```

---

## ステップ4: アプリケーションのデプロイ

### 4.1 アプリケーション用ディレクトリの作成

```bash
sudo mkdir -p /var/www
cd /var/www
```

### 4.2 GitHubからクローン（または直接ファイル転送）

**方法A: Gitを使う場合**

```bash
sudo git clone https://github.com/your-username/cleaning-share.git
cd cleaning-share
```

**方法B: ローカルからファイル転送する場合**

ローカルPCで実行：

```bash
# ローカルPCから実行
cd /Users/Haseko/Documents/Altam/cleaning-share
rsync -avz --exclude 'node_modules' --exclude '.git' \
  ./ username@your-vps-ip:/var/www/cleaning-share/
```

### 4.3 ディレクトリの所有権を変更

```bash
sudo chown -R $USER:$USER /var/www/cleaning-share
cd /var/www/cleaning-share
```

---

## ステップ5: バックエンドのセットアップ

### 5.1 バックエンドの依存関係をインストール

```bash
cd /var/www/cleaning-share/backend
npm install
```

### 5.2 環境変数ファイルの作成

```bash
cp .env.example .env
nano .env  # または vi .env
```

以下の内容を編集：

```env
# データベース設定
DB_HOST=localhost
DB_USER=cleaning_user
DB_PASSWORD=your-strong-password-here
DB_NAME=cleaning_system

# サーバー設定
PORT=4000
NODE_ENV=production

# JWT設定（ランダムな文字列を生成）
JWT_SECRET=your-very-long-random-secret-key-change-this-in-production

# ストレージ設定
STORAGE_DRIVER=local
STORAGE_ROOT=/var/www/cleaning-share/backend/uploads
PUBLIC_BASE_URL=http://your-domain.com

# ファイル保持期間
RETENTION_DAYS=60
MAX_FILE_MB=20

# CORS設定
CORS_ORIGIN=http://your-domain.com
```

**JWT_SECRETの生成方法：**

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 5.3 アップロードディレクトリの作成

```bash
mkdir -p /var/www/cleaning-share/backend/uploads/photos
mkdir -p /var/www/cleaning-share/backend/uploads/receipts
chmod -R 755 /var/www/cleaning-share/backend/uploads
```

### 5.4 データベーステーブルの作成

```bash
mysql -u cleaning_user -p cleaning_system < /var/www/cleaning-share/backend/database_schema.sql
```

パスワードを入力して実行。

### 5.5 バックエンドのテスト起動

```bash
cd /var/www/cleaning-share/backend
npm start
```

`http://your-vps-ip:4000` でアクセスできることを確認。
確認後、`Ctrl+C` で停止。

---

## ステップ6: フロントエンドのセットアップ

### 6.1 フロントエンドの依存関係をインストール

```bash
cd /var/www/cleaning-share/frontend
npm install
```

### 6.2 環境変数の設定

```bash
nano .env  # または vi .env
```

以下を追加：

```env
REACT_APP_API_URL=http://your-domain.com/api
```

**ドメインがない場合はIPアドレスを使用：**

```env
REACT_APP_API_URL=http://your-vps-ip:4000/api
```

### 6.3 フロントエンドのビルド

```bash
npm run build
```

ビルドが完了すると `build/` ディレクトリが作成されます。

---

## ステップ7: Nginxのインストールと設定

### 7.1 Nginxのインストール

```bash
# Ubuntu/Debian
sudo apt install -y nginx

# CentOS/RHEL
sudo yum install -y nginx

# Nginxを起動
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 7.2 Nginx設定ファイルの作成

```bash
sudo nano /etc/nginx/sites-available/cleaning-system
```

以下の内容を貼り付け：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # IPアドレスでも可

    # フロントエンド（React build）
    location / {
        root /var/www/cleaning-share/frontend/build;
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }

    # バックエンドAPI
    location /api/ {
        proxy_pass http://localhost:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # ファイルアップロード用の設定
        client_max_body_size 20M;
    }

    # アップロードファイルの静的配信
    location /uploads/ {
        alias /var/www/cleaning-share/backend/uploads/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 7.3 設定を有効化

```bash
# Ubuntu/Debian
sudo ln -s /etc/nginx/sites-available/cleaning-system /etc/nginx/sites-enabled/

# CentOS/RHEL (sites-available/enabledがない場合)
sudo cp /etc/nginx/sites-available/cleaning-system /etc/nginx/conf.d/cleaning-system.conf

# 設定テスト
sudo nginx -t

# Nginx再起動
sudo systemctl restart nginx
```

---

## ステップ8: PM2でバックエンドを常駐化

### 8.1 PM2のインストール

```bash
sudo npm install -g pm2
```

### 8.2 バ��クエンドをPM2で起動

```bash
cd /var/www/cleaning-share/backend
pm2 start server.js --name cleaning-backend
pm2 save
pm2 startup
```

最後のコマンドで表示されるコマンドをコピーして実行。

### 8.3 PM2の状態確認

```bash
pm2 status
pm2 logs cleaning-backend
```

---

## ステップ9: ファイアウォールの設定

### 9.1 UFW（Ubuntu）の場合

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS（後で設定する場合）
sudo ufw enable
sudo ufw status
```

### 9.2 firewalld（CentOS）の場合

```bash
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
sudo firewall-cmd --list-all
```

---

## ステップ10: SSL/HTTPS設定（推奨）

### 10.1 Certbotのインストール

```bash
# Ubuntu/Debian
sudo apt install -y certbot python3-certbot-nginx

# CentOS/RHEL
sudo yum install -y certbot python3-certbot-nginx
```

### 10.2 SSL証明書の取得

```bash
sudo certbot --nginx -d your-domain.com
```

指示に従ってメールアドレスを入力し、利用規約に同意。

### 10.3 自動更新の設定

```bash
sudo systemctl status certbot.timer
```

---

## ステップ11: 初期管理者ユーザーの作成

### 11.1 MySQLに接続

```bash
mysql -u cleaning_user -p cleaning_system
```

### 11.2 管理者ユーザーを作成

```sql
-- bcryptでハッシュ化されたパスワード（'password'の例）
-- 実際には別のパスワードを使用してください
INSERT INTO users (email, password_hash, name, role, is_active) VALUES
('admin@example.com', '$2b$10$rQ5Z1qX8vY7fYx3Jz4Kc6eJ8Ld9Gp2Hn5Tv4Wq1Xr3Ys6Zu8Av7B', '管理者', 'admin', TRUE);

-- 確認
SELECT id, email, name, role FROM users;

EXIT;
```

**パスワードハッシュの生成方法：**

Node.jsで実行：

```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('your-password', 10, (err, hash) => console.log(hash));"
```

---

## ステップ12: システムの動作確認

### 12.1 ブラウザでアクセス

```
http://your-domain.com
または
http://your-vps-ip
```

### 12.2 ログインテスト

作成した管理者アカウントでログイン：
- Email: `admin@example.com`
- Password: `your-password`

### 12.3 各機能のテスト

1. **施設管理**: 施設を追加
2. **ユーザー管理**: スタッフユーザーを作成
3. **写真アップロード**: スタッフアカウントでログインして写真をアップロード
4. **領収書アップロード**: 領収書をアップロード
5. **月次点検**: 月次点検項目をチェック

---

## トラブルシューティング

### バックエンドのログを確認

```bash
pm2 logs cleaning-backend
tail -f /var/www/cleaning-share/backend/error.log
tail -f /var/www/cleaning-share/backend/combined.log
```

### Nginxのログを確認

```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### データベース接続エラー

```bash
# MySQLが起動しているか確認
sudo systemctl status mysql

# データベースに接続できるか確認
mysql -u cleaning_user -p cleaning_system -e "SELECT 1;"
```

### ファイルアップロードエラー

```bash
# アップロードディレクトリの権限確認
ls -la /var/www/cleaning-share/backend/uploads/

# 権限を修正
sudo chown -R $USER:$USER /var/www/cleaning-share/backend/uploads/
chmod -R 755 /var/www/cleaning-share/backend/uploads/
```

### PM2プロセスの再起動

```bash
pm2 restart cleaning-backend
pm2 reload cleaning-backend  # ダウンタイムなしで再起動
```

---

## メンテナンス

### アプリケーションの更新

```bash
cd /var/www/cleaning-share

# バックエンド更新
cd backend
git pull  # または新しいファイルをアップロード
npm install
pm2 restart cleaning-backend

# フロントエンド更新
cd ../frontend
git pull  # または新しいファイルをアップロード
npm install
npm run build
sudo systemctl reload nginx
```

### データベースのバックアップ

```bash
# バックアップ
mysqldump -u cleaning_user -p cleaning_system > backup_$(date +%Y%m%d).sql

# リストア
mysql -u cleaning_user -p cleaning_system < backup_20250117.sql
```

### 古い写真の自動削除（Cron設定）

バックエンドのserver.jsで既に設定されていますが、手動で実行する場合：

```bash
cd /var/www/cleaning-share/backend
node scripts/cleanupOldPhotos.js
```

---

## セキュリティのベストプラクティス

1. **強力なパスワード使用**: すべてのパスワードは16文字以上
2. **SSH鍵認証**: パスワード認証を無効化
3. **ファイアウォール**: 必要なポートのみ開放
4. **定期的なアップデート**: `apt update && apt upgrade` を定期実行
5. **バックアップ**: 毎日データベースをバックアップ
6. **ログ監視**: 異常なアクセスを監視

---

## サポート

問題が発生した場合：

1. ログファイルを確認
2. PM2とNginxの状態を確認
3. データベース接続を確認
4. ファイル権限を確認

それでも解決しない場合は、エラーメッセージとログを含めて報告してください。
