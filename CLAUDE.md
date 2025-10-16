# Project Memory — Cleaning Photos & Receipt Sharing System

Import org-wide rules:
- @../../CLAUDE.md

See @README and @docs/ARCHITECTURE.md (if exists).

## Status
- Stack: React (CRA) / Node.js + Express / MySQL
- Storage: ローカル `./uploads`（multer）で運用継続
- Port: BE=4000（.env）, FE=3000（想定）
- Retention: **写真60日自動削除（cron=毎日02:00）** ✅
- 領収書: **未実装** → 施設×月（YYYY-MM）で実装予定

## Goals
- 現場スタッフ: 清掃前/後写真を施設×日付でアップ
- 管理者/クライアント: 閲覧・一括DL、（今後）領収書を施設×月で管理
- コスト最適化＆モバイルで高速

## Domain Rules
- album単位: **facility_id × cleaning_date (YYYY-MM-DD)**
- photoタグ: `before` | `after`
- receipts（目標）: **facility_id × year_month (YYYY-MM)** に束ねる
- ファイル命名: `fac-{id}_{YYYYMMDD}_{type}_{uuid}.{ext}`（サーバ側で付与）

## Data Retention
- MUST: 写真は既定 **60日で自動削除**（設定可能: `RETENTION_DAYS_PHOTO`）
- SHOULD: バンドルZIP/PDFは承認済のみ長期（例365日）
- すべての削除は audit log を残す

## Privacy & Security
- 現状: サムネ生成は `sharp`。**原本EXIFは保持され得る**（要検討）
- 目標: **EXIF（GPS等）をサーバでストリップ**し、`taken_at`のみ保持
- RBAC: admin / manager(施設限定) / staff(自分の投稿＋閲覧)
- 共有は期限付きURLのみ。`.env` や `./secrets/**` は読ませない

## Frontend (Mobile-first; CRA)
- 画像前処理: 圧縮(長辺~1600px, jpeg q~0.8)、HEIC→JPEG、キュー＆再送
- オフライン対応: 送信キューをローカルに保持→再接続で自動同期
- エラー文は行動可能＋再試行ボタン
- 環境変数: **`REACT_APP_API_URL`** を唯一のAPI起点に

## Backend / API
- 現状エンドポイント（例）:
  - `POST /api/auth/login`
  - `POST /api/photos/upload`（multer; 10MB; jpeg|jpg|png|gif）
  - `GET /api/albums/:facilityId?date=YYYY-MM-DD`
  - `GET /api/stats/daily`
- 目標エンドポイント（追加）:
  - `POST /api/receipts/upload`（PDF）
  - `GET /api/receipts/:facilityId?month=YYYY-MM`
  - `POST /api/bundles`（月次ZIP/PDF作成）
- CORS: **固定オリジン**のみ許可（`.env: CORS_ORIGIN`）

## Storage Layout
- ローカル: `uploads_dev/photos/{facilityId}/{YYYY-MM}/{YYYY-MM-DD}/{type}/{uuid}.jpg`
- ライフサイクル: raw/thumbnail=60d, bundles=365d

## Observability / SLO
- SLO(目安): p95 アップロード開始<400ms / 単枚完了<5s(4G)
- Metrics: upload success率, 平均サイズ, サムネ生成遅延
- Alerts: 5xx>1%/5m, キュー滞留>1000, 連続失敗

## Build & Test
- FE: `npm start`, `npm run build`
- BE: `npm run dev` / `npm run start`
- Lint/Format/Type（あれば）: `npm run lint` / `npm run format`
- E2E（優先）: 画像アップ → 再送 → アルバム閲覧 → 一括DL

## Git / PR
- Conventional Commits（例: `feat(receipts): add monthly upload API`）
- PR チェックリスト:
  - [ ] CORS 固定
  - [ ] 60日削除がユニット/cron dry-runで担保
  - [ ] 画像・PDF MIME/拡張子バリデーション
  - [ ] モバイル実測（4G）アップ時間を記録

## Environment (document only; do NOT commit)
- `PORT=4000`
- `CORS_ORIGIN=http://localhost:3000`
- `UPLOAD_DIR=./uploads`
- `RETENTION_DAYS_PHOTO=60`
- `JWT_SECRET=...`
- `RETENTION_DAYS_BUNDLE=365`
