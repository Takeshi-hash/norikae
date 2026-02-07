#!/bin/bash

# スクリプトのあるディレクトリに移動
cd "$(dirname "$0")"

# ログファイル
LOG_FILE="server_debug.log"

echo "Starting Norikae Admin Tool..."
echo "---------------------------------------------------------"
echo "ログを $LOG_FILE に書き込んでいます。"
echo "ブラウザはサーバー起動を確認してから開きます..."
echo "---------------------------------------------------------"

# PATHの設定（重要：npmが見つかるように）
export PATH=$PATH:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin

# 背景でサーバー起動待ち＆ブラウザ起動を行う関数
wait_and_open() {
    echo "Waiting for server..."
    # 30秒間、1秒ごとに接続確認
    for i in {1..30}; do
        if curl -s http://localhost:3000 >/dev/null; then
            echo "Server is UP! Opening admin page..."
            open "http://localhost:3000/admin.html"
            exit 0
        fi
        sleep 1
    done
    echo "Timeout: Server did not respond."
}

# 待ち受けプロセスをバックグラウンドで開始
wait_and_open &

# サーバーを起動 (フォアグラウンド)
# エラーも含めてログに出力しつつ、画面にも出す（tee）
if command -v npm >/dev/null 2>&1; then
    echo "Running 'npm start'..."
    npm start 2>&1 | tee "$LOG_FILE"
else
    echo "Error: npm command not found!" | tee -a "$LOG_FILE"
    echo "Current PATH: $PATH" | tee -a "$LOG_FILE"
    echo "Press any key to exit..."
    read -n 1
fi
