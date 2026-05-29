# Sudoku Battle — Discord Activity

## Structure
```
sudoku-activity/
├── client/         # Vite frontend (bundled by Vite)
│   ├── index.html
│   ├── main.js
│   └── style.css
├── server/
│   └── index.js    # Express + Socket.io
├── .env            # Never commit this
├── .env.example
├── vite.config.js
├── railway.json
└── package.json
```

## Local Setup
```bash
npm install
cp .env.example .env
# Fill in .env with your Discord credentials
npm run start
```

## Deploy to Railway
1. Push to GitHub
2. New project on railway.app → Deploy from GitHub
3. Add environment variables in Railway dashboard:
   - DISCORD_CLIENT_ID
   - DISCORD_CLIENT_SECRET
4. Railway runs `npm run start` which builds client then starts server

## Discord Portal Setup
Set your Railway URL in 3 places:
- General Information → Embedded Application URL
- OAuth2 → Redirects
- Activities → URL Mappings → `/` (make sure the app mapping passes `frame_id` to your app)

> Note: Opening the Railway app URL directly in a browser will fail with `frame_id query param is not defined`.
  The app must be launched from Discord Activity/embedded app context.
