#!/bin/bash

# 清掃写真・領収書共有システム 停止スクリプト

echo "🛑 清掃写真・領収書共有システムを停止します..."
echo ""

# プロジェクトルートディレクトリを取得
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# PIDファイルから読み込んで停止
if [ -f "$PROJECT_ROOT/.backend.pid" ]; then
    BACKEND_PID=$(cat "$PROJECT_ROOT/.backend.pid")
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo "📦 バックエンド (PID: $BACKEND_PID) を停止しています..."
        kill $BACKEND_PID
        echo "✅ バックエンドを停止しました"
    else
        echo "⚠️  バックエンドプロセスが見つかりません"
    fi
    rm "$PROJECT_ROOT/.backend.pid"
fi

if [ -f "$PROJECT_ROOT/.frontend.pid" ]; then
    FRONTEND_PID=$(cat "$PROJECT_ROOT/.frontend.pid")
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo "🎨 フロントエンド (PID: $FRONTEND_PID) を停止しています..."
        kill $FRONTEND_PID
        echo "✅ フロントエンドを停止しました"
    else
        echo "⚠️  フロントエンドプロセスが見つかりません"
    fi
    rm "$PROJECT_ROOT/.frontend.pid"
fi

# 念のため、ポートを使用しているプロセスを確認
echo ""
echo "🔍 ポート使用状況を確認しています..."

BACKEND_PORT_PID=$(lsof -ti:4001 2>/dev/null)
if [ ! -z "$BACKEND_PORT_PID" ]; then
    echo "⚠️  ポート4001がまだ使用されています (PID: $BACKEND_PORT_PID)"
    echo "   停止しますか? (y/N): "
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        kill $BACKEND_PORT_PID
        echo "✅ ポート4001のプロセスを停止しました"
    fi
fi

FRONTEND_PORT_PID=$(lsof -ti:3000 2>/dev/null)
if [ ! -z "$FRONTEND_PORT_PID" ]; then
    echo "⚠️  ポート3000がまだ使用されています (PID: $FRONTEND_PORT_PID)"
    echo "   停止しますか? (y/N): "
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        kill $FRONTEND_PORT_PID
        echo "✅ ポート3000のプロセスを停止しました"
    fi
fi

echo ""
echo "✨ 停止処理が完了しました"
