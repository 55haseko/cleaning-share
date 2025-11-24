# 清掃写真・領収書共有システム

清掃スタッフによる清掃前後の写真アップロードと、管理者・クライアントによる閲覧・ダウンロードを可能にするシステムです。

## 📋 目次

- [クイックスタート](#クイックスタート)
- [初回セットアップ](#初回セットアップ)
- [ログイン情報](#ログイン情報)
- [環境変数](#環境変数)
- [API使用例](#api使用例)

## 🚀 クイックスタート

### 一発起動（推奨）

```bash
# プロジェクトルートで実行
./start.sh
```

ブラウザで http://localhost:3000 にアクセスしてください。

### 停止

```bash
./stop.sh
```

### 手動起動

```bash
# ターミナル1: バックエンド
cd backend
npm start

# ターミナル2: フロントエンド
cd frontend
npm start
```

## 🔧 初回セットアップ

### 1. 依存関係のインストール

```bash
# バックエンド
cd backend
npm install

# フロントエンド
cd frontend
npm install
```

### 2. 環境変数の設定

#### バックエンド (`backend/.env`)

```bash
cd backend
cp .env.example .env
```

最低限必要な設定:
```env
PORT=4000
CORS_ORIGIN=http://localhost:3000
DB_HOST=localhost
DB_USER=cleaning_user
DB_PASSWORD=strongpassword
DB_NAME=cleaning_system
JWT_SECRET=your-secure-secret-key-change-this-in-production
```

#### フロントエンド (`frontend/.env`)

```env
REACT_APP_API_URL=http://localhost:4000/api
```

### 3. データベースのセットアップ

```bash
# MySQLにログイン
mysql -u root -p

# データベースとユーザーを作成
CREATE DATABASE cleaning_system;
CREATE USER 'cleaning_user'@'localhost' IDENTIFIED BY 'strongpassword';
GRANT ALL PRIVILEGES ON cleaning_system.* TO 'cleaning_user'@'localhost';
FLUSH PRIVILEGES;

# スキーマを適用
USE cleaning_system;
SOURCE backend/database_schema.sql;
```

## 👤 ログイン情報

| 役割 | メールアドレス | パスワード | 権限 |
|------|---------------|-----------|------|
| 管理者 | admin@cleaning.com | admin123 | 全施設の閲覧・管理 |
| スタッフ | staff1@cleaning.com | staff123 | 写真アップロード |
| クライアント | client1@example.com | client123 | 担当施設の閲覧のみ |

## 📊 環境変数

### バックエンド

| 変数名 | 説明 | デフォルト値 | 例 |
|--------|------|------------|-----|
| PORT | サーバーポート | 4000 | 4000 |
| CORS_ORIGIN | フロントエンドURL | - | http://localhost:3000 |
| DB_HOST | DBホスト | localhost | localhost |
| DB_USER | DBユーザー | - | cleaning_user |
| DB_PASSWORD | DBパスワード | - | strongpassword |
| DB_NAME | DB名 | - | cleaning_system |
| JWT_SECRET | JWT署名キー | - | (ランダム文字列) |
| STORAGE_DRIVER | ストレージタイプ | local | local |
| STORAGE_ROOT | ファイル保存ルート | ./uploads_dev | ./uploads_dev |
| PUBLIC_BASE_URL | 公開URL基準 | (相対URL) | http://localhost:4000 |
| RETENTION_DAYS | 写真保持日数 | 60 | 60 |
| MAX_FILE_MB | ファイルサイズ上限(MB) | 20 | 20 |

### フロントエンド

| 変数名 | 説明 | 例 |
|--------|------|----|
| REACT_APP_API_URL | バックエンドAPI URL | http://localhost:4000/api |

## API使用例

### 認証
```bash
# ログイン
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# レスポンス例
{"token":"eyJ...","user":{"id":1,"email":"test@example.com"}}
```

### 写真アップロード
```bash
curl -X POST http://localhost:4000/api/upload/photo \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@photo.jpg" \
  -F "facilityId=123" \
  -F "date=2024-01-15" \
  -F "tag=before"

# レスポンス例
{"ok":true,"url":"/photos/123/2024-01-15/1642234567890-abc123def.jpg","bytes":524288,"filename":"1642234567890-abc123def.jpg"}
```

### 領収書アップロード
```bash
curl -X POST http://localhost:4000/api/upload/receipt \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@receipt.pdf" \
  -F "facilityId=123" \
  -F "month=2024-01"

# レスポンス例
{"ok":true,"url":"/receipts/123/2024-01/1642234567890-xyz789abc.pdf","bytes":102400,"filename":"1642234567890-xyz789abc.pdf"}
```

## ファイル構造

```
uploads_dev/
├── photos/
│   └── {facilityId}/
│       └── {YYYY-MM-DD}/
│           ├── 1642234567890-abc123def.jpg
│           └── 1642234567890-def456ghi.png
└── receipts/
    └── {facilityId}/
        └── {YYYY-MM}/
            └── 1642234567890-xyz789abc.pdf
```

## 保持ポリシー

- **写真**: `RETENTION_DAYS`日後に自動削除
- **領収書**: 削除されない（永続保存）