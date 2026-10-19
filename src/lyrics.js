import { TEXTALIVE_TOKEN } from "./user-config.js";

let player = null;
let engineState = "ローカルJSON";

// TextAlive App API: トークンが設定されている場合は公式 createFromJSON() を使用。
// 音声再生は別の HTMLAudioElement が担い、音声時刻を唯一の同期基準とします。
let apiReadyPromise = null;
function loadExternalScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    const timer = setTimeout(() => reject(new Error(`CDNタイムアウト: ${url}`)), 9000);
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = () => { clearTimeout(timer); reject(new Error(`CDN読み込み失敗: ${url}`)); };
    document.head.append(script);
  });
}

async function getPlayer() {
  if (!TEXTALIVE_TOKEN.trim()) return null;
  if (player) return player;
  if (!apiReadyPromise) {
    apiReadyPromise = (async () => {
      // 公式ドキュメントに掲載された script タグ方式で読み込み。
      await loadExternalScript("https://unpkg.com/axios/dist/axios.min.js");
      await loadExternalScript("https://unpkg.com/textalive-app-api/dist/index.js");
      const Player = window.TextAliveApp?.Player;
      if (!Player) throw new Error("TextAliveApp.Player が見つかりません");
      player = new Player({ app: { token: TEXTALIVE_TOKEN } });
      return player;
    })();
  }
  return apiReadyPromise;
}

function normalizeFromJSON(raw) {
  return raw.phrases.map((phrase, phraseIndex) => ({
    id: `p${phraseIndex}`,
    startTime: phrase.startTime,
    endTime: phrase.endTime,
    text: phrase.words.map(word => word.characters.map(char => char.char).join("")).join(""),
    words: phrase.words.map((word, wordIndex) => ({
      id: `p${phraseIndex}w${wordIndex}`,
      startTime: word.startTime,
      endTime: word.endTime,
      text: word.characters.map(char => char.char).join(""),
      characters: word.characters.map((char, charIndex) => ({
        id: `p${phraseIndex}w${wordIndex}c${charIndex}`,
        startTime: char.startTime,
        endTime: char.endTime,
        text: char.char
      }))
    }))
  }));
}

function normalizeFromAPI(video) {
  // TextAlive公式APIで構築された時間付き単位を取得。
  // 各フレーズ内の単語・文字は時刻で割り当てます。
  return video.phrases.map((p, phraseIndex) => {
    const words = video.words.filter(w =>
      w.startTime >= p.startTime - 1 && w.endTime <= p.endTime + 1
    ).map((w, wordIndex) => ({
      id: `p${phraseIndex}w${wordIndex}`,
      startTime: w.startTime,
      endTime: w.endTime,
      text: w.text,
      characters: video.chars.filter(c =>
        c.startTime >= w.startTime - 1 && c.endTime <= w.endTime + 1
      ).map((c, charIndex) => ({
        id: `p${phraseIndex}w${wordIndex}c${charIndex}`,
        startTime: c.startTime,
        endTime: c.endTime,
        text: c.text ?? c.char
      }))
    }));
    return {
      id: `p${phraseIndex}`,
      startTime: p.startTime,
      endTime: p.endTime,
      text: p.text,
      words
    };
  });
}

export async function loadLyrics(filename, assetPrefix = "") {
  const response = await fetch(`${assetPrefix}/lyrics/${encodeURIComponent(filename)}`);
  if (!response.ok) throw new Error(`歌詞JSONを読み込めません: ${filename}`);
  const raw = await response.json();
  validateLyrics(raw, filename);

  if (TEXTALIVE_TOKEN.trim()) {
    try {
      const textalive = await getPlayer();
      const video = await textalive.createFromJSON(raw);
      const phrases = normalizeFromAPI(video);
      if (!phrases.length || phrases.some(p => !p.words.length)) {
        throw new Error("APIで歌詞単位を取得できませんでした");
      }
      engineState = "TextAlive App API";
      return phrases;
    } catch (error) {
      console.warn("TextAlive APIでの読み込みに失敗し、ローカルJSONで続行します", error);
    }
  }
  engineState = "ローカルJSON";
  return normalizeFromJSON(raw);
}

export function getLyricsEngine() { return engineState; }

function validateLyrics(data, filename) {
  if (!Array.isArray(data.phrases) || data.phrases.length === 0) {
    throw new Error(`${filename}: phrases 配列がありません`);
  }
  for (const phrase of data.phrases) {
    if (!(phrase.endTime > phrase.startTime) || !Array.isArray(phrase.words)) {
      throw new Error(`${filename}: phrases に startTime/endTime/words が必要です`);
    }
    for (const word of phrase.words) {
      if (!(word.endTime > word.startTime) || !Array.isArray(word.characters)) {
        throw new Error(`${filename}: words に startTime/endTime/characters が必要です`);
      }
      for (const char of word.characters) {
        if (typeof char.char !== "string" || !(char.endTime > char.startTime)) {
          throw new Error(`${filename}: characters に char と時刻が必要です`);
        }
      }
    }
  }
}
