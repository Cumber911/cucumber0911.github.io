#!/bin/bash

# スクリプトが置かれているフォルダの絶対パスを取得
DIR="$(cd "$(dirname "$0")" && pwd)"

# Terminalで対象フォルダに移動し、HTTPサーバーを起動
/usr/bin/osascript - "$DIR" <<'APPLESCRIPT'
on run argv
    set targetFolder to item 1 of argv
    tell application "Terminal"
        activate
        do script "cd " & quoted form of targetFolder & " && python3 -m http.server 8000"
    end tell
end run
APPLESCRIPT

# ChromeでURLを開く
sleep 2
/usr/bin/open -a "Google Chrome" "http://127.0.0.1:8000/"