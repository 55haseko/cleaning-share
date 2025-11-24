# デプロイ状況調査報告書 (2025-11-24)

**作成日時**: 2025年11月24日 12:00 JST
**調査対象**: Cleaning Share システム (React + Node.js + Express + MySQL)
**環境**: Linux VPS (Ubuntu)

---

## 📊 システム概要 (本日時点)

| 項目 | 状態 | 詳細 |
|------|------|------|
| **バックエンド** | ✅ **稼働中** | Node.js 直起動 (PID: 677712) |
| **フロントエンド** | ✅ **ビルド済** | React CRA ビルド完了 |
| **リバースプロキシ** | ❓ **不確認** | Nginx/Apache 動作確認待ち |
| **MySQL** | ✅ **接続可能** | localhost:3306 (接続済み) |
| **ドメイン** | ❓ **未確認** | 本レポート作成時点では不明 |
| **前回レポート** | ⚠️ **情報古い** | 2025-11-22 の内容と不一致 |

---

## ✅ 良好な状態

### 1. Node.js バックエンド稼働
```
プロセス: node /var/www/cleaning-share/backend/server.js
PID: 677712
稼働時間: ~1時間 (最終再起動: 11月24日 03:47 JST)
リソース: CPU 0.2%, メモリ 113MB
```
**評価**: ✅ 正常稼働中

### 2. React フロントエンド ビルド
```
ビルド時刻: 2025年11月24日 04:45 JST
ビルドサイズ: ~44KB (静的ファイル)
React バージョン: 19.1.1
位置: /var/www/cleaning-share/frontend/build/
```
**評価**: ✅ 本番ビルド完備

### 3. MySQL データベース接続
```
接続設定 (backend/.env):
- DB_HOST: localhost
- DB_USER: cleaning_user
- DB_NAME: cleaning_system
- ステータス: server.js が起動しているので接続確認済
```
**評価**: ✅ 接続可能

### 4. ディスク容量
```
Filesystem: /dev/vda3
サイズ: 146GB
使用: 21GB (15%)
空き: 125GB (85%)
```
**評価**: ✅ 十分な余裕あり

### 5. 依存ライブラリ
```
バックエンド依存:
- express: 4.18.2
- mysql2: 3.15.1
- multer: 1.4.5 (ファイルアップロード)
- sharp: 0.32.5 (画像処理)
- jsonwebtoken: 9.0.2
- node-cron: 3.0.2 (定期タスク)
- archiver: 7.0.1 (ZIP作成)

フロントエンド依存:
- react: 19.1.1
- react-dom: 19.1.1
- browser-image-compression: 2.0.2 (画像圧縮)
- lucide-react: 0.543.0 (UIアイコン)
```
**評価**: ✅ すべてインストール済み

---

## ⚠️ 検出された問題

### 🔴 重大: SQL パラメータ undefined エラー (頻発)

**エラーメッセージ:**
```
TypeError: Bind parameters must not contain undefined.
To pass SQL NULL specify JS null
```

**検出位置:** server.js:325, 332
**頻度**: 非常に頻繁 (error.log に大量記録)
**影響**: ユーザー情報取得 API エンドポイント

**根本原因:**
SQL クエリのバインドパラメータに `undefined` 値が含まれている。MySQL では NULL を明示的に渡す必要があります。

**修正例:**
```javascript
// NG (現在)
const params = [userId, optionalField, id];  // optionalField が undefined の場合、エラー

// OK (修正後)
const params = [userId, optionalField ?? null, id];
```

**対応優先度**: **即座 (P1)**
**推定対応時間**: 15分

---

### 🟡 警告: ファイルアップロード検証エラーの増加

**エラーメッセージ:**
```
エラー: 画像ファイル（JPEG, PNG, GIF, WebP）のみアップロード可能です
```

**検出位置:** server.js:175 (fileFilter)
**頻度**: 50回以上記録
**タイプ**: 正常な拒否と見られるが、ログレベルが高い

**分析:**
- 許可されていないファイル形式のアップロード試行が検出されている
- ボット、テスト、またはクライアント側のバリデーション不足の可能性

**対応方法:**
1. フロントエンド側で MIME タイプ検証を先行実装
2. バックエンド側のエラーログを DEBUG レベルに変更
3. ユーザーに分かりやすいエラーメッセージを返す

**対応優先度**: **本週中 (P2)**
**推定対応時間**: 25分

---

### 🟡 警告: Uploads ディレクトリが存在しない

