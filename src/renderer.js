import { BACKGROUND_COLORS, FONT_FAMILIES } from "./config.js";
import { groupIntoUnits, layoutCharacters } from "./lyric-layout.js";
import { activePhraseAt, phraseDisplayEnd, unitAnimationTiming } from "./timeline.js";

const quartOut = t => 1 - Math.pow(1 - t, 4);
const REFERENCE_VIDEO_WIDTH = 640;
const MIN_ADJACENT_JITTER_GAP = 0.35;

// 同じ歌詞単位はループしても同じずれを使う。
function jitterFactor(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  }
  // MurmurHash3 の最終ミックスで連番のIDも異なるずれに分散させる。
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295 * 2 - 1;
}

export function createRenderer(preview, stage) {
  const context = document.createElement("canvas").getContext("2d");
  let preparedPhrases = [];
  let preparedSplit = null;
  let groups = new Map();
  let visibleGroup = null;
  let layoutKey = null;
  let layoutDirty = true;

  function clear() {
    stage.replaceChildren();
    preparedPhrases = [];
    preparedSplit = null;
    groups.clear();
    visibleGroup = null;
    layoutKey = null;
    layoutDirty = true;
  }

  // 文字を描画単位で切り分けても、共通の文字列座標を使う。
  // すべてのフレーズのDOMを曲の再生前に作っておくので、文の切り替え時にDOMを再生成しない。
  function buildGroups(split) {
    const fragment = document.createDocumentFragment();
    const nextGroups = new Map();
    for (const phrase of preparedPhrases) {
      const group = document.createElement("div");
      group.className = "lyric-group";
      group.dataset.phraseId = phrase.id;
      group.style.display = "none";
      let previousJitter;
      // ずれは実際の描画単位（文・文節・文字）ごとに割り当てる。
      const units = groupIntoUnits(phrase, split).map((unit, index) => {
        let jitter = jitterFactor(`${phrase.id}:${split}:${index}`);
        if (previousJitter !== undefined && Math.abs(jitter - previousJitter) < MIN_ADJACENT_JITTER_GAP) {
          // 隣接する文節や文字が同じ位置にずれたように見えないようにする。
          jitter += jitter < 0 ? 1 : -1;
        }
        // 空白を挟んだ場合も、目に見える前の単位との間にずれの差をつける。
        if (unit.characters.some(char => char.text.trim())) previousJitter = jitter;
        const el = document.createElement("div");
        el.className = "lyric-unit";
        const glyphs = unit.characters.map(char => {
          const glyph = document.createElement("span");
          glyph.className = "lyric-glyph";
          glyph.textContent = char.text;
          el.append(glyph);
          return { el: glyph, id: char.id };
        });
        group.append(el);
        return { el, startTime: unit.startTime, glyphs, jitter };
      });
      nextGroups.set(phrase.id, { group, phrase, units, timingMovement: null });
      fragment.append(group);
    }
    stage.replaceChildren(fragment);
    groups = nextGroups;
    preparedSplit = split;
    visibleGroup = null;
    layoutDirty = true;
  }

  function prepare(phrases, settings) {
    clear();
    preparedPhrases = phrases;
    buildGroups(settings.split);
    // 初回フレームの前に全歌詞のレイアウトを確定する。
    relayout(settings, videoScale());
  }

  function videoScale() {
    return Math.max(1, stage.clientWidth) / REFERENCE_VIDEO_WIDTH;
  }

  function relayout(settings, displayScale) {
    const fontSize = settings.fontSize * displayScale;
    // 各フォントファイル（H/ExtraBold 等）自体に太さが収録されている。
    // CSS の 800 指定で人工的に太らせると字形の端が欠けやすいため使用しない。
    const fontWeight = 400;
    const fontFamily = FONT_FAMILIES[settings.font];
    stage.style.fontFamily = fontFamily;
    stage.style.fontSize = `${fontSize}px`;
    stage.style.fontWeight = String(fontWeight);
    stage.style.color = settings.textColor === "白" ? "#fff" : "#000";
    if (context) context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

    const maxWidth = stage.clientWidth * 0.84;
    const maxHeight = stage.clientHeight * 0.84;
    const measureGlyph = text => context ? context.measureText(text).width : fontSize;

    for (const { group, phrase, units } of groups.values()) {
      const layout = layoutCharacters(phrase, {
        writing: settings.writing, fontSize, maxWidth, maxHeight, measureGlyph
      });
      group.style.width = `${layout.width}px`;
      group.style.height = `${layout.height}px`;
      group.style.transform = `translate(-50%, -50%) scale(${layout.scale})`;
      for (const unit of units) {
        const positions = unit.glyphs.map(glyph => ({ glyph, slot: layout.slots.get(glyph.id) }))
          .filter(item => item.slot);
        if (!positions.length) {
          unit.el.style.visibility = "hidden";
          continue;
        }
        // 各分割単位の外接矩形に対して絶対配置。単位間の空白は作られない。
        const minX = Math.min(...positions.map(({ slot }) => slot.x));
        const minY = Math.min(...positions.map(({ slot }) => slot.y));
        const maxX = Math.max(...positions.map(({ slot }) => slot.x + slot.width));
        const maxY = Math.max(...positions.map(({ slot }) => slot.y + slot.height));
        unit.el.style.left = `${minX}px`;
        unit.el.style.top = `${minY}px`;
        unit.el.style.width = `${maxX - minX}px`;
        unit.el.style.height = `${maxY - minY}px`;
        for (const { glyph, slot } of positions) {
          glyph.el.style.left = `${slot.x - minX}px`;
          glyph.el.style.top = `${slot.y - minY}px`;
          glyph.el.style.width = `${slot.width}px`;
          glyph.el.style.height = `${slot.height}px`;
        }
      }
    }
    layoutDirty = false;
  }

  function update(now, phrases, settings) {
    preview.style.background = BACKGROUND_COLORS[settings.background];
    if (preparedPhrases !== phrases) prepare(phrases, settings);
    if (preparedSplit !== settings.split) buildGroups(settings.split);

    const displayScale = videoScale();
    const newLayoutKey = [settings.font, settings.fontSize, settings.writing,
      stage.clientWidth, stage.clientHeight].join("|");
    if (layoutDirty || layoutKey !== newLayoutKey) {
      relayout(settings, displayScale);
      layoutKey = newLayoutKey;
    }
    stage.style.color = settings.textColor === "白" ? "#fff" : "#000";

    const phrase = activePhraseAt(preparedPhrases, now, settings);
    const next = phrase ? groups.get(phrase.id) : null;
    if (!next) {
      if (visibleGroup) visibleGroup.group.style.display = "none";
      visibleGroup = null;
      return;
    }

    // 新しい文を見せる前に全ユニットの表示状態と変形を更新。
    // 「文」モードの最初のフレームにもアニメーションの初期状態が適用される。
    if (next.timingMovement !== settings.movement) {
      const displayEnd = phraseDisplayEnd(preparedPhrases, phrase, settings);
      for (const unit of next.units) {
        unit.timing = unitAnimationTiming(unit.startTime, phrase, displayEnd, settings);
      }
      next.timingMovement = settings.movement;
    }
    for (const unit of next.units) {
      const { start, duration } = unit.timing;
      if (now < start) {
        unit.el.style.visibility = "hidden";
        continue;
      }
      unit.el.style.visibility = "visible";
      const t = duration > 0 ? Math.min(1, (now - start) / duration) : 1;
      const ease = settings.easing === "あり" ? quartOut(t) : t;
      const distance = 100 * displayScale * (1 - ease);
      let dx = 0, dy = 0;
      if (settings.movement === "あり") {
        if (settings.direction === "左から") dx = -distance;
        if (settings.direction === "右から") dx = distance;
        if (settings.direction === "上から") dy = -distance;
        if (settings.direction === "下から") dy = distance;
      }
      // 横組みは上下のみ、縦組みは左右のみ。不規則な文字順入れ替わりを防ぐ。
      const offset = unit.jitter * settings.jitter * displayScale;
      if (settings.writing === "縦") dx += offset;
      else dy += offset;

      const opacity = settings.opacity / 100 + (1 - settings.opacity / 100) * t;
      const scale = settings.scale / 100 + (1 - settings.scale / 100) * t;
      const rotationProgress = settings.rotationEasing === "あり" ? quartOut(t) : t;
      const rotation = settings.rotation === "あり" ? 90 * (1 - rotationProgress) : 0;
      unit.el.style.opacity = String(opacity);
      unit.el.style.transform = `translate(${dx}px, ${dy}px) rotate(${rotation}deg) scale(${scale})`;
    }
    if (visibleGroup !== next) {
      if (visibleGroup) visibleGroup.group.style.display = "none";
      next.group.style.display = "";
      visibleGroup = next;
    }
  }

  // 選ばれた書体を曲の開始前にロードし、再生中のフォント入替えを抑える。
  async function ensureFont(settings) {
    if (!document.fonts?.load) return;
    const family = FONT_FAMILIES[settings.font].split(",")[0];
    await document.fonts.load(`${settings.fontSize}px ${family}`);
    layoutDirty = true;
  }

  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => { layoutDirty = true; }).observe(stage);
  }
  document.fonts?.addEventListener?.("loadingdone", () => { layoutDirty = true; });

  return { clear, prepare, update, ensureFont };
}
