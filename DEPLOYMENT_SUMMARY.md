# デプロイ状況 - クイックリファレンス

## 🚀 システム起動コマンド

```bash
# フルリセット再起動（推奨）
bash /var/www/cleaning-share/restart-clean.sh

# PM2 のみ再起動
pm2 restart cleaning-backend

# サービス個別操作
sudo systemctl restart nginx      # Nginx再起動
sudo systemctl restart mysql      # MySQL再起動
```

---

## ✅ 現在のステータス

| サービス | 状態 | ポート | 詳細 |
|---------|------|--------|------|
| **MySQL** | ✅ 稼働 | 3306 | v8.0.44 |
| **バックエンド** | ✅ 稼働 | 4000 | PM2 (PID: 636850) |
| **Nginx** | ✅ 稼働 | 443 | Let's Encrypt SSL |
| **フロントエンド** | ✅ ビルド済 | 443 | React build |

---

## 🔴 既知の問題

### ファイルパス二重化バグ (**優先修正**)
- **現象**: 写真・領収書ファイルが表示されない
- **ログ出力**: `/var/log/nginx/error.log`
- **根本原因**: `STORAGE_ROOT` の相対パス処理に問題
- **対応**: server.js の `file_path` 処理ロジックを見直し必要

```
エラー例:
GET /uploads/uploads/receipts/1/2025-11/file.pdf
GET /uploads//var/www/cleaning-share/backend/uploads/photos/...
```

---

## 📊 ログ確認

```bash
# バックエンドログ
pm2 logs cleaning-backend

# Nginx エラーログ
sudo tail -f /var/log/nginx/error.log

# Nginx アクセスログ
sudo tail -f /var/log/nginx/access.log

# MySQL ログ
sudo tail -f /var/log/mysql/error.log

# 再起動ログ
cat /var/www/cleaning-share/restart.log
```

---

## 🔍 ヘルスチェック

```bash
# バックエンド API
curl http://localhost:4000/api/health

# MySQL 接続テスト
mysql -u cleaning_user -p"C1eaning!2025_VPS" cleaning_system -e "SELECT VERSION();"

# Nginx 状態
sudo systemctl status nginx

# PM2 プロセス
pm2 status
```

---

## 🔐 セキュリティ注意事項

### ⚠️ 要対応
1. **JWT_SECRET** がデフォルト値
   ```
   現在値: "your-secure-secret-key-change-this-in-production"
   変更必要!
   ```

2. **SSL証明書の有効期限確認**
   ```bash
   sudo openssl x509 -enddate -noout -in \
     /etc/letsencrypt/live/marunage-report.xyz/fullchain.pem
   ```

---

## 📁 主要ファイル・ディレクトリ

```
/var/www/cleaning-share/
├── backend/
│   ├── server.js           # メインサーバーファイル
│   ├── .env                # 環境設定（本番）
│   ├── uploads/            # アップロードファイル格納先
│   └── package.json        # 依存パッケージ
├── frontend/
│   ├── build/              # React ビルド出力
│   ├── .env                # フロントエンド設定
│   └── public/             # 静的アセット
├── restart-clean.sh        # 再起動スクリプト ⭐️
├── DEPLOYMENT_STATUS.md    # 詳細調査レポート
└── DEPLOYMENT_SUMMARY.md   # このファイル
```

---

## 🛠️ 定期メンテナンス

### 日次
```bash
# ディスク容量確認
df -h /var/www/cleaning-share

# エラーログチェック
sudo tail /var/log/nginx/error.log
```

### 週次
```bash
# SSL証明書の有効期限確認
sudo openssl x509 -enddate -noout -in \
  /etc/letsencrypt/live/marunage-report.xyz/fullchain.pem

# PM2プロセス再起動
pm2 reload cleaning-backend
```

### 月次
```bash
# MySQL バックアップ
mysqldump -u cleaning_user -p cleaning_system > \
  backup_$(date +%Y%m%d).sql

# ディスク容量レビュー
du -sh /var/www/cleaning-share/*
```

---

## 🆘 トラブルシューティング

### バックエンドが起動しない
```bash
# PM2 で手動起動
cd /var/www/cleaning-share/backend
pm2 start server.js --name cleaning-backend

# または全体再起動
bash /var/www/cleaning-share/restart-clean.sh
```

### ファイルアップロードが失敗
```bash
# アップロードディレクトリの権限確認
ls -la /var/www/cleaning-share/backend/uploads/

# 権限修正
sudo chown -R www-data:www-data /var/www/cleaning-share/backend/uploads/
chmod -R 755 /var/www/cleaning-share/backend/uploads/
```

### MySQL 接続エラー
```bash
# MySQL 再起動
sudo systemctl restart mysql

# 接続テスト
mysql -u cleaning_user -p"C1eaning!2025_VPS" -e "SELECT 1;"
```

### SSL 証明書エラー
```bash
# Certbot で自動更新
sudo certbot renew

# 手動更新（必要に応じて）
sudo certbot certonly --nginx -d marunage-report.xyz
```

---

## 📞 トラブル時の連絡先情報

デプロイ情報:
- **ドメイン**: marunage-report.xyz
- **サーバーOS**: Ubuntu 22.04 LTS
- **Node.js**: v18.x (PM2で管理)
- **MySQL**: 8.0.44
- **Nginx**: リバースプロキシ (SSL終端)

---

**最終更新**: 2025-11-22 17:31 JST
**調査担当**: Claude Code
**次回確認予定**: 2025-11-29
