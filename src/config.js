// 現行仕様の13項目をここで一元管理します。
export const CHOICES = {
  font: ["明朝1", "明朝2", "ゴシック1", "ゴシック2", "筆書1", "筆書2", "ポップ", "ドット風"],
  textColor: ["黒", "白"],
  writing: ["横", "縦"],
  fontSize: [10, 16, 22],
  jitter: [0, 10, 20, 30, 40],
  split: ["文", "単語", "文字"],
  movement: ["無", "有"],
  direction: ["左から", "右から", "上から", "下から"],
  easing: ["無", "有"],
  opacity: [0, 25, 50, 75, 100],
  scale: [100, 50, 0],
  rotation: ["無", "有"],
  background: ["白", "黒", "赤", "黄", "青緑", "青", "ピンク"]
};

export const LABELS = {
  font: "フォント",
  textColor: "文字色",
  writing: "文字組み",
  fontSize: "文字サイズ",
  jitter: "座標ランダムずれ",
  split: "分割方法",
  movement: "移動",
  direction: "移動方向",
  easing: "移動イージング",
  opacity: "開始時不透明度",
  scale: "開始時拡大率",
  rotation: "開始時回転",
  background: "背景色"
};

export const GROUPS = [
  { title: "文字", keys: ["font", "textColor"] },
  { title: "文字配置", keys: ["writing", "fontSize", "jitter"] },
  { title: "登場方法", keys: ["split", "movement", "direction", "easing", "opacity", "scale", "rotation"] },
  { title: "色", keys: ["background"] }
];

export const FONT_FAMILIES = {
  "明朝1": '"HannariMincho", "Yu Mincho", "Hiragino Mincho ProN", serif',
  "明朝2": '"ShipporiMincho", "Yu Mincho", "Hiragino Mincho ProN", serif',
  "ゴシック1": '"GenEiGothicM-R", "Yu Gothic", sans-serif',
  "ゴシック2": '"GenEiGothicM-H", "Yu Gothic", sans-serif',
  "筆書1": '"syunka2", "syunka2", serif',
  "筆書2": '"Tamanegi-Kaisho-Geki", "Yu Mincho", serif',
  "ポップ": '"LightNovelPOP", "Yu Gothic", sans-serif',
  "ドット風": '"DotGothic16", "Yu Gothic", cursive'
};

export const BACKGROUND_COLORS = {
  "白": "#ffffff", "黒": "#111111", "赤": "#e74848",
  "黄": "#ffe450", "青緑": "#3accc3", "青": "#4479e8", "ピンク": "#ff95cc"
};

export const SONGS = [
  { wav: "1_sampleA.wav", lyrics: "1_sampleA.json" },
  { wav: "2_sampleB.wav", lyrics: "2_sampleB.json" },
  { wav: "3_sampleC.wav", lyrics: "3_sampleC.json" },
  { wav: "4_sampleD.wav", lyrics: "4_sampleD.json" },
  { wav: "5_sampleE.wav", lyrics: "5_sampleE.json" }
];

export function formatChoice(key, value) {
  if (value === "適用なし") return value;
  if (["fontSize", "jitter"].includes(key)) return key === "jitter" ? `最大${value}px` : `${value}px`;
  if (["opacity", "scale"].includes(key)) return `${value}%`;
  if (key === "rotation" && value === "有") return "有（90度）";
  if (key === "easing" && value === "有") return "有（quartOut）";
  return String(value);
}

export function randomChoice(values) {
  // ランダム初期化のみ。座標ずれは renderer.js で固定的に算出します。
  return values[Math.floor(Math.random() * values.length)];
}

export function createInitialSettings() {
  const values = Object.fromEntries(
    Object.entries(CHOICES).map(([key, choices]) => [key, randomChoice(choices)])
  );
  values.background = randomChoice(
    CHOICES.background.filter(color => color !== values.textColor)
  );
  return values;
}

export function normaliseSettings(settings) {
  const fixed = { ...settings };
  if (fixed.textColor === fixed.background) {
    fixed.background = CHOICES.background.find(color => color !== fixed.textColor);
  }
  return fixed;
}
