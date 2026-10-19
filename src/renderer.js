import { BACKGROUND_COLORS, FONT_FAMILIES } from "./config.js";

const clamp01 = x => Math.min(1, Math.max(0, x));
const quartOut = x => 1 - Math.pow(1 - x, 4);

// 歌詞単位ごとに安定した座標ずれを与え、毎フレームのちらつきを防ぎます。
function hash01(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  }
  return (h >>> 0) / 4294967295;
}
function jitter(id, amount, axis) {
  return (hash01(`${id}-${axis}`) * 2 - 1) * amount;
}

function unitsFor(phrase, split) {
  if (split === "文") return [phrase];
  if (split === "単語") return phrase.words;
  return phrase.words.flatMap(word => word.characters);
}

export function createRenderer(preview, stage) {
  let cachedPhraseId = null;
  let cachedSplit = null;
  let spans = [];
  let currentPhrase = null;

  function clear() {
    stage.replaceChildren();
    spans = [];
    cachedPhraseId = null;
    cachedSplit = null;
    currentPhrase = null;
  }

  function rebuild(phrase, split) {
    stage.replaceChildren();
    spans = [];
    cachedPhraseId = phrase?.id ?? null;
    cachedSplit = split;
    currentPhrase = phrase;
    if (!phrase) return;

    const group = document.createElement("div");
    group.className = "lyric-group";
    group.id = "active-lyric-group";
    for (const unit of unitsFor(phrase, split)) {
      const span = document.createElement("span");
      span.className = "lyric-unit";
      span.textContent = unit.text;
      group.append(span);
      spans.push({ el: span, unit });
    }
    stage.append(group);
  }

  function update(now, phrases, settings) {
    preview.style.background = BACKGROUND_COLORS[settings.background];
    // 発声しているフレーズを保持。ループ時は音声の currentTime に従い先頭へ。
    const phrase = phrases.find(p => now >= p.startTime && now <= p.endTime + 250) ?? null;
    if ((phrase?.id ?? null) !== cachedPhraseId || cachedSplit !== settings.split) {
      rebuild(phrase, settings.split);
    }
    if (!currentPhrase) return;

    const group = stage.querySelector(".lyric-group");
    group.style.writingMode = settings.writing === "縦" ? "vertical-rl" : "horizontal-tb";
    group.style.fontFamily = FONT_FAMILIES[settings.font];
    group.style.fontWeight = ["明朝2", "ゴシック2", "筆書2"].includes(settings.font) ? "800" : "400";
    group.style.fontSize = `${settings.fontSize}px`;
    group.style.color = settings.textColor === "白" ? "#fff" : "#000";

    for (const { el, unit } of spans) {
      if (now < unit.startTime || now > currentPhrase.endTime + 250) {
        el.style.visibility = "hidden";
        continue;
      }
      el.style.visibility = "visible";
      const t = clamp01((now - unit.startTime) / 600);
      const easing = settings.easing === "有" ? quartOut(t) : t;
      const travel = 100 * (1 - easing);
      let x = 0, y = 0;
      if (settings.movement === "有") {
        if (settings.direction === "左から") x = -travel;
        if (settings.direction === "右から") x = travel;
        if (settings.direction === "上から") y = -travel;
        if (settings.direction === "下から") y = travel;
      }
      x += jitter(unit.id, settings.jitter, "x");
      y += jitter(unit.id, settings.jitter, "y");
      const opacity = settings.opacity / 100 + (1 - settings.opacity / 100) * t;
      const scale = settings.scale / 100 + (1 - settings.scale / 100) * t;
      const rotation = settings.rotation === "有" ? 90 * (1 - t) : 0;
      el.style.opacity = String(opacity);
      el.style.transform = `translate(${x}px,${y}px) rotate(${rotation}deg) scale(${scale})`;
    }
  }

  return { clear, update };
}
