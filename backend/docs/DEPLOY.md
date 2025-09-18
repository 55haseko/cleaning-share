# 本番デプロイ設定

## Nginx設定例

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # API プロキシ
    location /api/ {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 静的ファイル配信
    location / {
        alias /var/lib/seisou/uploads/;
        expires 7d;
        add_header Cache-Control "public, immutable";
        
        # セキュリティヘッダー
        add_header X-Content-Type-Options nosniff;
        add_header X-Frame-Options DENY;
        
        # ファイルタイプ制限
        location ~* \.(jpg|jpeg|png|webp|pdf)$ {
            # 正常なファイルのみ配信
        }
        
        # その他のファイルは404
        location ~ /\. {
            deny all;
        }
    }
}
```

## 本番環境変数

```bash
# 本番用 .env
DB_HOST=localhost
DB_USER=seisou_user
DB_PASSWORD=secure_password
DB_NAME=cleaning_system

PORT=4000
NODE_ENV=production

JWT_SECRET=very-secure-secret-key-64-chars-long

# ストレージ設定
STORAGE_DRIVER=local
STORAGE_ROOT=/var/lib/seisou/uploads
PUBLIC_BASE_URL=https://your-domain.com
RETENTION_DAYS=90
MAX_FILE_MB=50
```

## ディレクトリ作成

```bash
# アップロード用ディレクトリ作成
sudo mkdir -p /var/lib/seisou/uploads
sudo chown -R node:node /var/lib/seisou
sudo chmod 755 /var/lib/seisou/uploads
```

## systemd サービス設定

```ini
# /etc/systemd/system/seisou-api.service
[Unit]
Description=Cleaning System API
After=network.target mysql.service

[Service]
Type=simple
User=node
WorkingDirectory=/opt/seisou/backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## 運用メモ

### バックアップ
```bash
# 日次バックアップ
rsync -av /var/lib/seisou/uploads/ /backup/seisou/$(date +%Y%m%d)/
```

### 容量監視
- ディスク使用量を監視（写真は自動削除されるが領収書は蓄積される）
- アラート設定: 80%で警告、90%で緊急

### ログ管理
```bash
# logrotate設定例
/opt/seisou/backend/*.log {
    daily
    missingok
    rotate 30
    compress
    notifempty
    create 0644 node node
    postrotate
        systemctl reload seisou-api
    endscript
}
```

### パフォーマンス最適化
- Nginx gzip圧縮有効化
- 画像配信CDN検討
- データベースインデックス最適化

### セキュリティ
- ファイアウォール設定
- SSL/TLS証明書設定
- ファイルアップロード制限の確認
- ログ監視設定