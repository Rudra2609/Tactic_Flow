# ♟️ Tactic Flow

<div align="center">

![Tactic Flow Banner](https://img.shields.io/badge/Tactic_Flow-Chess_Engine-blue?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTUgMjBoMTR2Mkg1em0wLTJ2LTJIM3YtMmgyVjhoMlY2aDF2MmgxVjZoMXYyaDFWNmgxdjJIMXYtMkgxdi0yaC0ydjJIM3YtMkgxVjhoMlY2aDFWNGgxNnYyaDF2Mmgxdi0yaDFWNmgxdjJIMXYtMkgxVjhoMlY2aDFWNGgxNlY2aDF2MmgxVjhIMXYtMkgxVjZoMXYtMkg1eiIgZmlsbD0id2hpdGUiLz48L3N2Zz4=)

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite)](https://vitejs.dev)
[![Firebase](https://img.shields.io/badge/Firebase-Realtime_DB-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com)
[![WebAssembly](https://img.shields.io/badge/WebAssembly-C%2B%2B_Engine-654FF0?style=flat-square&logo=webassembly)](https://webassembly.org)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Live_Demo-Play_Now!-success?style=flat-square&logo=github)](https://rudra2609.github.io/Tactic_Flow/)

**A high-performance, real-time multiplayer chess application powered by a custom C++ engine compiled to WebAssembly.**

[▶ **Play Live**](https://rudra2609.github.io/Tactic_Flow/) · [🐛 Report Bug](https://github.com/Rudra2609/Tactic_Flow/issues) · [✨ Request Feature](https://github.com/Rudra2609/Tactic_Flow/issues)

</div>

---

## 📖 Table of Contents

- [About the Project](#-about-the-project)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running Locally](#running-locally)
- [Engine Compilation (Advanced)](#-engine-compilation-advanced)
- [Game Modes](#-game-modes)
- [AI Engine Deep Dive](#-ai-engine-deep-dive)
- [Firebase Setup](#-firebase-setup)
- [Deployment](#-deployment)
- [License](#-license)

---

## 🎯 About the Project

**Tactic Flow** is a full-featured, browser-based chess platform combining a native-speed AI opponent with real-time online multiplayer. Rather than relying on an external chess engine API, Tactic Flow ships with a **custom chess engine written in C++**, compiled to **WebAssembly (WASM)** via Emscripten. This means the AI runs entirely client-side at near-native performance, without any backend compute costs.

The multiplayer layer is powered by **Firebase Realtime Database**, enabling instant board synchronization, in-game chat, draw offers, and presence detection across players worldwide.

> Built as a portfolio project demonstrating full-stack web development, systems programming (C++), and game logic design.

---

## ✨ Features

### 🤖 AI & Gameplay
- **Custom C++ Chess Engine** compiled to WebAssembly — deep move calculation at native speed, directly in the browser
- **Adjustable ELO Difficulty** — slider from **250 to 3200** controlling AI search depth (1–5 ply) and aggression
- **Alpha-Beta Pruning** minimax algorithm for efficient move search
- **Web Worker isolation** — AI computation runs in a separate thread, keeping the UI smooth and responsive at all times
- **Full chess rule support** — castling, en passant, promotions, check/checkmate/stalemate detection

### 🌐 Multiplayer
- **Real-Time Online Play** via Firebase Realtime Database — create a room, share a code, play instantly
- **Presence Detection** — opponent disconnection is handled gracefully
- **In-game Draw Offers** — send and respond to draw proposals in real time
- **Resign** — forfeit at any time with immediate result propagation

### ⏱️ Time Controls
- Configurable **chess clocks** with custom time and increment settings
- Dual side-by-side timers for local PvP
- Time-loss handled as a game-over condition

### 🗂️ Board Editor
- **Drag-and-drop Board Editor** for setting up custom positions, puzzles, or historical games
- Play any custom position against the AI at full strength

### 🔐 Authentication
- **Firebase Email/Password Authentication** — sign up, log in, and carry your display name into multiplayer rooms

### 🎨 UI / UX
- **Dark Glassmorphism** aesthetic — modern frosted-glass panels, dark background, subtle glow effects
- Built with `react-chessboard` for smooth drag-and-drop piece movement and animations
- **Fully responsive** — works on desktop, tablet, and mobile
- Move history panel, legal move highlighting, and promotion dialog

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend Framework** | React 19 + Vite 8 | Component-based UI and fast HMR dev server |
| **Chess UI** | `react-chessboard` v5 | Interactive board rendering with drag-and-drop |
| **Chess Logic** | `chess.js` v1.4 | Move validation, FEN parsing, game state |
| **Core AI Engine** | C++ (custom) | Minimax + alpha-beta pruning move search |
| **WASM Compilation** | Emscripten | Transpiles C++ engine to `.wasm` + JS glue |
| **AI Threading** | Web Workers API | Offloads AI computation off the main thread |
| **Realtime Multiplayer** | Firebase Realtime DB | Board sync, room management, chat, presence |
| **Authentication** | Firebase Auth | Secure email/password sign-in |
| **Hosting** | GitHub Pages | Static site hosting via `gh-pages` |
| **Styling** | Custom CSS | Glassmorphism dark theme |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (Client)                     │
│                                                             │
│  ┌───────────────────┐        ┌──────────────────────────┐  │
│  │     React App     │        │       Web Worker         │  │
│  │   (Main Thread)   │        │      (AI Thread)         │  │
│  │                   │        │                          │  │
│  │  ┌─────────────┐  │  msg   │  ┌────────────────────┐  │  │
│  │  │  chess.js   │  │◄──────►│  │  chess_module.wasm │  │  │
│  │  │ (rules/FEN) │  │        │  │  (C++ AI Engine)   │  │  │
│  │  └─────────────┘  │        │  └────────────────────┘  │  │
│  │                   │        └──────────────────────────┘  │
│  │  ┌─────────────┐  │                                      │
│  │  │ react-chess-│  │        ┌──────────────────────────┐  │
│  │  │    board    │  │        │   Firebase Realtime DB   │  │
│  │  └─────────────┘  │◄──────►│   (Multiplayer sync)     │  │
│  │                   │        └──────────────────────────┘  │
│  │  ┌─────────────┐  │                                      │
│  │  │   Firebase  │  │        ┌──────────────────────────┐  │
│  │  │    Auth     │  │◄──────►│  Firebase Auth Service   │  │
│  │  └─────────────┘  │        └──────────────────────────┘  │
│  └───────────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
```

**Key Design Decisions:**
- The C++ engine is **compiled once** to WASM and served as a static file — no server needed for AI
- The Web Worker ensures AI `getBestMove()` calls never block the React render loop
- Firebase provides a **serverless** multiplayer backend — no Node/Express server to maintain
- Vite is configured with `base: '/Tactic_Flow/'` for correct GitHub Pages asset paths

---

## 📁 Project Structure

```
Tactic_Flow/
│
├── 📄 Board.cpp / Board.h         # Chess board representation, move generation
├── 📄 AI.cpp / AI.h               # Minimax + alpha-beta AI search
├── 📄 BoardAI.cpp                 # Board evaluation & AI-specific move methods
├── 📄 Square.cpp / Square.h       # Chess square and piece types
├── 📄 WasmBindings.cpp            # Emscripten JS <-> C++ interface bindings
│
└── frontend/                      # React + Vite web app
    ├── public/
    │   ├── chess_module.js        # Emscripten-generated WASM JS glue code
    │   ├── chess_module.wasm      # Compiled WebAssembly binary (C++ engine)
    │   └── ai_worker.js           # Web Worker: loads WASM, handles AI requests
    │
    ├── src/
    │   ├── App.jsx                # Root component: game modes, board, state
    │   ├── App.css                # Main styles (glassmorphism theme)
    │   ├── Auth.jsx               # Login/Sign-up form component
    │   ├── Auth.css               # Auth page styles
    │   ├── firebase.js            # Firebase app initialization & exports
    │   └── main.jsx               # React DOM entry point
    │
    ├── package.json               # Dependencies & scripts
    └── vite.config.js             # Vite config (base path for GitHub Pages)
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

- **Node.js** >= 18.x ([Download](https://nodejs.org/))
- **npm** >= 9.x (comes with Node.js)
- A modern browser (Chrome, Firefox, Edge, Safari)

> **Note:** You do **not** need C++, Emscripten, or any native toolchain to run the frontend. The pre-compiled `chess_module.wasm` binary is already included in `frontend/public/`.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Rudra2609/Tactic_Flow.git
   cd Tactic_Flow
   ```

2. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

3. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

### Running Locally

Start the Vite development server:

```bash
npm run dev
```

Open your browser and go to `http://localhost:5173` (or the port Vite shows in the terminal).

Other available scripts:

```bash
npm run build     # Build for production (outputs to dist/)
npm run preview   # Preview the production build locally
npm run lint      # Run ESLint
```

---

## 🔧 Engine Compilation (Advanced)

This section is only needed if you modify the core C++ engine source files (`Board.cpp`, `AI.cpp`, `BoardAI.cpp`, `Square.cpp`, or `WasmBindings.cpp`).

### Prerequisites

Install the [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html):

```bash
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh  # (or emsdk_env.bat on Windows)
```

### Compile the WASM module

From the project root (where the `.cpp` files live):

```bash
emcc Board.cpp BoardAI.cpp AI.cpp Square.cpp WasmBindings.cpp \
  -o frontend/public/chess_module.js \
  -s EXPORT_ES6=1 \
  -s MODULARIZE=1 \
  -s ENVIRONMENT=web \
  -O3 \
  --bind
```

This will overwrite `frontend/public/chess_module.js` and `frontend/public/chess_module.wasm` with your updated engine.

**Emscripten flags explained:**

| Flag | Purpose |
|---|---|
| `-s EXPORT_ES6=1` | Outputs as an ES module (compatible with Vite) |
| `-s MODULARIZE=1` | Wraps the module in a factory function (`chess_module()`) |
| `-s ENVIRONMENT=web` | Targets browser environment only |
| `-O3` | Maximum optimization level for fastest runtime performance |
| `--bind` | Enables Embind for C++ ↔ JavaScript function bindings |

---

## 🎮 Game Modes

| Mode | Description |
|---|---|
| **Player vs AI** | Play against the custom C++ engine. Adjust difficulty via the ELO slider (250–3200). The AI runs in a Web Worker for non-blocking, smooth gameplay. |
| **Local PvP** | Two players share one device. Each side has their own chess clock with configurable time controls. |
| **Online Multiplayer** | One player creates a room and shares the 6-character room code. The other joins and plays in real time over Firebase. Supports draw offers, resign, and chat. |
| **Board Editor** | Freely place or remove pieces to construct any position. Once satisfied, launch the position against the AI at maximum strength. |

---

## 🧠 AI Engine Deep Dive

The AI is a classical minimax search with alpha-beta pruning, implemented entirely in C++ for maximum performance and compiled to WebAssembly.

### Depth Scaling by ELO

The AI scales its search depth to simulate different skill levels:

| ELO Range | Search Depth |
|---|---|
| ≤ 600 | 1 ply |
| 601 – 1000 | 2 ply |
| 1001 – 1500 | 3 ply |
| 1501 – 2200 | 4 ply |
| > 2200 | 5 ply |

### Algorithm

- **Minimax** with full game-tree search at the configured depth
- **Alpha-Beta Pruning** for up to ~10× speedup over naive minimax by discarding irrelevant branches
- **Static evaluation** via `Board::evaluate()` — material balance, piece-square tables, king safety
- **Stalemate & checkmate** detection at leaf nodes with depth-adjusted scores to prefer faster wins

### Web Worker Integration

```
React UI  ──── postMessage({type:'calculate', fen, elo}) ────►  ai_worker.js
          ◄─── postMessage({type:'result', move})  ──────────  (WASM loaded here)
```

The worker loads the WASM module once on startup. Every time it's the AI's turn, `App.jsx` posts the current FEN and ELO to the worker, which calls `wasmModule.getBestMove(elo)` and posts back the move string `"fromX,fromY,toX,toY"`.

### WASM Bindings (Emscripten Embind)

The following C++ functions are exported to JavaScript via `WasmBindings.cpp`:

| JS Function | C++ Implementation | Description |
|---|---|---|
| `initBoard()` | `Board::setBoard()` | Reset to starting position |
| `setBoardFromFEN(fen)` | `Board::setBoardFromFEN()` | Load arbitrary position |
| `getBestMove(elo)` | `AI::getBestMove()` | Run minimax search, return move string |
| `makeMove(fx,fy,tx,ty,promo)` | `Board::makeMoveAI()` | Apply a move |
| `getBoardState()` | `Board::generatePositionString()` | Export current FEN |
| `getGameState()` | `Board::getGameState()` | Checkmate/stalemate/draw status |

---

## 🔥 Firebase Setup

To run the multiplayer features in your own fork, set up a Firebase project:

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a new project.

2. Enable **Authentication** → Email/Password sign-in method.

3. Enable **Realtime Database** and set the following security rules for development:
   ```json
   {
     "rules": {
       ".read": "auth != null",
       ".write": "auth != null"
     }
   }
   ```

4. Copy your Firebase project config and update `frontend/src/firebase.js`:
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

The project is configured to deploy to **GitHub Pages** with the `base: '/Tactic_Flow/'` path in `vite.config.js`.

### Build and deploy

```bash
# In frontend/
npm run build
```

This outputs to `frontend/dist/`. Push the contents to your `gh-pages` branch or configure GitHub Actions for automated deployment.

### Automated GitHub Actions (optional)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: cd frontend && npm install && npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: frontend/dist
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 👤 Author

**Rudra** — [@Rudra2609](https://github.com/Rudra2609)

---

<div align="center">

Made with ♟️ and ❤️ — [Play Tactic Flow](https://rudra2609.github.io/Tactic_Flow/)

</div>
