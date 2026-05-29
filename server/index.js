require("dotenv").config({ path: __dirname + "/../.env" });

const express = require("express");
const http    = require("http");
const path    = require("path");
const { Server } = require("socket.io");
const cors    = require("cors");

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "dist")));

// ── Discord OAuth token exchange ──────────────────────────────
app.post("/api/token", async (req, res) => {
  const { code } = req.body;
  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type:    "authorization_code",
      code,
    }),
  });
  const data = await response.json();
  res.json({ access_token: data.access_token });
});

// ── Serve client env vars ─────────────────────────────────────
app.get("/api/config", (req, res) => {
  res.json({ clientId: process.env.DISCORD_CLIENT_ID });
});

// ── Game state ────────────────────────────────────────────────
const rooms = {};

function generatePuzzle() {
  return [
    [5,3,0,0,7,0,0,0,0],
    [6,0,0,1,9,5,0,0,0],
    [0,9,8,0,0,0,0,6,0],
    [8,0,0,0,6,0,0,0,3],
    [4,0,0,8,0,3,0,0,1],
    [7,0,0,0,2,0,0,0,6],
    [0,6,0,0,0,0,2,8,0],
    [0,0,0,4,1,9,0,0,5],
    [0,0,0,0,8,0,0,7,9],
  ];
}

function isSolved(board) {
  const solution = [
    [5,3,4,6,7,8,9,1,2],
    [6,7,2,1,9,5,3,4,8],
    [1,9,8,3,4,2,5,6,7],
    [8,5,9,7,6,1,4,2,3],
    [4,2,6,8,5,3,7,9,1],
    [7,1,3,9,2,4,8,5,6],
    [9,6,1,5,3,7,2,8,4],
    [2,8,7,4,1,9,6,3,5],
    [3,4,5,2,8,6,1,7,9],
  ];
  return board.every((row, r) => row.every((val, c) => val === solution[r][c]));
}

function sanitizePlayers(players) {
  return Object.fromEntries(
    Object.entries(players).map(([id, p]) => [
      id, { userId: p.userId, username: p.username, board: p.board, finished: p.finished }
    ])
  );
}

// ── Socket.io ─────────────────────────────────────────────────
io.on("connection", (socket) => {
  socket.on("join_room", ({ roomId, userId, username }) => {
    socket.join(roomId);
    if (!rooms[roomId]) rooms[roomId] = { players: {}, puzzle: generatePuzzle() };

    const room = rooms[roomId];
    room.players[socket.id] = {
      userId, username,
      board: room.puzzle.map(row => [...row]),
      finished: false,
    };

    socket.emit("game_state", { puzzle: room.puzzle, players: sanitizePlayers(room.players) });
    socket.to(roomId).emit("player_joined", { players: sanitizePlayers(room.players) });
    socket.data.roomId = roomId;
  });

  socket.on("cell_update", ({ row, col, value }) => {
    if (value !== 0 && (value < 1 || value > 9)) return;
    const room = rooms[socket.data.roomId];
    if (!room) return;
    const player = room.players[socket.id];
    player.board[row][col] = value;
    socket.to(socket.data.roomId).emit("opponent_update", { userId: player.userId, row, col, value });
    if (isSolved(player.board)) {
      player.finished = true;
      io.to(socket.data.roomId).emit("player_won", { username: player.username });
    }
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;
    delete rooms[roomId].players[socket.id];
    io.to(roomId).emit("player_left", { players: sanitizePlayers(rooms[roomId].players) });
  });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
