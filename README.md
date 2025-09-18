# 清掃写真・領収書共有システム

清掃管理システムのバックエンドAPI

## 環境変数

| 変数名 | 説明 | デフォルト値 | 例 |
|--------|------|------------|-----|
| STORAGE_DRIVER | ストレージタイプ | local | local |
| STORAGE_ROOT | ファイル保存ルート | ./uploads_dev | ./uploads_dev |
| PUBLIC_BASE_URL | 公開URL基準 | (相対URL) | http://localhost:4000 |
| RETENTION_DAYS | 写真保持日数 | 60 | 60 |
| MAX_FILE_MB | ファイルサイズ上限(MB) | 20 | 20 |

## セットアップ

```bash
# 依存関係のインストール
cd backend
npm install

# 環境変数設定
cp .env.example .env
# .env を編集

# サーバー起動
npm run dev
```

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