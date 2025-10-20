# ディレクトリ構造とファイルの役割

清掃写真・領収書共有システムのプロジェクト構造を説明します。

## 📁 プロジェクト全体構造

```
cleaning-share/
├── .claude/                    # Claude Code 設定
├── backend/                    # バックエンド（Node.js + Express + MySQL）
├── frontend/                   # フロントエンド（React）
├── CLAUDE.md                   # プロジェクト固有のAI指示
├── README.md                   # プロジェクト概要
└── DEPLOYMENT_GUIDE.md         # デプロイメントガイド
```

---

## 🔧 ルート直下のファイル

### ドキュメント
- **`README.md`** - プロジェクト概要、セットアップ手順、機能説明
- **`DEPLOYMENT_GUIDE.md`** - 本番環境へのデプロイ手順
- **`CLAUDE.md`** - プロジェクト固有のルールと規約（AI開発支援用）
- **`DIRECTORY_STRUCTURE.md`** - このファイル

### 設定
- **`.claude/settings.local.json`** - Claude Code のローカル設定

---

## 🖥️ バックエンド（backend/）

### ディレクトリ構造

```
backend/
├── server.js                   # メインサーバーファイル
├── package.json                # Node.js 依存関係
├── .env                        # 環境変数（本番用、gitignore対象）
├── .env.example                # 環境変数のサンプル
├── database_schema.sql         # データベーススキーマ定義
├── docs/
│   └── DEPLOY.md              # バックエンド個別のデプロイ手順
├── scripts/
│   ├── initDatabase.js        # データベース初期化スクリプト
│   ├── testDb.js              # データベース接続テスト
│   └── cleanupOldPhotos.js    # 古い写真削除スクリプト
├── src/
│   ├── cron/
│   │   └── retention.js       # 自動削除ジョブ（60日保持ポリシー）
│   ├── routes/                # APIルート（未使用：server.jsに統合済み）
│   └── storage/               # ストレージ関連（未使用）
└── uploads_dev/               # アップロードファイル保存先（開発環境）
    ├── photos/                # 写真保存ディレクトリ
    │   └── {facility_id}/     # 施設IDごと
    │       └── {YYYY-MM}/     # 年月ごと
    │           └── {YYYY-MM-DD}/ # 日付ごと
    │               ├── before/   # 清掃前
    │               ├── after/    # 清掃後
    │               └── thumbnails/ # サムネイル
    ├── receipts/              # 領収書保存ディレクトリ
    │   └── {facility_id}/     # 施設IDごと
    │       └── {YYYY-MM}/     # 年月ごと
    └── legacy/                # 旧データ（マイグレーション前）
```

### 主要ファイルの役割

#### **`server.js`** - メインサーバー
すべてのAPIエンドポイントを定義：

**認証**
- `POST /api/auth/login` - ログイン
- `GET /api/auth/me` - 現在のユーザー情報
- `POST /api/auth/change-password` - パスワード変更
- `GET /api/auth/verify` - トークン検証

**ユーザー管理（管理者のみ）**
- `GET /api/users` - ユーザー一覧
- `POST /api/users` - ユーザー作成
- `PUT /api/users/:userId` - ユーザー更新
- `PUT /api/users/:userId/reset-password` - パスワードリセット

**施設管理**
- `GET /api/facilities` - 施設一覧（権限フィルタリング）
- `POST /api/facilities` - 施設作成（管理者のみ）
- `PUT /api/facilities/:facilityId` - 施設更新
- `DELETE /api/facilities/:facilityId` - 施設削除

**清掃セッション**
- `POST /api/sessions` - セッション作成/更新

**写真管理**
- `POST /api/photos/upload` - 写真アップロード（認証あり）
- `POST /api/photos/upload-test` - テスト用アップロード
- `GET /api/albums/:facilityId` - アルバム取得

**領収書管理**
- `GET /api/receipts/:facilityId` - 領収書一覧取得
- `POST /api/receipts/upload` - 領収書アップロード

**月次点検**
- `POST /api/monthly-checks/save` - 月次点検保存
- `GET /api/monthly-checks/:facilityId` - 月次点検状態取得
- `GET /api/monthly-checks` - 月次点検状況一覧
- `GET /api/monthly-checks/stats` - 月次点検統計

**統計（管理者用）**
- `GET /api/stats/daily` - 日次統計
- `GET /api/stats/recent-uploads` - 最近のアップロード履歴

