import { SONGS } from "./config.js";
import { LABELS, formatChoice } from "./experiment-settings.js";

export const CURRENT_SESSION_KEY = "lyricExperimentCurrentSession";
export const storageKey = id => `lyricExperimentResults:${id}`;

export function storeSession(id, session) {
  localStorage.setItem(storageKey(id), JSON.stringify(session));
}

export function readSession(id) {
  const fresh = { practiceDone: false, results: [], impressions: [], survey: null };
  if (!id) return fresh;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(id)) || "null");
    // 旧版の配列で保存された結果も読み出せるようにする。
    if (Array.isArray(saved)) {
      return { ...fresh, practiceDone: saved.length > 0, results: saved,
        legacyFinished: saved.length === SONGS.length };
    }
    if (saved && Array.isArray(saved.results) && Array.isArray(saved.impressions)) {
      return { ...fresh, ...saved };
    }
  } catch {
    // 壊れた保存データの場合は初期状態から開始。
  }
  return fresh;
}

export function isSessionFinished(session) {
  const songCount = session.songOrder?.length ?? SONGS.length;
  return session.results.length === songCount && (
    session.legacyFinished || (session.impressions.length === songCount && session.survey !== null)
  );
}

function settingsLines(settings) {
  return Object.entries(LABELS)
    .filter(([key]) => Object.hasOwn(settings, key))
    .map(([key, label]) => `${label}：${formatChoice(key, settings[key])}`);
}

export function downloadResults(id, session) {
  const { results, impressions, survey } = session;
  const lines = [
    "リリックビデオ制作実験　選択結果",
    `実験ID：${id}`,
    `出力日時：${new Date().toLocaleString("ja-JP")}`,
    `完了曲数：${results.length}`,
    ""
  ];
  results.forEach((entry, index) => {
    lines.push(`========== ${entry.songNumber}曲目 ==========`,
      `WAVファイル：${entry.wavFile}`,
      `決定日時：${entry.confirmedAt}`,
      "", "【初期設定】", ...settingsLines(entry.initialSettings),
      "", "【最終選択】", ...settingsLines(entry.finalSettings), "");
    if (index < impressions.length) {
      lines.push("【楽曲と作成した動画に対して感じる印象や感想（自由記述）】",
        impressions[index] || "（未記入）", "");
    }
  });
  if (survey) {
    lines.push("========== 実験全体を通しての質問 ==========",
      `動画制作の経験：${survey.videoExperience}`,
      `MV・リリックビデオ制作の経験：${survey.lyricVideoExperience}`,
      `本実験で使用したアプリの動画の作りやすさ：${survey.easeOfUse}点`,
      "", "【実験全体を通しての感想】", survey.comments || "（未記入）", "");
  }
  const blob = new Blob(["\uFEFF" + lines.join("\n").replace(/\r?\n/g, "\r\n")],
    { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `lyric_experiment_${id.slice(0, 8)}.txt`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
