import { LABELS, formatChoice } from "./config.js";

export const CURRENT_SESSION_KEY = "lyricExperimentCurrentSession";
export const storageKey = id => `lyricExperimentResults:${id}`;

export function storeResults(id, results) {
  localStorage.setItem(storageKey(id), JSON.stringify(results));
}

export function readResults(id) {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(id)) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function settingsLines(settings) {
  return Object.entries(LABELS).map(([key, label]) =>
    `${label}：${formatChoice(key, settings[key])}`
  );
}

export function downloadResults(id, results) {
  const lines = [
    "リリックビデオ制作実験　選択結果",
    `実験ID：${id}`,
    `出力日時：${new Date().toLocaleString("ja-JP")}`,
    `完了曲数：${results.length}`,
    ""
  ];
  for (const entry of results) {
    lines.push(`========== ${entry.songNumber}曲目 ==========`,
      `WAVファイル：${entry.wavFile}`,
      `決定日時：${entry.confirmedAt}`,
      "", "【初期設定】", ...settingsLines(entry.initialSettings),
      "", "【最終選択】", ...settingsLines(entry.finalSettings), "");
  }
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/plain;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `lyric_experiment_${id.slice(0, 8)}.txt`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