**その他**
- `GET /api/health` - ヘルスチェック
- 静的ファイル配信: `/uploads/*`

#### **`database_schema.sql`** - データベーススキーマ
テーブル定義：
- `users` - ユーザー（staff/client/admin）
- `facilities` - 施設
- `staff_facilities` - スタッフと施設の紐付け
- `cleaning_sessions` - 清掃セッション
- `photos` - 写真
- `receipts` - 領収書

#### **`scripts/`**
- **`initDatabase.js`** - 初期データ投入（開発用）
- **`testDb.js`** - DB接続確認
- **`cleanupOldPhotos.js`** - 古いファイル削除（手動実行用）

#### **`src/cron/retention.js`**
- 60日経過した写真を自動削除
- 毎日02:00実行（cron設定）

#### **`.env`** - 環境変数（例）
```env
PORT=4001
DB_HOST=localhost
DB_USER=cleaning_user
DB_PASSWORD=strongpassword
DB_NAME=cleaning_system
JWT_SECRET=your-secret-key
STORAGE_ROOT=./uploads_dev
RETENTION_DAYS_PHOTO=60
RETENTION_DAYS_BUNDLE=365
```

---

## 🎨 フロントエンド（frontend/）

### ディレクトリ構造

```
frontend/
├── public/
│   ├── index.html             # HTMLテンプレート
│   ├── favicon.ico            # ファビコン
│   └── manifest.json          # PWA設定
├── src/
│   ├── index.js               # エントリーポイント
│   ├── App.js                 # メインアプリコンポーネント
│   ├── api/                   # API通信層
│   │   ├── config.js          # API設定（baseURL、認証）
│   │   ├── auth.js            # 認証API
│   │   ├── facilities.js      # 施設API
│   │   ├── photos.js          # 写真API
│   │   ├── receipts.js        # 領収書API
│   │   ├── albums.js          # アルバムAPI
│   │   ├── sessions.js        # セッションAPI
│   │   ├── monthlyCheck.js    # 月次点検API
│   │   ├── users.js           # ユーザーAPI
│   │   └── stats.js           # 統計API
│   ├── components/            # Reactコンポーネント
│   │   ├── AdminDashboard.js  # 管理者ダッシュボード
│   │   ├── StaffDashboardNew.js # スタッフダッシュボード
│   │   ├── FacilitySelector.js  # 施設選択UI
│   │   ├── PhotoSelector.js     # 写真選択UI
│   │   ├── ImageModal.js        # 画像拡大表示モーダル
│   │   └── MonthlyCheckDashboard.js # 月次点検ダッシュボード
│   ├── hooks/
│   │   └── useApi.js          # カスタムフック（API呼び出し）
│   ├── App.test.js            # テスト
│   ├── setupTests.js          # テスト設定
│   └── reportWebVitals.js     # パフォーマンス計測
├── package.json               # 依存関係
├── .env                       # 環境変数
└── README.md                  # フロントエンド固有のREADME
```

### 主要ファイルの役割

#### **`src/App.js`** - メインアプリケーション
以下のコンポーネントを含む：
- **`LoginScreen`** - ログイン画面
- **`ClientDashboard`** - クライアントダッシュボード
  - タブ切り替え（清掃記録/領収書）
  - 施設選択
  - アルバム一覧
  - 写真詳細表示
  - 領収書一覧（月別グループ化）
  - 画像モーダル統合

ルーティング:
- `staff` → `StaffDashboardNew`
- `client` → `ClientDashboard`
- `admin` → `AdminDashboard`

#### **`src/api/config.js`** - API設定
- `apiClient` - axios インスタンス
- ベースURL設定（`REACT_APP_API_URL`）
- 認証トークン自動付与
- エラーハンドリング

#### **`src/api/*.js`** - API通信モジュール
各APIエンドポイントへの通信を抽象化：
- **`auth.js`** - ログイン、トークン管理
- **`facilities.js`** - 施設CRUD
- **`photos.js`** - 写真アップロード
- **`receipts.js`** - 領収書アップロード・取得
- **`albums.js`** - アルバム取得
- **`users.js`** - ユーザー管理
- **`stats.js`** - 統計データ取得

#### **`src/components/`** - UIコンポーネント