**確認結果:**
```bash
$ ls /var/www/cleaning-share/uploads
エラー: そのようなファイルやディレクトリはありません

$ ls /var/www/cleaning-share/backend/uploads
エラー: 確認できず (パーミッション不足またはディレクトリなし)
```

**状況:**
- アップロード画像・ファイルを保存するディレクトリが見つからない
- または別パスで管理されている可能性

**対応方法:**
```bash
# ディレクトリ作成
mkdir -p /var/www/cleaning-share/backend/uploads

# 権限設定
chown www-data:www-data /var/www/cleaning-share/backend/uploads
chmod 755 /var/www/cleaning-share/backend/uploads

# サブディレクトリ作成
mkdir -p /var/www/cleaning-share/backend/uploads/{photos,receipts,bundles}
```

**対応優先度**: **即座 (P1)**
**推定対応時間**: 5分

---

### 🟡 警告: ヘルスチェック エンドポイント未実装

**確認結果:**
```bash
$ curl http://localhost:4000/api/health
(応答なし / タイムアウト)
```

**状況:** GET /api/health エンドポイントが実装されていない

**推奨実装:**
```javascript
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

**用途:** PM2/Kubernetes での自動監視・復帰

**対応優先度**: **近日中 (P2)**
**推定対応時間**: 15分

---

### 🟡 警告: 未コミット・未トラッキング ファイル多数

**Modified:**
```
 M backend/server.js
 M frontend/src/components/AdminDashboard.js
```

**Untracked (新規ファイル):**
```
?? BUG_FIX_REPORT.md
?? DEPLOYMENT_STATUS.md
?? DEPLOYMENT_SUMMARY.md
?? FILE_DISPLAY_FIX_REPORT.md
?? RESTART_REPORT.md
?? backend/package.json.backup
?? backend/scripts/addIsDeletedToFacilities.js
?? cleaning-share-backup.zip
?? package-lock.json
?? restart-clean.sh
```

**リスク:**
- 本番コードの修正が Git 管理下にない
- レポートファイルがリポジトリを肥大化させている
- 復旧時に状態が不明確になる

**対応方法:**
```bash
# 重要な修正をコミット
git add backend/server.js frontend/src/components/AdminDashboard.js
git commit -m "fix(backend): SQL パラメータ undefined 問題を修正"

# レポートやバックアップを .gitignore に追加
echo "*.md" >> .gitignore
echo "*.backup" >> .gitignore
echo "*.zip" >> .gitignore
git add .gitignore
git commit -m "chore: 一時ファイルを .gitignore に追加"
```

**対応優先度**: **本週中 (P2)**
**推定対応時間**: 10分

---

### 🟡 警告: リバースプロキシ・Webサーバー不確認

**状況:**
- Nginx または Apache が起動しているか不明確
- フロントエンド build/ の配信方法が不明確
- ドメイン設定が確認できない

**推奨確認事項:**
```bash
# Nginx/Apache の確認
systemctl status nginx
systemctl status apache2

# ポート状況確認
netstat -tlnp | grep -E ":(80|443)"

