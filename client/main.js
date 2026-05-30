import { DiscordSDK } from "@discord/embedded-app-sdk";
import { io } from "socket.io-client";
import "./style.css";

const socket = io();
let myUserId = null;
let myBoard  = [];
let puzzle   = [];
let myUsername = null;

function isDiscordEmbed() {
  return new URLSearchParams(window.location.search).has("frame_id");
}

async function main() {
  if (!isDiscordEmbed()) {
    setStatus(
      "This app must be opened from Discord Activity. " +
      "Do not open it directly in the browser."
    );
    return;
  }

  setStatus("Fetching config...");
  const configResp = await fetch("/api/config");
  const configData = await configResp.json().catch(() => ({}));
  if (!configResp.ok) {
    const err = configData && configData.error ? configData.error : `Status ${configResp.status}`;
    throw new Error("Server configuration error: " + err);
  }
  const { clientId } = configData;
  // Debug: log the clientId fetched from the server so we can see it in Discord DevTools
  console.log("[sudoku] fetched clientId:", clientId, "location.search:", location.search);
  // Coerce clientId to string to avoid type issues (numbers/objects)
  const clientIdStr = clientId == null ? null : String((clientId && clientId.clientId) || clientId);
  console.log("[sudoku] clientId (raw):", clientId, "clientIdStr:", clientIdStr, "(type:", typeof clientIdStr + ")");
  if (!clientIdStr) throw new Error("No client id provided by server");
  let sdk;
  try {
    console.log("[sudoku] About to call new DiscordSDK(", JSON.stringify(clientIdStr), ")");
    sdk = new DiscordSDK(clientIdStr);
    console.log("[sudoku] DiscordSDK initialized successfully");
  } catch (e) {
    console.error("[sudoku] DiscordSDK constructor error:", e.message, "full error:", e, "clientIdRaw:", clientId, "clientIdStr:", clientIdStr);
    throw e;
  }

  setStatus("Waiting for SDK...");
  console.log("[sudoku] Calling sdk.ready()");
  await sdk.ready();
  console.log("[sudoku] sdk.ready() completed");

  setStatus("Authorizing...");
  console.log("[sudoku] Calling sdk.commands.authorize()");
  const { code } = await sdk.commands.authorize({ scope: ["identify"] });
  console.log("[sudoku] sdk.commands.authorize() completed, code:", code);

  setStatus("Fetching token...");
  console.log("[sudoku] Fetching token from /api/token");
  const { access_token } = await fetch("/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  }).then(r => r.json());
  console.log("[sudoku] Token fetched, access_token:", access_token ? "present" : "missing");

  setStatus("Authenticating...");
  console.log("[sudoku] Calling sdk.commands.authenticate()");
  const auth = await sdk.commands.authenticate({ access_token });
  console.log("[sudoku] sdk.commands.authenticate() completed");
  const user = auth.user;
  console.log("[sudoku] User:", user.username, "ID:", user.id);

  myUserId   = user.id;
  myUsername = user.username;
  document.getElementById("my-name").textContent = user.username;

  setStatus("Joining room...");
  socket.emit("join_room", {
    roomId:   sdk.instanceId,
    userId:   user.id,
    username: user.username,
  });
}

main().catch(err => {
  console.error(err);
  setStatus("Error: " + (err.message || err));
});

// ── Socket events ─────────────────────────────────────────────
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
  showBanner(username === myUsername ? "🏆 You win!" : `🏆 ${username} wins!`);
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
function showBanner(msg) {
  const b = document.getElementById("winner-banner");
  b.textContent = msg;
  b.classList.remove("hidden");
}