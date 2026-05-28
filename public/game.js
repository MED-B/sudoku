// ── Error display ─────────────────────────────────────────────
window.onerror = (msg, src, line, col, err) => {
  document.body.innerHTML = `<pre style="color:red;padding:20px;white-space:pre-wrap">${msg}\n${src}:${line}\n${err?.stack}</pre>`;
};
window.onunhandledrejection = (e) => {
  document.body.innerHTML = `<pre style="color:orange;padding:20px;white-space:pre-wrap">Unhandled Promise:\n${e.reason?.stack || e.reason}</pre>`;
};

// ── Discord SDK init ──────────────────────────────────────────
setStatus("Loading SDK...");

const SDK = window.DiscordSDK
  ?? window.DiscordSDKModule?.DiscordSDK
  ?? window["@discord/embedded-app-sdk"]?.DiscordSDK;

if (!SDK) {
  setStatus("ERROR: DiscordSDK not found on window. Check CDN.");
  throw new Error("DiscordSDK not found");
}

const clientId = window.__DISCORD_CLIENT_ID__;
if (!clientId || clientId === "__DISCORD_CLIENT_ID__") {
  setStatus("ERROR: CLIENT_ID not injected by server.");
  throw new Error("CLIENT_ID missing");
}

const sdk    = new SDK(clientId);
const socket = io();

let myUserId = null;
let myBoard  = [];
let puzzle   = [];

// ── Boot ──────────────────────────────────────────────────────
(async () => {
  setStatus("Waiting for SDK ready...");
  await sdk.ready();

  setStatus("Authorizing...");
  const { code } = await sdk.commands.authorize({ scope: ["identify"] });

  setStatus("Fetching token...");
  const res = await fetch("/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  const tokenData = await res.json();
  if (!tokenData.access_token) {
    setStatus("ERROR: No access_token in response: " + JSON.stringify(tokenData));
    return;
  }

  setStatus("Authenticating with Discord...");
  const auth = await sdk.commands.authenticate({ access_token: tokenData.access_token });

  const user = auth.user;
  if (!user) {
    setStatus("ERROR: No user in auth response: " + JSON.stringify(auth));
    return;
  }

  myUserId = user.id;
  document.getElementById("my-name").textContent = user.username;

  setStatus("Joining room...");
  const roomId = sdk.instanceId;
  socket.emit("join_room", { roomId, userId: user.id, username: user.username });
})();

// ── Socket events ─────────────────────────────────────────────
socket.on("connect", () => setStatus("Socket connected, waiting for game..."));
socket.on("connect_error", (err) => setStatus("Socket error: " + err.message));

socket.on("game_state", ({ puzzle: p, players }) => {
  puzzle  = p;
  myBoard = p.map(r => [...r]);
  renderMyBoard();
  updateOpponent(players);
  document.getElementById("status").classList.add("hidden");
  showGame();
});

socket.on("player_joined", ({ players }) => updateOpponent(players));
socket.on("player_left",   ({ players }) => updateOpponent(players));

socket.on("opponent_update", ({ row, col, value }) => {
  const cells = document.getElementById("opp-board").querySelectorAll(".cell");
  const cell  = cells[row * 9 + col];
  if (cell) cell.value = value || "";
});

socket.on("player_won", ({ username }) => {
  const msg = username === document.getElementById("my-name").textContent
    ? "🏆 You win!"
    : `🏆 ${username} wins!`;
  showBanner(msg);
});

// ── My board ──────────────────────────────────────────────────
function renderMyBoard() {
  const board = document.getElementById("my-board");
  board.innerHTML = "";
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const val   = puzzle[r][c];
      const input = document.createElement("input");
      input.type        = "text";
      input.maxLength   = 1;
      input.className   = "cell";
      input.dataset.row = r;
      input.dataset.col = c;
      if (val !== 0) {
        input.value         = val;
        input.dataset.given = "true";
        input.readOnly      = true;
      }
      input.addEventListener("input", onCellInput);
      board.appendChild(input);
    }
  }
}

function onCellInput(e) {
  const input = e.target;
  const r     = +input.dataset.row;
  const c     = +input.dataset.col;
  const raw   = input.value.replace(/[^1-9]/g, "");
  const val   = raw ? +raw : 0;
  input.value   = val || "";
  myBoard[r][c] = val;
  input.classList.remove("correct");
  if (val) input.classList.add("correct");
  socket.emit("cell_update", { row: r, col: c, value: val });
}

// ── Opponent board ────────────────────────────────────────────
function renderOppBoard(board) {
  const el = document.getElementById("opp-board");
  el.innerHTML = "";
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const input     = document.createElement("input");
      input.type      = "text";
      input.className = "cell";
      input.readOnly  = true;
      input.value     = board[r][c] || "";
      el.appendChild(input);
    }
  }
}

function updateOpponent(players) {
  const others = Object.values(players).filter(p => p.userId !== myUserId);
  if (!others.length) return;
  const opp = others[0];
  document.getElementById("opp-name").textContent = opp.username;
  renderOppBoard(opp.board);
}

// ── UI helpers ────────────────────────────────────────────────
function showGame()      { document.getElementById("game").classList.remove("hidden"); }
function setStatus(msg)  { const el = document.getElementById("status"); if (el) el.textContent = msg; }
function showBanner(msg) { const b = document.getElementById("winner-banner"); b.textContent = msg; b.classList.remove("hidden"); }