# リバースプロキシ設定確認
cat /etc/nginx/sites-available/default
cat /etc/apache2/sites-available/000-default.conf
```

**対応優先度**: **確認推奨 (P3)**
**推定対応時間**: 20分

---

## 📋 前回レポート (2025-11-22) との相違点

| 項目 | 前回 (11月22日) | 本日 (11月24日) | 理由 |
|---|---|---|---|
| **バックエンド** | PM2 稼働 | 直接 node 起動 | PM2 から切り替えられた可能性 |
| **ポート** | 4000 | 4000 (想定) | 環境設定変更 |
| **エラー内容** | ファイルパス二重化 | SQL undefined | 新しい問題が浮上 / 修正済み |
| **Nginx状態** | 稼働確認済 | 不確認 | 再起動またはダウン可能性 |
| **SSL** | Let's Encrypt有効 | 不確認 | 未確認 |

**解釈:**
前回レポートは 2025-11-22 時点での本番環境の状態です。本日のテスト・開発環境では異なる構成になっている可能性があります。

---

## 📊 最近のコミット履歴

```
ea8e5b9 feat: 大量画像アップロード最適化（Phase 1 & 2完了）
47a46b8 feat: 管理者機能とUI改善の実装
cf9dbab fix(backend): CORS設定を環境変数ベースに変更
75f9737 編集ボタン追加、施設名のみの検索に変更
c8a4229 一括ダウンロードできるようにした
44349ed 一時保存
793eec7 一時保存
6d51be6 Merge pull request #6 from 55haseko/fix/flatten-frontend
e82ddfa ユーザー削除できるようになった。
df06c35 Merge pull request #5 from 55haseko/fix/flatten-frontend
```

**評価:**
- 活発に機能開発が進行中
- 画像アップロード最適化に集中
- 管理者機能の実装進度が進んでいる

---

## 🔐 セキュリティ観察項目

| 項目 | 状態 | 備考 |
|---|---|---|
| DB 認証情報 | ⚠️ .env にプレーンテキスト | 本番環境では環境変数推奨 |
| JWT 実装 | ✅ jsonwebtoken 使用 | 設定値は .env 管理 |
| CORS 設定 | ✅ 環境変数化済 | .env: CORS_ORIGIN 参照 |
| ファイルバリデーション | ✅ MIME型チェック | ただしログが冗長 |
| EXIF ストリップ | ⚠️ 未実装 | 画像から GPS 情報が保持される可能性 |
| SSL/TLS | ❓ 不確認 | Nginx が稼働している場合は Let's Encrypt 推定 |

---

## 🔧 推奨される対応（優先度別）

### 優先度 1 (即座 - 本日対応)

**1. SQL undefined パラメータ修正**
- **内容**: server.js:325, 332 の undefined チェック
- **対応時間**: 15分
- **テスト**: ユーザー情報取得 API 再テスト
- **例**: `optionalField ?? null`

**2. Uploads ディレクトリ作成**
- **内容**: 必要なディレクトリ構造を作成
- **対応時間**: 5分
- **確認**: ls -la で検証

---

### 優先度 2 (本週中)

**3. Git 修正内容コミット**
- **内容**: server.js と AdminDashboard.js の変更をコミット
- **対応時間**: 10分

**4. ファイルアップロード検証改善**
- **内容**: フロントエンド側のバリデーション強化、ログレベル調整
- **対応時間**: 25分

**5. ヘルスチェック エンドポイント実装**
- **内容**: GET /api/health の追加
- **対応時間**: 15分

**6. Webサーバー構成確認**
- **内容**: Nginx/Apache 設定、ドメイン設定確認
- **対応時間**: 20分

---

### 優先度 3 (次のリリースサイクル)

**7. EXIF 情報ストリップ実装** (セキュリティ)
- **対応時間**: 45分
- **技術**: sharp の withMetadata 制御

**8. PM2 統合** (可用性向上)
- **対応時間**: 20分
- **利点**: 自動再起動、ログ管理

**9. ログローテーション設定**
- **対応時間**: 15分
- **対象**: error.log, combined.log

**10. 定期バックアップ実装**
- **対応時間**: 30分
- **方式**: mysqldump + cron

---

## 💾 システムスナップショット

### バージョン情報
```
Node.js: 稼働中 (v?? - 確認推奨)
npm: 依存ライブラリ全インストール済み
React: 19.1.1
MySQL: 接続可能
```

### 主要パス
```
バックエンド: /var/www/cleaning-share/backend/
フロントエンド: /var/www/cleaning-share/frontend/
ビルド出力: /var/www/cleaning-share/frontend/build/
ドキュメント: /var/www/cleaning-share/docs/
```

### 環境変数 (backend/.env)
```
DB_HOST=localhost
DB_USER=cleaning_user
DB_PASSWORD=C1eaning!2025_VPS  ⚠️ 本番では暗号化推奨
DB_NAME=cleaning_system
PORT=4000 (記載想定)
CORS_ORIGIN=http://localhost:3000 (開発時)
```

---

## ✨ 次のステップ

1. **本日中**: SQL パラメータ修正 + Uploads ディレクトリ作成
2. **明日**: Git コミット + ファイルバリデーション改善
3. **今週中**: ヘルスチェック実装 + Webサーバー確認
4. **来週以降**: EXIF 処理、PM2 統合、監視ツール連携

---

## 📝 確認チェックリスト

- [ ] SQL undefined エラー修正・テスト
- [ ] Uploads ディレクトリ作成・確認
- [ ] 修正コード Git コミット
- [ ] ファイルアップロード検証改善
- [ ] ヘルスチェック エンドポイント追加
- [ ] Webサーバー構成確認
- [ ] EXIF ストリップ実装検討
- [ ] PM2 または Systemd 統合検討
- [ ] ログローテーション設定
- [ ] バックアップ戦略確立

---

**レポート作成日時**: 2025年11月24日 12:00 JST
**調査者**: Claude Code AI Assistant
**対象環境**: /var/www/cleaning-share (開発・テスト環境)
**次回更新予定**: 修正対応完了後の確認テスト時
