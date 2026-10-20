# フォントの配置

指定された各フォントの配布・改変・Web埋め込みライセンスを確認してから、次の名前の WOFF2 ファイルをこのディレクトリに配置してください。

- hannari.woff2 — はんなり明朝
- mutsuki.woff2 — むつき明朝
- noto-sans-jp-regular.woff2 — Noto Sans JP 細字向け（必要なウェイトで調整）
- noto-sans-jp-bold.woff2 — Noto Sans JP 太字向け
- yuji-shuku.woff2 — 佑字 肅
- kouzan.woff2 — 衡山毛筆
- ranobe-pop.woff2 — ラノベPOP
- mikachan.woff2 — みかちゃん

同梱はしていません。配置前はブラウザの代替フォントでプレビューされるので、実験本番には利用しないでください。
TTF/OTFをそのまま使う場合、src/style.css の @font-face のURLと format() を合わせて修正してください。
