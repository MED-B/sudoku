# Sudoku Battle — Discord Activity

A real-time multiplayer Sudoku game for Discord voice channels. Two players race to complete the same puzzle. Both boards are visible to each other live.

---

## Project Structure

```
sudoku-activity/
├── server/
│   └── index.js        # Express + Socket.io + OAuth
├── public/
│   ├── index.html      # Game UI
│   ├── game.js         # Discord SDK + socket client
│   └── style.css       # Styles
├── .env                # Your secrets (never commit this)
├── .env.example        # Template
├── .gitignore
├── package.json
└── README.md
```

---

## 1. Discord Developer Portal Setup

1. Go to https://discord.com/developers/applications
2. Click **New Application** → give it a name (e.g. `Sudoku Battle`)
3. Go to **OAuth2** → copy your `CLIENT_ID` and `CLIENT_SECRET`
4. Go to **Activities** (left sidebar) → enable it
5. Keep this tab open — you'll add URLs after deployment

---

## 2. Local Setup

```bash
# Clone or download the project
cd sudoku-activity

# Install dependencies
npm install

# Create your .env file
cp .env.example .env
```

Edit `.env` and fill in your values:
```
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here
PORT=3000
```

---

## 3. Local Testing (with tunnel)

Discord Activities require HTTPS. Use `cloudflared` to tunnel localhost:

```bash
# Install cloudflared (one time)
npm install -g cloudflared

# In terminal 1 — start the server
npm start

# In terminal 2 — start the tunnel
cloudflared tunnel --url http://localhost:3000
```

Copy the generated HTTPS URL (e.g. `https://abc123.trycloudflare.com`)

In the Discord Developer Portal:
- **General Information** → Embedded Application URL → paste the tunnel URL
- **OAuth2** → Redirects → add the tunnel URL
- **Activities** → URL Mappings → `/` → paste the tunnel URL

Test in Discord: join a voice channel → click the 🚀 rocket icon → launch your app.

---

## 4. Deploy to Railway

1. Push project to GitHub (`.env` is gitignored ✅)
2. Go to https://railway.app → **New Project** → **Deploy from GitHub**
3. Select your repo
4. Go to the **Variables** tab and add:
```
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here
PORT=3000
```
5. Railway auto-runs `npm start` — your app will be live at something like:
   `https://sudoku-activity.up.railway.app`

---

## 5. Final Discord Portal Config (Production)

Replace the tunnel URL with your Railway URL everywhere:

- **General Information** → Embedded Application URL
- **OAuth2** → Redirects
- **Activities** → URL Mappings → `/`

---

## How It Works

- Both players in the same voice channel share the same `instanceId` → same room
- Each player gets their own copy of the puzzle board
- Cell updates are broadcast in real-time via Socket.io
- First player to correctly complete the board wins
