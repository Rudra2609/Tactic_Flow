# ♟️ Tactic Flow

**A real-time multiplayer chess platform powered by a custom C++ engine compiled to WebAssembly.**

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite)](https://vitejs.dev)
[![Firebase](https://img.shields.io/badge/Firebase-Realtime_DB-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com)
[![WebAssembly](https://img.shields.io/badge/WebAssembly-C%2B%2B_Engine-654FF0?style=flat-square&logo=webassembly)](https://webassembly.org)
[![Live Demo](https://img.shields.io/badge/Live_Demo-Play_Now!-success?style=flat-square&logo=vercel)](https://tactic-flow-nine.vercel.app/)

[▶ **Play Live**](https://tactic-flow-nine.vercel.app/) · [🐛 Report Bug](https://github.com/Rudra2609/Tactic_Flow/issues) · [✨ Request Feature](https://github.com/Rudra2609/Tactic_Flow/issues)

---

## 📖 Table of Contents

- [About the Project](#-about-the-project)
- [Features](#-features)
- [Tech Stack](#️-tech-stack)
- [Architecture](#️-architecture)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Engine Compilation (Advanced)](#-engine-compilation-advanced)
- [Game Modes](#-game-modes)
- [AI Engine Deep Dive](#-ai-engine-deep-dive)
- [Firebase Setup](#-firebase-setup)
- [Deployment](#-deployment)
- [License](#-license)

---

## 🎯 About the Project

**Tactic Flow** is a browser-based chess platform combining a self-written AI opponent with real-time online multiplayer. Instead of calling an external chess engine API, the AI is a **custom chess engine written in C++**, compiled to **WebAssembly** via Emscripten and run entirely client-side — no backend compute cost for move calculation.

The multiplayer layer runs on **Firebase Realtime Database**, handling board sync, room codes, in-game chat, draw offers, and disconnect cleanup.

> Built as a portfolio project to demonstrate systems programming (C++), WASM interop, and full-stack web development in one app.

---

## ✨ Features

### 🤖 AI & Gameplay
- **Custom C++ chess engine** compiled to WebAssembly, running client-side at native speed
- **Adjustable ELO slider (250–3200)** controlling both search depth and move quality (see [AI Deep Dive](#-ai-engine-deep-dive) for how)
- **Minimax with alpha-beta pruning**, depth scaling from 1 to 5 ply by ELO band
- **Web Worker isolation** — the engine runs on a separate thread so AI search never blocks the UI
- Full rules support: castling, en passant, promotion, check/checkmate/stalemate detection

### 🌐 Multiplayer
- **Real-time online play** over Firebase Realtime Database — create a room, share a 6-character code, play instantly
- **Disconnect handling** via Firebase `onDisconnect` — abandoned rooms clean themselves up
- **Draw offers** with a full offer / accept / decline flow, synced live between both players
- **Resign**, propagated immediately to the opponent
- **In-game chat**, synced per room

### 🏆 Tournaments
- **Create or join via a shareable code**, with optional max player cap and scheduled start time
- **Single elimination** — auto-seeds a bye-padded bracket (rounds padded to the next power of 2) and advances winners round by round until a champion remains
- **Round robin** — generates every pairwise matchup and ranks players by win count once all matches finish
- Each bracket match spins up its own live game room (reusing the same online-play, draw-offer, and resign logic as regular multiplayer) and reports results back into the bracket automatically
- Live bracket view for all participants, with a host-only "start match" control once both players are ready

### ⏱️ Time Controls
- Configurable chess clocks with custom time + increment
- Independent dual timers for local PvP
- Timeout is a proper game-over condition (including timeout-vs-insufficient-material draws)

### 🗂️ Board Editor
- Drag-and-drop position editor — place/remove any piece, set side to move, copy out the resulting FEN
- Launch any custom position straight into a game against the AI

### 🔐 Authentication
- Firebase email/password auth, with **email verification** and **password reset** flows
- Display name carries into multiplayer rooms

### 🎨 UI / UX
- Dark glassmorphism theme — frosted panels, subtle glow, dark background
- Built on `react-chessboard` for drag-and-drop piece movement
- Responsive across desktop, tablet, and mobile
- Move history, legal-move highlighting, promotion dialog

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend Framework** | React 19 + Vite 8 | Component UI, fast HMR dev server |
| **Chess UI** | `react-chessboard` v5 | Drag-and-drop board rendering |
| **Chess Logic (client)** | `chess.js` v1.4 | FEN parsing, client-side move bookkeeping |
| **Core AI Engine** | C++ (custom) | Minimax + alpha-beta search, board representation |
| **WASM Compilation** | Emscripten (Embind) | Compiles the C++ engine to `.wasm` + JS glue |
| **AI Threading** | Web Workers API | Runs the WASM engine off the main thread |
| **Realtime Multiplayer** | Firebase Realtime Database | Room state, board sync, chat, draw offers, presence |
| **Authentication** | Firebase Auth | Email/password sign-in, verification, password reset |
| **Hosting** | Vercel | Static hosting + analytics/speed insights |
| **Styling** | Custom CSS | Glassmorphism dark theme |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (Client)                     │
│                                                               │
│  ┌───────────────────┐        ┌──────────────────────────┐  │
│  │     React App     │        │       Web Worker         │  │
│  │   (Main Thread)   │        │      (AI Thread)         │  │
│  │                   │  msg   │                          │  │
│  │  ┌─────────────┐  │◄──────►│  ┌────────────────────┐  │  │
│  │  │  chess.js   │  │        │  │  chess_module.wasm │  │  │
│  │  │ (FEN/state) │  │        │  │  (C++ AI Engine)   │  │  │
│  │  └─────────────┘  │        │  └────────────────────┘  │  │
│  │                   │        └──────────────────────────┘  │
│  │  ┌─────────────┐  │                                       │
│  │  │ react-chess-│  │        ┌──────────────────────────┐  │
│  │  │    board    │  │◄──────►│   Firebase Realtime DB   │  │
│  │  └─────────────┘  │        │   (multiplayer sync)     │  │
│  │                   │        └──────────────────────────┘  │
│  │  ┌─────────────┐  │        ┌──────────────────────────┐  │
│  │  │   Firebase  │  │◄──────►│  Firebase Auth Service   │  │
│  │  │    Auth     │  │        └──────────────────────────┘  │
│  │  └─────────────┘  │                                       │
│  └───────────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- The C++ engine is compiled once to WASM and served as a static asset — no server needed for AI moves
- The Web Worker keeps `getBestMove()` off the render thread, so the board never freezes mid-search
- Firebase gives a serverless multiplayer backend — no Node/Express server to run or maintain
- `vite.config.js` switches `base` between `/` (Vercel) and `/Tactic_Flow/` (GitHub Pages) via the `VERCEL` env var, so the same build works on either host

---

## 📁 Project Structure

```
Tactic_Flow/
│
├── Board.cpp / Board.h         # Board representation, move generation, FEN
├── AI.cpp / AI.h                # Minimax + alpha-beta search, ELO-based depth/blunder logic
├── BoardAI.cpp                  # Legal move generation, makeMoveAI, evaluate()
├── Square.cpp / Square.h        # Square/piece representation
├── WasmBindings.cpp              # Emscripten Embind bindings (C++ <-> JS)
│
└── frontend/                    # React + Vite app
    ├── public/
    │   ├── chess_module.js       # Emscripten-generated JS glue
    │   ├── chess_module.wasm     # Compiled engine binary
    │   └── ai_worker.js          # Web Worker: loads WASM, handles AI requests
    │
    ├── src/
    │   ├── App.jsx                # Game modes, board state, multiplayer wiring
    │   ├── App.css                # Glassmorphism theme
    │   ├── Auth.jsx                # Login / sign-up
    │   ├── Auth.css
    │   ├── firebase.js             # Firebase init
    │   └── main.jsx                # React entry point
    │
    ├── package.json
    └── vite.config.js              # base path switches on VERCEL env var
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** >= 18.x
- **npm** >= 9.x
- A modern browser

> You don't need C++ or Emscripten to run the frontend — the pre-built `chess_module.wasm` already ships in `frontend/public/`.

### Installation

```bash
git clone https://github.com/Rudra2609/Tactic_Flow.git
cd Tactic_Flow/frontend
npm install
```

### Running Locally

```bash
npm run dev
```

Open `http://localhost:5173` (or whatever port Vite prints).

```bash
npm run build     # production build → dist/
npm run preview   # preview the production build
npm run lint      # ESLint
```

---

## 🔧 Engine Compilation (Advanced)

Only needed if you touch the C++ source (`Board.cpp`, `AI.cpp`, `BoardAI.cpp`, `Square.cpp`, `WasmBindings.cpp`).

Install [Emscripten](https://emscripten.org/docs/getting_started/downloads.html):

```bash
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh   # emsdk_env.bat on Windows
```

From the project root:

```bash
emcc Board.cpp BoardAI.cpp AI.cpp Square.cpp WasmBindings.cpp \
  -o frontend/public/chess_module.js \
  -s EXPORT_ES6=1 \
  -s MODULARIZE=1 \
  -s ENVIRONMENT=web \
  -O3 \
  --bind
```

| Flag | Purpose |
|---|---|
| `-s EXPORT_ES6=1` | Output as an ES module (Vite-compatible) |
| `-s MODULARIZE=1` | Wrap output in a factory function |
| `-s ENVIRONMENT=web` | Target browser only |
| `-O3` | Max optimization |
| `--bind` | Enable Embind for C++ ↔ JS bindings |

---

## 🎮 Game Modes

| Mode | Description |
|---|---|
| **Player vs AI** | Adjustable ELO (250–3200) via slider. Runs in a Web Worker. |
| **Local PvP** | Two players, one device, independent clocks. |
| **Online Multiplayer** | Create a room, share the 6-character code. Supports draw offers, resign, chat. |
| **Board Editor** | Place any position, set side to move, copy FEN, or launch it against the AI. |
| **Tournaments** | Create or join a bracket by code. Single-elimination or round-robin, auto-advancing, run on the same online-match infrastructure. |

---

## 🧠 AI Engine Deep Dive

The engine is minimax with alpha-beta pruning, written in C++ and compiled to WASM.

### How ELO actually maps to behavior

ELO controls **two independent things**, not just search depth:

**1. Search depth:**

| ELO Range | Search Depth |
|---|---|
| ≤ 600 | 1 ply |
| 601–1000 | 2 ply |
| 1001–1500 | 3 ply |
| 1501–2200 | 4 ply |
| > 2200 | 5 ply |

**2. Blunder probability** (the bigger lever at low ELO): below ELO 1500, the engine has a chance to ignore its own search result and play a random legal move instead — scaling linearly from **70% at ELO 250 down to 0% at ELO 1500**. Depth-1 search alone doesn't make a weak-feeling opponent; the random-move injection does most of that work at the low end, while depth scaling matters more once blunders phase out above 1500.

### Static evaluation

`Board::evaluate()` is straightforward material counting plus two small positional terms:
- Standard material values (P=100, N=300, B=300, R=500, Q=900)
- A small pawn-advancement bonus that grows as a pawn nears promotion
- A small knight-centralization bonus (knights are worth more near the center)

There are currently no piece-square tables and no king-safety term — the evaluation is intentionally simple, and most of the engine's "personality" at different ELOs comes from the blunder mechanism above, not from positional nuance.

### Web Worker integration

```
React UI ──── postMessage({type:'calculate', fen, elo}) ────► ai_worker.js
         ◄─── postMessage({type:'result', move}) ──────────  (WASM lives here)
```

The worker loads the WASM module once on startup. On the AI's turn, `App.jsx` posts the FEN and ELO; the worker calls `getBestMove(elo)` and posts back a move string.

### WASM bindings (Emscripten Embind)

| JS Function | C++ Implementation | Description |
|---|---|---|
| `initBoard()` | `Board::setBoard()` | Reset to starting position |
| `setBoardFromFEN(fen)` | `Board::setBoardFromFEN()` | Load an arbitrary position |
| `getBestMove(elo)` | `AI::getBestMove()` | Run search (with blunder logic), return a move string |
| `makeMove(fx,fy,tx,ty,promo)` | `Board::makeMoveAI()` | Apply a move |
| `getBoardState()` | `Board::generatePositionString()` | Export current FEN |
| `getGameState()` | `Board::getGameState()` | Checkmate/stalemate/draw status |

---

## 🔥 Firebase Setup

To run multiplayer in your own fork:

1. Create a project in the [Firebase Console](https://console.firebase.google.com/)
2. Enable **Authentication** → Email/Password
3. Enable **Realtime Database**, with dev rules like:

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

4. Drop your config into `frontend/src/firebase.js`:

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.REGION.firebasedatabase.app",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

---

## 🌍 Deployment

The live build runs on **Vercel** at **[tactic-flow-nine.vercel.app](https://tactic-flow-nine.vercel.app/)**.

`vite.config.js` sets the asset base path conditionally:

```js
base: process.env.VERCEL ? '/' : '/Tactic_Flow/'
```

This means the same codebase can also be deployed to GitHub Pages (with `base: '/Tactic_Flow/'`) if you fork it — Vercel sets the `VERCEL` env var automatically, GitHub Pages doesn't, so the right base path gets picked with no manual config needed.

To deploy your own fork on Vercel: import the repo, set the **root directory to `frontend`**, and deploy.

---

## 📄 License

No license file is currently published in this repository, so default copyright applies — all rights reserved by the author. If you want this open-source, add a `LICENSE` file (MIT is a common choice for portfolio projects) and update this section to match.

---

## 👤 Author

**Rudra** — [@Rudra2609](https://github.com/Rudra2609)

---

Made with ♟️ and ❤️ — [Play Tactic Flow](https://tactic-flow-nine.vercel.app/)
