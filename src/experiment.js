import { SONGS } from "./config.js";
import { createInitialSettings } from "./experiment-settings.js";
import { createSettingsPanel } from "./settings.js";
import { loadLyrics } from "./lyrics.js";
import { createRenderer } from "./renderer.js";
import { CURRENT_SESSION_KEY, isSessionFinished, readSession, storeSession } from "./results.js";

const sessionId = new URLSearchParams(location.search).get("session");
const screen = document.querySelector("#experiment");
const workArea = document.querySelector("#work-area");
const preview = document.querySelector("#preview");
const settingsContainer = document.querySelector("#settings");
const title = document.querySelector("#song-number");
const decideButton = document.querySelector("#decide");
const status = document.querySelector("#status");
const overlay = document.querySelector("#play-overlay");
const playButton = document.querySelector("#play-button");
const playMessage = document.querySelector("#play-message");
const procedure = document.querySelector("#experiment-procedure");
const intro = document.querySelector("#review-intro");
const impressionField = document.querySelector("#impression-field");
const impression = document.querySelector("#impression");
const survey = document.querySelector("#survey");

const assetPrefix = "./public";
const audio = new Audio();
audio.loop = true;
audio.preload = "auto";
const renderer = createRenderer(preview, document.querySelector("#lyric-stage"));
const session = readSession(sessionId);
const loadedLyrics = new Map();

let view = "loading";
let settings;
let initialSettings;
let phrases = [];
let trackReady = false;
let loadingFailed = false;
let practiceStart = 0;
let frameId;

function shuffleSongs() {
  const songs = [...SONGS];
  for (let index = songs.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [songs[index], songs[other]] = [songs[other], songs[index]];
  }
  return songs;
}

function practicePhrase(index, startTime, words) {
  const id = `test${index}`;
  let cursor = startTime;
  return {
    id,
    startTime,
    endTime: startTime + 3500,
    words: words.map((text, wordIndex) => {
      const wordId = `${id}w${wordIndex}`;
      const wordStart = cursor;
      const characters = Array.from(text, (char, charIndex) => {
        const character = { id: `${wordId}c${charIndex}`, text: char, startTime: cursor };
        cursor += 130;
        return character;
      });
      return { id: wordId, startTime: wordStart, characters };
    })
  };
}

function renderLoop(now) {
  if (view === "practice") {
    renderer.update((now - practiceStart) % 8000, phrases, settings);
  } else if (trackReady) {
    renderer.update(audio.currentTime * 1000, phrases, settings);
  }
  frameId = requestAnimationFrame(renderLoop);
}

function showView(next, heading, buttonLabel = "") {
  view = next;
  trackReady = false;
  loadingFailed = false;
  audio.pause();
  renderer.clear();
  screen.dataset.view = next;
  screen.hidden = false;
  title.textContent = heading;
  title.hidden = !heading;
  workArea.hidden = !["practice", "edit", "review"].includes(next);
  settingsContainer.hidden = !["practice", "edit"].includes(next);
  procedure.hidden = next !== "procedure";
  intro.hidden = next !== "intro";
  impressionField.hidden = next !== "review";
  survey.hidden = next !== "survey";
  decideButton.hidden = !buttonLabel;
  decideButton.textContent = buttonLabel;
  decideButton.disabled = false;
  overlay.hidden = true;
  status.textContent = "";
  window.scrollTo(0, 0);
}

function editSettings(start) {
  initialSettings = start;
  settings = { ...start };
  createSettingsPanel(settingsContainer, settings, next => { settings = next; });
}

function showPractice() {
  showView("practice", "テスト画面", "本番へ");
  editSettings({
    ...createInitialSettings(),
    textColor: "黒", background: "白", split: "文節", jitter: 0,
    movement: "あり", direction: "左から", easing: "あり", opacity: 100, scale: 100,
    rotation: "なし", rotationEasing: "なし"
  });
  phrases = [
    practicePhrase(0, 300, ["文字の", "動きや", "色を", "変えてみよう"]),
    practicePhrase(1, 4200, ["設定を", "選ぶと", "映像に", "反映されます"])
  ];
  practiceStart = performance.now();
  renderer.prepare(phrases, settings);
}

async function tryFullscreen() {
  if (!document.fullscreenElement) {
    try { await document.documentElement.requestFullscreen(); }
    catch { /* 全画面化できない環境でも操作を続けられる。 */ }
  }
}

function promptForPlayback(message, label) {
  playMessage.textContent = message;
  playButton.textContent = label;
  playButton.disabled = false;
  overlay.hidden = false;
  decideButton.disabled = true;
}

async function playCurrentSong() {
  if (!trackReady) return;
  playButton.disabled = true;
  try {
    await audio.play();
    overlay.hidden = true;
    decideButton.disabled = false;
    status.textContent = "";
  } catch (error) {
    if (error.name === "NotAllowedError") {
      promptForPlayback("ボタンを押して再生してください。", "再生開始");
      return;
    }
    showLoadError(error);
  }
}

