// 画面表示の基準は常に WAV の audio.currentTime と JSON のミリ秒時刻。
// 移動が有効なときに限り、文・文節・文字の登場開始を300ms前倒しする。
export const MOVEMENT_LEAD_MS = 300;
const ANIMATION_DURATION_MS = 600;
const SPLIT_MOVEMENT_DURATION_MS = 300;
const MIN_ANIMATION_WINDOW_MS = 40;
const FULLY_VISIBLE_HOLD_MS = 80;
const SPLIT_MOVEMENT_HOLD_MS = 140;

export function leadTime(settings) {
  return settings.movement === "あり" ? MOVEMENT_LEAD_MS : 0;
}

// フレーズ終了後の猶予(+250ms)を設けない。前倒し開始が重なる場合は新しい文を優先。
// 特に新旧フレーズが接する境界では、次の文をその時刻から描画する。
export function activePhraseAt(phrases, now, settings) {
  const lead = leadTime(settings);
  let active = null;
  for (const phrase of phrases) {
    if (now >= phrase.startTime - lead && now < phrase.endTime &&
        (!active || phrase.startTime >= active.startTime)) {
      active = phrase;
    }
  }
  return active;
}

export function phraseDisplayEnd(phrases, phrase, settings) {
  const lead = leadTime(settings);
  let end = phrase.endTime;
  for (const next of phrases) {
    if (next.startTime > phrase.startTime) {
      end = Math.min(end, next.startTime - lead);
    }
  }
  return end;
}

export function unitAnimationTiming(unitStart, phrase, displayEnd, settings) {
  const lead = leadTime(settings);
  const splitMovement = lead > 0 && settings.split !== "文";
  const displayStart = Math.max(0, phrase.startTime - lead);
  const available = Math.max(0, displayEnd - displayStart);
  const targetHold = splitMovement ? SPLIT_MOVEMENT_HOLD_MS : FULLY_VISIBLE_HOLD_MS;
  const hold = Math.min(targetHold, available / 4);
  const finishBy = displayEnd - hold;

  // すべての文節・文字が静止して見える時間を、文の切り替え前に確保する。
  // JSON の登場時刻が遅すぎる場合だけ、短いアニメーションが入る位置まで前倒しする。
  const minWindow = Math.min(MIN_ANIMATION_WINDOW_MS, available / 4);
  const latestStart = finishBy - minWindow;
  const start = Math.max(displayStart, Math.min(unitStart - lead, latestStart));
  const maxDuration = splitMovement ? SPLIT_MOVEMENT_DURATION_MS : ANIMATION_DURATION_MS;
  return {
    start,
    duration: Math.max(0, Math.min(maxDuration, finishBy - start))
  };
}
