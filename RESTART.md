# システム再起動手順

## 🔄 再起動コマンド（これだけ覚えればOK）

### バックエンド再起動
```bash
cd /var/www/cleaning-share/backend
pm2 restart cleaning-backend
pm2 logs cleaning-backend --lines 20  # ログ確認
```

### フロントエンド再ビルド＆デプロイ
```bash
cd /var/www/cleaning-share/frontend
npm run build
sudo systemctl restart nginx
```

### Nginx再起動のみ
```bash
sudo systemctl restart nginx
```

---

## 📋 トラブルシューティング

### バックエンドが起動しない
```bash
# ログを確認
pm2 logs cleaning-backend --lines 50

# プロセス状態を確認
pm2 status

# 完全に停止して再起動
pm2 stop cleaning-backend
pm2 start /var/www/cleaning-share/backend/server.js --name cleaning-backend
pm2 save
```

### フロントエンドが表示されない
```bash
# ビルドファイルが存在するか確認
ls -la /var/www/cleaning-share/frontend/build/

# Nginx設定テスト
sudo nginx -t

# Nginxログ確認
sudo tail -f /var/log/nginx/error.log
```

### MySQL接続エラー
```bash
# MySQL起動確認
sudo systemctl status mysql

# MySQL再起動
sudo systemctl restart mysql
```

---

## 🎯 完全再起動（すべてのサービス）

```bash
# 1. バックエンド停止
pm2 stop cleaning-backend

# 2. MySQL確認（必要に応じて再起動）
sudo systemctl restart mysql

# 3. バックエンド起動
cd /var/www/cleaning-share/backend
pm2 start server.js --name cleaning-backend --force
pm2 save

# 4. フロントエンド再ビルド
cd /var/www/cleaning-share/frontend
npm run build

# 5. Nginx再起動
sudo systemctl restart nginx

# 6. 状態確認
pm2 status
sudo systemctl status nginx
```

---

## ✅ 動作確認

```bash
# APIヘルスチェック
curl https://marunage-report.xyz/api/health

# バックエンドログ
pm2 logs cleaning-backend --lines 20

# Nginxログ
sudo tail -20 /var/log/nginx/access.log
```