function showLoadError(error) {
  console.error(error);
  loadingFailed = true;
  trackReady = false;
  audio.pause();
  promptForPlayback("楽曲または歌詞を読み込めませんでした。", "再読み込み");
  status.textContent = error.message;
}

async function loadTrack(index) {
  decideButton.disabled = true;
  overlay.hidden = true;
  loadingFailed = false;
  status.textContent = "楽曲と歌詞を読み込んでいます…";
  const song = session.songOrder[index];
  try {
    if (!loadedLyrics.has(index)) {
      loadedLyrics.set(index, await loadLyrics(song.lyrics, assetPrefix));
    }
    phrases = loadedLyrics.get(index);
    try { await renderer.ensureFont(settings); }
    catch (error) { console.warn("フォントの先読みができなかったため、代替書体で続行します", error); }
    renderer.prepare(phrases, settings);
    renderer.update(0, phrases, settings);
    audio.src = `${assetPrefix}/audio/${encodeURIComponent(song.wav)}`;
    trackReady = true;
    await playCurrentSong();
  } catch (error) {
    showLoadError(error);
  }
}

function showCreation() {
  const index = session.results.length;
  showView("edit", `${index + 1} 曲目`, "決定");
  editSettings(createInitialSettings());
  return loadTrack(index);
}

function showReview() {
  const index = session.impressions.length;
  showView("review", `${index + 1} 曲目`, "次へ");
  settings = session.results[index].finalSettings;
  impression.value = "";
  return loadTrack(index);
}

function finish() {
  trackReady = false;
  audio.pause();
  cancelAnimationFrame(frameId);
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({ type: "EXPERIMENT_FINISHED", sessionId }, location.origin);
    try { window.opener.focus(); } catch {}
    window.close();
  }
  // 同じタブで進めた場合や子ウィンドウを閉じられない場合も結果画面に戻る。
  location.replace("./index.html");
}

decideButton.addEventListener("click", async () => {
  if (decideButton.disabled) return;
  decideButton.disabled = true;
  if (view === "procedure") {
    showPractice();
    title.focus({ preventScroll: true });
  } else if (view === "practice") {
    session.practiceDone = true;
    storeSession(sessionId, session);
    void tryFullscreen();
    await showCreation();
  } else if (view === "edit") {
    const index = session.results.length;
    const finalSettings = { ...settings };
    if (finalSettings.movement === "なし") {
      finalSettings.direction = "適用なし";
      finalSettings.easing = "適用なし";
    }
    if (finalSettings.rotation === "なし") finalSettings.rotationEasing = "適用なし";
    session.results.push({
      songNumber: index + 1,
      wavFile: session.songOrder[index].wav,
      initialSettings: { ...initialSettings },
      finalSettings,
      confirmedAt: new Date().toISOString()
    });
    storeSession(sessionId, session);
    if (session.results.length === session.songOrder.length) {
      showView("intro", "", "次へ");
    } else {
      await showCreation();
    }
  } else if (view === "intro") {
    session.reviewStarted = true;
    storeSession(sessionId, session);
    await showReview();
  } else if (view === "review") {
    session.impressions.push(impression.value);
    storeSession(sessionId, session);
    if (session.impressions.length === session.songOrder.length) {
      showView("survey", "実験全体を通しての質問");
    } else {
      await showReview();
    }
  }
});

survey.addEventListener("submit", event => {
  event.preventDefault();
  if (view !== "survey" || isSessionFinished(session)) return;
  session.survey = Object.fromEntries(new FormData(survey));
  storeSession(sessionId, session);
  finish();
});

playButton.addEventListener("click", () => {
  if (loadingFailed) {
    const index = view === "review" ? session.impressions.length : session.results.length;
    return loadTrack(index);
  }
  return playCurrentSong();
});

window.addEventListener("beforeunload", () => audio.pause());

if (!sessionId || sessionId !== localStorage.getItem(CURRENT_SESSION_KEY)) {
  showView("invalid", "実験の開始画面から操作してください");
  status.textContent = "元のウィンドウの「開始」から開いてください。";
} else if (isSessionFinished(session)) {
  finish();
} else {
  if (!session.songOrder) {
    // 保存済みの制作結果は旧版の提示順と対応している。
    session.songOrder = session.results.length > 0 ? [...SONGS] : shuffleSongs();
    storeSession(sessionId, session);
  }
  frameId = requestAnimationFrame(renderLoop);
  if (!session.practiceDone) {
    showView("procedure", "実験の手順について", "テスト画面へ");
  } else if (session.results.length < session.songOrder.length) {
    await showCreation();
  } else if (session.impressions.length === session.songOrder.length) {
    showView("survey", "実験全体を通しての質問");
  } else if (session.reviewStarted || session.impressions.length > 0) {
    await showReview();
  } else {
    showView("intro", "", "次へ");
  }
}
