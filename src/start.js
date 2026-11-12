import { CURRENT_SESSION_KEY, downloadResults, isSessionFinished, readSession, storageKey } from "./results.js";

const homeTitle = document.querySelector("#home-title");
const homeMessage = document.querySelector("#home-message");
const startButton = document.querySelector("#start-button");
const downloadButton = document.querySelector("#download-button");
const restartButton = document.querySelector("#restart-button");
const error = document.querySelector("#home-error");

let popup = null;
let sessionId = localStorage.getItem(CURRENT_SESSION_KEY);

function showFinished(id, revisited = false) {
  if (!isSessionFinished(readSession(id))) return;

  homeTitle.textContent = revisited
    ? "すでに回答完了しています。再度回答しますか？"
    : "以上で終了となります。";

  homeMessage.textContent =
    "以下のボタンから結果をダウンロードし、送信してください。" +
    "再度回答する場合は、先に今回の結果をダウンロードしてください。";

  homeMessage.hidden = false;
  startButton.hidden = true;
  downloadButton.hidden = false;
  restartButton.hidden = false;
  error.textContent = "";
}

// URLを開いた時点で回答済みなら、再回答の案内を表示
if (sessionId) showFinished(sessionId, true);

startButton.addEventListener("click", () => {
  error.textContent = "";
  const id = sessionId ?? crypto.randomUUID();
  sessionId = id;
  localStorage.setItem(CURRENT_SESSION_KEY, id);

  const screenWidth = Math.max(screen.availWidth || 1200, 960);
  const screenHeight = Math.max(screen.availHeight || 800, 680);
  const url = new URL("./experiment.html", window.location.href);
  url.searchParams.set("session", id);
  popup = window.open(url.href, "_blank", `popup=yes,width=${screenWidth},height=${screenHeight}`);

  if (!popup) {
    window.location.assign(url.href);
    return;
  }
  popup.focus();
  homeTitle.textContent = "実験画面を開きました";
  homeMessage.textContent = "新しいウィンドウで実験を進めてください。全体の質問まで完了すると、この画面に結果ダウンロードが表示されます。";
  homeMessage.hidden = false;
  startButton.hidden = true;
});

downloadButton.addEventListener("click", () => {
  const session = readSession(sessionId);
  if (!isSessionFinished(session)) {
    error.textContent = "実験の回答が完了していません。";
    return;
  }
  downloadResults(sessionId, session);
});

window.addEventListener("message", event => {
  if (event.origin !== window.location.origin) return;
  if (!popup || event.source !== popup) return;
  if (event.data?.type !== "EXPERIMENT_FINISHED") return;
  if (event.data.sessionId !== sessionId) return;
  showFinished(sessionId);
});

// 子ウィンドウが postMessage する直前に閉じても、保存済みの結果から復旧。
window.addEventListener("storage", event => {
  if (sessionId && event.key === storageKey(sessionId)) showFinished(sessionId);
});

restartButton.addEventListener("click", () => {
  // 現在の回答との紐づけを解除する
  localStorage.removeItem(CURRENT_SESSION_KEY);
  sessionId = null;
  popup = null;

  // 初期画面へ戻す
  homeTitle.textContent = "ボタンを押してください";
  homeMessage.textContent = "";
  homeMessage.hidden = true;

  startButton.hidden = false;
  downloadButton.hidden = true;
  restartButton.hidden = true;
  error.textContent = "";
});