**`StaffDashboardNew.js`**
- 施設選択（検索・ソート機能付き）
- 写真アップロード（清掃前/後）
- 月次点検チェックボックス
- 領収書アップロード
- アップロード進捗表示

**`AdminDashboard.js`**
- 施設管理（作成・編集・削除）
- ユーザー管理（作成・編集・パスワードリセット）
- 統計ダッシュボード
- アルバム閲覧

**`FacilitySelector.js`**
- 施設一覧表示（グリッド）
- 施設カード（名前、住所、最終清掃日）
- クリックで施設選択

**`PhotoSelector.js`**
- ドラッグ&ドロップ対応写真選択
- プレビュー表示
- 削除ボタン
- 枚数制限

**`ImageModal.js`**
- フルスクリーン画像表示
- 前へ/次へナビゲーション
- キーボード操作（ESC/矢印キー）
- 画像情報表示

**`MonthlyCheckDashboard.js`**
- 月次点検状況一覧
- 完了/未完了フィルタリング

#### **`.env`** - 環境変数（例）
```env
REACT_APP_API_URL=http://localhost:4001/api
```

---

## 🗄️ データベース構造

### テーブル一覧

1. **`users`** - ユーザー
   - `id`, `email`, `password_hash`, `name`, `role`
   - role: `staff` / `client` / `admin`

2. **`facilities`** - 施設
   - `id`, `name`, `address`, `client_user_id`

3. **`staff_facilities`** - スタッフ施設紐付け（多対多）
   - `staff_user_id`, `facility_id`

4. **`cleaning_sessions`** - 清掃セッション
   - `id`, `facility_id`, `cleaning_date`, `staff_user_id`
   - `ventilation_checked`, `air_filter_checked`

5. **`photos`** - 写真
   - `id`, `cleaning_session_id`, `file_path`, `thumbnail_path`
   - `type` (`before` / `after`), `file_size`, `original_name`

6. **`receipts`** - 領収書
   - `id`, `cleaning_session_id`, `facility_id`, `month`
   - `file_path`, `file_size`, `original_name`, `uploaded_by`

---

## 🔐 認証フロー

1. ログイン → JWT トークン発行
2. トークンを localStorage に保存
3. API リクエストに Authorization ヘッダーで付与
4. サーバー側で検証
5. ロールベースでアクセス制御

---

## 📦 ストレージ構造

### 写真
```
uploads_dev/photos/{facility_id}/{YYYY-MM}/{YYYY-MM-DD}/{type}/{uuid}.jpg
例: uploads_dev/photos/1/2025-01/2025-01-15/before/abc123.jpg
```

### 領収書
```
uploads_dev/receipts/{facility_id}/{YYYY-MM}/{uuid}.pdf
例: uploads_dev/receipts/1/2025-01/receipt_xyz789.pdf
```

### 命名規則
- 写真: `fac-{id}_{YYYYMMDD}_{type}_{uuid}.{ext}`
- 領収書: `fac-{id}_{YYYYMM}_receipt_{uuid}.{ext}`

---

## 🚀 起動方法

### バックエンド
```bash
cd backend
npm install
cp .env.example .env  # 編集必要
npm run dev
```

### フロントエンド
```bash
cd frontend
npm install
echo "REACT_APP_API_URL=http://localhost:4001/api" > .env
npm start
```

---

## 📝 主要な技術スタック

### バックエンド
- **Node.js** + **Express** - サーバーフレームワーク
- **MySQL** (mysql2) - データベース
- **JWT** - 認証
- **multer** - ファイルアップロード
- **sharp** - 画像処理（サムネイル生成）
- **bcrypt** - パスワードハッシュ化
- **winston** - ロギング
- **node-cron** - スケジュールジョブ

### フロントエンド
- **React** (Create React App) - UIフレームワーク
- **axios** - HTTP通信
- **lucide-react** - アイコン
- **Tailwind CSS** - スタイリング

### データベース
- **MySQL 8.0+**

---

## 📌 重要な設計方針

1. **データ保持ポリシー**: 写真60日、バンドル365日
2. **権限管理**: RBAC（Role-Based Access Control）
3. **ファイル管理**: ローカルストレージ（将来的にS3移行可能）
4. **セキュリティ**:
   - JWT認証
   - パスワードハッシュ化
   - CORS制限
   - ファイルタイプ検証
5. **モバイルファースト**: レスポンシブデザイン

---

最終更新: 2025年1月
