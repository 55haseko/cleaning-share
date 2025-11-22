#!/bin/bash

# 清掃写真・領収書共有システム 起動スクリプト

echo "🚀 清掃写真・領収書共有システムを起動します..."
echo ""

# プロジェクトルートディレクトリを取得
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 環境変数ファイルの確認
if [ ! -f "$PROJECT_ROOT/backend/.env" ]; then
    echo "❌ エラー: backend/.env が見つかりません"
    echo "   backend/.env.example をコピーして backend/.env を作成してください"
    exit 1
fi

if [ ! -f "$PROJECT_ROOT/frontend/.env" ]; then
    echo "❌ エラー: frontend/.env が見つかりません"
    echo "   以下の内容で frontend/.env を作成してください:"
    echo "   REACT_APP_API_URL=http://localhost:4001/api"
    exit 1
fi

# バックエンドの起動
echo "📦 バックエンドを起動しています... (ポート4001)"
cd "$PROJECT_ROOT/backend"
npm start > backend.log 2>&1 &
BACKEND_PID=$!
echo "   バックエンドPID: $BACKEND_PID"

# バックエンドの起動を待つ
echo "⏳ バックエンドの起動を待っています..."
sleep 3

# バックエンドの健全性チェック
if curl -s http://localhost:4001/api/health > /dev/null 2>&1; then
    echo "✅ バックエンドが正常に起動しました"
else
    echo "⚠️  バックエンドの起動を確認できません（起動中の可能性があります）"
fi

# フロントエンドの起動
echo ""
echo "🎨 フロントエンドを起動しています... (ポート3000)"
cd "$PROJECT_ROOT/frontend"
npm start > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   フロントエンドPID: $FRONTEND_PID"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ システムが起動しました！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📱 アプリケーション: http://localhost:3000"
echo "🔧 バックエンドAPI:  http://localhost:4001"
echo ""
echo "📋 ログイン情報:"
echo "   管理者:     admin@cleaning.com / admin123"
echo "   スタッフ:   staff1@cleaning.com / staff123"
echo "   クライアント: client1@example.com / client123"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 ログファイル:"
echo "   バックエンド: $PROJECT_ROOT/backend/backend.log"
echo "   フロントエンド: $PROJECT_ROOT/frontend/frontend.log"
echo ""
echo "🛑 停止するには Ctrl+C を押すか、以下のコマンドを実行してください:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo ""

# PIDファイルに保存
echo $BACKEND_PID > "$PROJECT_ROOT/.backend.pid"
echo $FRONTEND_PID > "$PROJECT_ROOT/.frontend.pid"

# プロセスの監視（オプション）
wait
