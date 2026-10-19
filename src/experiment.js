import { SONGS, createInitialSettings } from "./config.js";
import { createSettingsPanel } from "./settings.js";
import { loadLyrics, getLyricsEngine } from "./lyrics.js";
import { createRenderer } from "./renderer.js";
import { CURRENT_SESSION_KEY, readResults, storeResults } from "./results.js";

const sessionId = new URLSearchParams(location.search).get("session");
const preview = document.querySelector("#preview");
const stage = document.querySelector("#lyric-stage");
const settingsContainer = document.querySelector("#settings");
const songNumber = document.querySelector("#song-number");
const decideButton = document.querySelector("#decide");
const status = document.querySelector("#status");
const overlay = document.querySelector("#play-overlay");
const playButton = document.querySelector("#play-button");
const playMessage = document.querySelector("#play-message");

// Python の http.server は public/ 以下をそのまま公開します。
// Vite は public/ 以下をサイトのルートに公開します。
// この分岐により、どちらの起動方法でも同じプロジェクトを使用できます。
const assetPrefix = import.meta.env ? "" : "/public";

const audio = new Audio();
audio.loop = true;
audio.preload = "auto";
const renderer = createRenderer(preview, stage);

let songIndex = 0;
let settings = null;
let initialSettings = null;
let phrases = [];
let frameId = 0;
let changing = false;
let finished = false;
let trackReady = false;
let renderEpoch = 0;
const results = sessionId ? readResults(sessionId) : [];

function setStatus(message) { status.textContent = message; }

function renderLoop() {
  if (!finished && trackReady) {
    renderer.update(audio.currentTime * 1000, phrases, settings);
  }
  frameId = requestAnimationFrame(renderLoop);
}

async function tryFullscreen() {
  if (!document.fullscreenElement) {
    try { await document.documentElement.requestFullscreen(); }
    catch { /* ブラウザによって自動全画面化は拒否されます */ }
  }
}

function promptForPlayback(message) {
  playMessage.textContent = message;
  overlay.hidden = false;
  decideButton.disabled = true;
}

async function playCurrentSong() {
  if (!trackReady) return;
  try {
    await audio.play();
    overlay.hidden = true;
    decideButton.disabled = false;
    setStatus("");
  } catch {
    promptForPlayback("ブラウザの再生制限により、ボタンを押して再生してください。");
  }
}

async function loadSection(index) {
  const epoch = ++renderEpoch;
  changing = true;
  decideButton.disabled = true;
  audio.pause();
  renderer.clear();
  trackReady = false;
  phrases = [];

  const song = SONGS[index];
  songNumber.textContent = `${index + 1} 曲目`;
  initialSettings = createInitialSettings();
  settings = { ...initialSettings };
  createSettingsPanel(settingsContainer, settings, next => {
    settings = next;
  });
  setStatus("楽曲と歌詞を読み込んでいます…");

  try {
    // 両方の準備が整った時点で楽曲再生を試みる。
    const lyricsPromise = loadLyrics(song.lyrics, assetPrefix);
    audio.src = `${assetPrefix}/audio/${encodeURIComponent(song.wav)}`;
    audio.load();
    const audioPromise = new Promise((resolve, reject) => {
      const onReady = () => { clean(); resolve(); };
      const onError = () => { clean(); reject(new Error(`WAVを読み込めません: ${song.wav}`)); };
      const clean = () => {
        audio.removeEventListener("canplay", onReady);
        audio.removeEventListener("error", onError);
      };
      audio.addEventListener("canplay", onReady, { once: true });
      audio.addEventListener("error", onError, { once: true });
      if (audio.readyState >= 3) onReady();
    });
    const [loaded] = await Promise.all([lyricsPromise, audioPromise]);
    if (epoch !== renderEpoch) return;
    phrases = loaded;
    audio.currentTime = 0;
    trackReady = true;
    changing = false;
    setStatus(`歌詞読み込み: ${getLyricsEngine()}`);
    // 最初の曲の開始時に全画面化を試行。拒否された場合はブラウザ制限。
    if (index === 0) await tryFullscreen();
    await playCurrentSong();
  } catch (error) {
    console.error(error);
    promptForPlayback(`読み込みエラー: ${error.message}。public/audio と public/lyrics を確認してください。`);
    playButton.hidden = true;
    setStatus("ファイル読み込みに失敗しました");
  }
}

async function finish() {
  finished = true;
  audio.pause();
  cancelAnimationFrame(frameId);
  setStatus("実験が終了しました。結果を送信しています…");
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage(
      { type: "EXPERIMENT_FINISHED", sessionId, results },
      location.origin
    );
    try { window.opener.focus(); } catch {}
  }
  // window.open で開かれた場合のみ閉じられます。
  window.close();
  songNumber.textContent = "実験終了";
  overlay.hidden = false;
  playButton.hidden = true;
  playMessage.textContent = "5曲分の記録は保存されました。元の画面で結果をダウンロードしてください。このウィンドウは閉じてかまいません。";
}

async function decide() {
  if (changing || finished || !trackReady || audio.paused) return;
  changing = true;
  decideButton.disabled = true;
  const finalSettings = { ...settings };
  if (finalSettings.movement === "無") {
    finalSettings.direction = "適用なし";
    finalSettings.easing = "適用なし";
  }
  results.push({
    songNumber: songIndex + 1,
    wavFile: SONGS[songIndex].wav,
    initialSettings: { ...initialSettings },
    finalSettings,
    confirmedAt: new Date().toISOString()
  });
  storeResults(sessionId, results);
  audio.pause();
  if (results.length === SONGS.length) {
    await finish();
  } else {
    songIndex++;
    await loadSection(songIndex);
  }
}

decideButton.addEventListener("click", decide);
playButton.addEventListener("click", async () => {
  if (!trackReady) return;
  await tryFullscreen();
  await playCurrentSong();
});

window.addEventListener("beforeunload", () => audio.pause());

if (!sessionId || sessionId !== localStorage.getItem(CURRENT_SESSION_KEY)) {
  songNumber.textContent = "実験の開始画面から操作してください";
  setStatus("元のウィンドウの「開始」から開いてください。");
} else if (results.length >= SONGS.length) {
  finish();
} else {
  // 万一更新された場合は途中までの曲を保存済みデータから復元。
  songIndex = results.length;
  renderLoop();
  await loadSection(songIndex);
  // 新規ウィンドウ内の自動 requestFullscreen は大抵拒否されるため、
  // 再生が拒否された場合は play-button の明示的なクリックで全画面化します。
  if (audio.paused && trackReady && !overlay.hidden) {
    setStatus("「全画面で再生開始」を押してください");
  }
}
