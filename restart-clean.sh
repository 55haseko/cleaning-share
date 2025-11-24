#!/bin/bash

# =============================================================================
# 清掃写真・領収書共有システム - クリーン再起動スクリプト
# =============================================================================
# 本番環境での安全な再起動を行うスクリプト
# 使用: bash /var/www/cleaning-share/restart-clean.sh
# =============================================================================

set -e

# 色付き出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ロガー関数
log_info() {
    echo -e "${BLUE}ℹ${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}✅${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}⚠️${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}❌${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# プロジェクトルート
PROJECT_ROOT="/var/www/cleaning-share"
BACKEND_DIR="$PROJECT_ROOT/backend"
LOG_FILE="$PROJECT_ROOT/restart.log"

# ログを記録しながら出力
log_to_file() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# =============================================================================
# フェーズ1: 初期化とヘルスチェック
# =============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 清掃写真・領収書共有システム - クリーン再起動スクリプト"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

log_info "再起動プロセスを開始します..."
log_to_file "=== 再起動開始 ==="

# プロジェクトディレクトリ確認
if [ ! -d "$PROJECT_ROOT" ]; then
    log_error "プロジェクトディレクトリが見つかりません: $PROJECT_ROOT"
    exit 1
fi
log_success "プロジェクトディレクトリ確認: $PROJECT_ROOT"

# ログファイル初期化
> "$LOG_FILE"
log_to_file "再起動スクリプト実行開始"

# =============================================================================
# フェーズ2: 現在のプロセス状態確認
# =============================================================================

echo ""
log_info "フェーズ2: 現在のプロセス状態を確認中..."

# MySQL接続テスト
log_info "MySQL接続テスト..."
if mysql -u cleaning_user -p"C1eaning!2025_VPS" cleaning_system -e "SELECT VERSION();" > /dev/null 2>&1; then
    log_success "MySQL接続: OK"
    log_to_file "MySQL接続テスト: 成功"
else
    log_warning "MySQL接続テスト失敗 (システムは起動を試みます)"
    log_to_file "MySQL接続テスト: 失敗"
fi

# PM2プロセス確認
log_info "PM2プロセス状態確認..."
if pm2 status 2>&1 | grep -q "cleaning-backend"; then
    log_success "PM2でバックエンド起動中"
    log_to_file "PM2プロセス: 起動中"
    BACKEND_PID=$(pm2 pid cleaning-backend)
    log_info "現在のバックエンドPID: $BACKEND_PID"
else
    log_warning "PM2でバックエンドが見つかりません"
    log_to_file "PM2プロセス: 見つかりません"
fi

# =============================================================================
# フェーズ3: プロセス停止
# =============================================================================

echo ""
log_info "フェーズ3: バックエンドプロセスを停止中..."

if pm2 status 2>&1 | grep -q "cleaning-backend"; then
    log_info "PM2でバックエンドを停止..."
    pm2 stop cleaning-backend 2>&1 | head -5
    sleep 2
    log_success "バックエンド停止完了"
    log_to_file "PM2バックエンド停止: 成功"
else
    log_info "PM2でのバックエンドプロセスなし"
fi

# 孤立したNode.jsプロセスを確認
ORPHAN_PIDS=$(pgrep -f "node.*server.js" || true)
if [ -n "$ORPHAN_PIDS" ]; then
    log_warning "孤立したバックエンドプロセスを検出: $ORPHAN_PIDS"
    log_to_file "孤立プロセス検出: $ORPHAN_PIDS"
    for PID in $ORPHAN_PIDS; do
        log_info "プロセス $PID を強制終了..."
        kill -9 "$PID" 2>/dev/null || true
        log_to_file "プロセス $PID を終了"
    done
    sleep 2
    log_success "孤立プロセスを削除"
else
    log_success "孤立プロセスなし"
fi

# =============================================================================
# フェーズ4: キャッシュのクリア
# =============================================================================

echo ""
log_info "フェーズ4: キャッシュをクリア中..."

# Nginxキャッシュクリア
if [ -d "/var/cache/nginx" ]; then
    log_info "Nginxキャッシュをクリア..."
    sudo rm -rf /var/cache/nginx/* 2>/dev/null || log_warning "Nginxキャッシュクリア権限不足"
    log_to_file "Nginxキャッシュクリア: 完了"
fi

# Node.jsキャッシュクリア（存在する場合）
if [ -d "$BACKEND_DIR/node_modules/.cache" ]; then
    log_info "Node.jsビルドキャッシュをクリア..."
    rm -rf "$BACKEND_DIR/node_modules/.cache"
    log_to_file "Node.jsキャッシュクリア: 完了"
fi

log_success "キャッシュクリア完了"

# =============================================================================
# フェーズ5: サービス再起動
# =============================================================================

echo ""
log_info "フェーズ5: サービスを再起動中..."

# MySQL確認（必須）
log_info "MySQLの起動状態確認..."
if sudo systemctl is-active --quiet mysql; then
    log_success "MySQL: 既に起動中"
else
    log_info "MySQLを起動..."
    sudo systemctl start mysql
    sleep 3
    if sudo systemctl is-active --quiet mysql; then
        log_success "MySQL起動: 成功"
        log_to_file "MySQL起動: 成功"
    else
        log_error "MySQL起動に失敗しました"
        log_to_file "MySQL起動: 失敗"
        exit 1
    fi
fi

# バックエンド起動
log_info "バックエンド（PM2）を起動..."
cd "$BACKEND_DIR"
pm2 start server.js --name cleaning-backend --force 2>&1 | tail -3
pm2 save
sleep 3
log_to_file "バックエンド起動: 試行"

# Nginx再起動
log_info "Nginxを再起動..."
sudo systemctl restart nginx
sleep 2
if sudo systemctl is-active --quiet nginx; then
    log_success "Nginx再起動: 成功"
    log_to_file "Nginx再起動: 成功"
else
    log_error "Nginx再起動に失敗しました"
    log_to_file "Nginx再起動: 失敗"
fi

# =============================================================================
# フェーズ6: ヘルスチェック
# =============================================================================

echo ""
log_info "フェーズ6: ヘルスチェック実行中..."

# バックエンドヘルスチェック
log_info "バックエンドAPI (/api/health) をテスト..."
sleep 3  # サービス起動待機
HEALTH_RESPONSE=$(curl -s http://localhost:4000/api/health 2>/dev/null || echo "{}")

if echo "$HEALTH_RESPONSE" | grep -q '"status":"OK"'; then
    log_success "バックエンドAPI: OK"
    log_to_file "バックエンドAPI: 正常"
else
    log_warning "バックエンドAPI: 応答あり（確認中）"
    log_info "レスポンス: $HEALTH_RESPONSE"
    log_to_file "バックエンドAPI応答: $HEALTH_RESPONSE"
fi

# Nginxポート確認
log_info "Nginx (HTTPS/443) をテスト..."
if sudo netstat -tuln 2>/dev/null | grep -q ":443 "; then
    log_success "HTTPS(443): リッスン中"
    log_to_file "Nginx: 正常"
else
    log_warning "HTTPS(443): リッスン状態確認失敗"
fi

# =============================================================================
# フェーズ7: 詳細なステータスレポート
# =============================================================================

echo ""
log_info "フェーズ7: 詳細ステータスレポート生成中..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 サービス状態レポート"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# MySQL状態
echo "🗄️  MySQL:"
if sudo systemctl is-active --quiet mysql; then
    echo "   状態: ✅ 稼働中"
    MYSQL_VERSION=$(mysql -u cleaning_user -p"C1eaning!2025_VPS" cleaning_system -e "SELECT VERSION();" 2>/dev/null | tail -1)
    echo "   版: $MYSQL_VERSION"
else
    echo "   状態: ❌ 停止中"
fi
echo ""

# バックエンド状態
echo "🔧 バックエンド (Node.js):"
if pm2 status 2>&1 | grep -q "cleaning-backend"; then
    echo "   状態: ✅ PM2で稼働中"
    PM2_STATUS=$(pm2 status | grep cleaning-backend | grep -oE "online|stopped|errored" || echo "unknown")
    echo "   PM2状態: $PM2_STATUS"
    PM2_MEM=$(pm2 status | grep cleaning-backend | awk '{print $NF}' | head -1)
    echo "   メモリ: $PM2_MEM"
else
    echo "   状態: ⚠️  PM2で見つかりません"
fi
echo ""

# Nginx状態
echo "🌐 Nginx (リバースプロキシ):"
if sudo systemctl is-active --quiet nginx; then
    echo "   状態: ✅ 稼働中"
    echo "   ドメイン: marunage-report.xyz"
    echo "   プロトコル: HTTPS (SSL/TLS)"
else
    echo "   状態: ❌ 停止中"
fi
echo ""

# ファイアウォール状態
echo "🔒 ファイアウォール:"
if sudo systemctl is-active --quiet ufw; then
    echo "   状態: ✅ UFW有効"
else
    echo "   状態: ℹ️  UFW無効"
fi
echo ""

# ディスク状態
echo "💾 ディスク使用量:"
DISK_USAGE=$(df -h "$PROJECT_ROOT" | tail -1 | awk '{print $5}')
echo "   使用率: $DISK_USAGE"
echo ""

# アップロードディレクトリ
echo "📁 アップロードディレクトリ:"
if [ -d "$BACKEND_DIR/uploads" ]; then
    UPLOAD_SIZE=$(du -sh "$BACKEND_DIR/uploads" | cut -f1)
    echo "   パス: $BACKEND_DIR/uploads"
    echo "   サイズ: $UPLOAD_SIZE"
else
    echo "   状態: ❌ ディレクトリが見つかりません"
fi
echo ""

# PM2ログ確認
echo "📝 最近のバックエンドログ:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pm2 logs cleaning-backend --lines 5 --nostream 2>&1 | tail -10
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# =============================================================================
# 完了
# =============================================================================

echo ""
log_success "再起動プロセスが完了しました！"
log_to_file "再起動完了"

echo ""
echo "📋 次のステップ:"
echo "   1. ブラウザで https://marunage-report.xyz にアクセス"
echo "   2. ログインテスト"
echo "   3. 写真・領収書のアップロード/ダウンロードテスト"
echo ""

echo "📖 詳細ログ:"
echo "   $LOG_FILE"
echo ""

echo "📊 詳細なシステムレポートは以下を参照:"
echo "   $PROJECT_ROOT/DEPLOYMENT_STATUS.md"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
