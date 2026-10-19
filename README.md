# リリックビデオ制作実験 — 動作するViteプロジェクト

## 何ができるか

- 初期画面「開始」→ 実験用の新しいウィンドウ → 5曲目の決定 → 元画面の「結果ダウンロード」
- 16:9プレビュー、13項目のラジオボタン（全項目ランダム初期値）、設定欄スクロール
- 文・単語・文字ごとの歌詞描画、文字演出、背景色、音源のWAVループ
- 曲順・WAV名・ランダム初期値・最終選択値をUTF-8/BOM付きTXTで保存
- ブラウザ制限で自動再生できない場合、別ウィンドウ内の「全画面で再生開始」で再開

## 必要なもの

- Python 3 または Node.js （Webサーバを起動するため。デモは追加パッケージ不要）
- Chrome/Edgeなどのモダンブラウザ
- インターネット接続（TextAlive公式API利用時）

## 起動手順

```bash
python -m http.server 8000
```

Windows で `python` が見つからない場合は `py -m http.server 8000` をお試しください。
`http://127.0.0.1:8000/` を開き、「開始」を押してください。
必要なら `npm install` → `npm run dev` でも実行できます（Vite開発サーバ）。
音声の自動再生や全画面化がブラウザに拒否された場合は、新しいウィンドウのボタンを押します。
`index.html` をファイルとして直接ダブルクリックしても、ES Modules や fetch の制約のため正常には動きません。必ずWebサーバ経由で開いてください。

## 公式TextAlive App APIを有効化

1. https://developer.textalive.jp/ で開発者登録し、アプリトークンを取得します。
2. `src/user-config.js` の `TEXTALIVE_TOKEN = ""` の中にトークンを記入します。
3. ブラウザを再読み込みします。

トークンを設定した場合、公式サイトに記載の script タグ形式で `axios` と `textalive-app-api` をCDNから読み込み、`src/lyrics.js` 内で `new Player({ app: { token } })` および `await player.createFromJSON(raw)` を使用して歌詞情報を構築します。失敗した場合はローカルJSONへフォールバックし、ブラウザコンソールに警告します。
未設定でも5曲のデモは操作できます。ただし、**トークン未設定のデモ実行は「TextAlive APIを実際に呼び出した実験」ではありません**。本番では必ず設定・検証してください。

公式データ形式: https://developer.textalive.jp/packages/textalive-app-api/interfaces/VideoData.html

## 自分の5曲へ差し替え

- `public/audio/` に、`1_曲名.wav` から `5_曲名.wav` の5つのWAVファイルを保存します（20～40秒推奨）。
- `public/lyrics/` に曲順と曲名が対応した `1_曲名.json` から `5_曲名.json` を保存します。
- `src/config.js` の `SONGS` 配列を実ファイル名で書き換えます。
- `public/fonts/README.md` に従って、許諾を確認した8種類のフォントを配置します。

`generate_demo_assets.py`（任意。実行する場合は `numpy` が必要）は架空の電子音メロディと仮歌詞タイミングのデモファイルを生成するものであり、同じものが `public/audio/` と `public/lyrics/` に同梱されています。歌声は含まれません。**実験用の歌詞同期を保証するものではありません**。

### 歌詞JSONの最小例

```json
{
  "startTime": 0,
  "endTime": 24000,
  "duration": 24000,
  "phrases": [
    {
      "startTime": 1200,
      "endTime": 2600,
      "words": [
        {
          "startTime": 1200,
          "endTime": 2600,
          "characters": [
            {"char":"歌", "startTime":1200, "endTime":1900},
            {"char":"詞", "startTime":1900, "endTime":2600}
          ]
        }
      ]
    }
  ]
}
```

曲の音声再生位置（`audio.currentTime * 1000`）とJSONの時刻を同期しています。サビを切り取った音源では、切り取り位置のオフセットを調整してください。文はフレーズ単位、単語はwords単位、文字はcharacters単位で表示します。

## ファイルの役割

| ファイル | 役割 |
|---|---|
| `index.html` | 初期画面・終了画面 |
| `experiment.html` | 16:9プレビュー・設定欄・決定ボタン |
| `src/start.js` | ポップアップ開始と元ウィンドウへの結果受信 |
| `src/user-config.js` | TextAliveアプリトークン（任意。未設定はデモモード） |
| `src/experiment.js` | WAV再生、5曲切り替え、記録、ウィンドウの終了 |
| `src/config.js` | 13項目・色・書体・5つの曲名 |
| `src/settings.js` | ラジオボタン作成と選択不可条件 |
| `src/lyrics.js` | TextAlive createFromJSONとJSONフォールバック |
| `src/renderer.js` | フレーズ表示・横/縦組み・各種登場演出 |
| `src/results.js` | localStorage保存とTXTダウンロード |
| `src/style.css` | 添付画像風のグレー・左右2領域UI |

## 実験前に注意

- **ブラウザが自動の全画面化や自動再生を許可する保証はありません**。実験端末・ブラウザで実地確認し、手動再生ボタンが必要なら操作手順を統一してください。
- 8種類の指定フォントはライセンスの関係で同梱していません。本番では各フォントを配置し、読み込まれているかブラウザのネットワーク／開発者ツールで検証してください。
- デモは独立ウィンドウ間の `postMessage` と同一オリジン `localStorage` を使用します。実験本番では元画面を閉じないでください。
- 本番はこのフォルダ一式を静的Webサーバに配備できます。Viteでビルドすると `dist/` を配備できます。`file://` では開かないでください。
- 本実装は選択結果の保存のみです。動画のMP4書き出しや解析用サーバ送信は含みません。
- ローカルストレージの結果は実験用PC上に残ります。実験者がデータ管理方針を定め、毎回の実験開始時は「開始」で新しい実験IDを発行してください。

## 開発中の確認事項

各曲の開始直後のランダム初期値、背景同色制限、移動なしの場合の方向・イージング無効化、ループ時の歌詞再スタート、連続クリック、5曲目での元ウィンドウ復帰、TXTの文字化けを確認してください。
