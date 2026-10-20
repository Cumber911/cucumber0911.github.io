import { CURRENT_SESSION_KEY, downloadResults, readResults, storageKey } from "./results.js";

const homeTitle = document.querySelector("#home-title");
const homeMessage = document.querySelector("#home-message");
const startButton = document.querySelector("#start-button");
const downloadButton = document.querySelector("#download-button");
const restartButton = document.querySelector("#restart-button");
const error = document.querySelector("#home-error");

let popup = null;
let sessionId = localStorage.getItem(CURRENT_SESSION_KEY);

function showFinished(id) {
  const results = readResults(id);
  if (results.length !== 5) return;
  homeTitle.textContent = "以上で終了となります。";
  homeMessage.textContent = "以下のボタンから結果をダウンロードし、送信してください。ダウンロード後はウィンドウを閉じてかまいません。";
  homeMessage.hidden = false;
  startButton.hidden = true;
  downloadButton.hidden = false;
  error.textContent = "";
}

if (sessionId) showFinished(sessionId);

startButton.addEventListener("click", () => {
  error.textContent = "";
  const id = crypto.randomUUID();
  // 開始時に古い実験結果とは切り離します。
  sessionId = id;
  localStorage.setItem(CURRENT_SESSION_KEY, id);
  localStorage.removeItem(storageKey(id));

  const screenWidth = Math.max(screen.availWidth || 1200, 960);
  const screenHeight = Math.max(screen.availHeight || 800, 680);
  const url = new URL("./experiment.html", window.location.href);
  url.searchParams.set("session", id);
  popup = window.open(url.href, "_blank", `popup=yes,width=${screenWidth},height=${screenHeight}`);

  if (!popup) {
    error.textContent = "新しいウィンドウがブロックされました。ポップアップを許可して、もう一度「開始」を押してください。";
    return;
  }
  popup.focus();
  homeTitle.textContent = "実験画面を開きました";
  homeMessage.textContent = "新しいウィンドウで5曲の操作を進めてください。完了すると、この画面に結果ダウンロードが表示されます。";
  homeMessage.hidden = false;
  startButton.hidden = true;
});

downloadButton.addEventListener("click", () => {
  const results = readResults(sessionId);
  if (results.length !== 5) {
    error.textContent = "5曲分の実験結果がそろっていません。";
    return;
  }
  downloadResults(sessionId, results);
});

window.addEventListener("message", event => {
  if (event.origin !== window.location.origin) return;
  if (!popup || event.source !== popup) return;
  if (event.data?.type !== "EXPERIMENT_FINISHED") return;
  if (event.data.sessionId !== sessionId) return;
  if (!Array.isArray(event.data.results) || event.data.results.length !== 5) return;
  // localStorage へも保存し、ページ更新後もダウンロード可能に。
  localStorage.setItem(storageKey(sessionId), JSON.stringify(event.data.results));
  showFinished(sessionId);
});

// 子ウィンドウが postMessage する直前に閉じても、保存済みの結果から復旧。
window.addEventListener("storage", event => {
  if (sessionId && event.key === storageKey(sessionId)) showFinished(sessionId);
});
