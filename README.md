# Tactic Flow ♟️

Welcome to **Tactic Flow**, a high-performance, real-time multiplayer web-based chess engine and application.

Play it live here: 👉 **[https://rudra2609.github.io/Tactic_Flow/](https://rudra2609.github.io/Tactic_Flow/)**

![Tactic Flow Preview](https://github.com/user-attachments/assets/1903e52b-59d7-4433-b17e-639462da5ae0)

---

## ✨ Features

- **Blazing Fast AI Engine**: At its core, Tactic Flow runs a custom **C++ Chess Engine** that has been compiled directly into **WebAssembly (WASM)**. This allows the AI to calculate deep variations and evaluate positions at near-native speeds directly in your browser without requiring a backend server.
- **Online Real-Time Multiplayer**: Built with **Firebase Realtime Database**, you can seamlessly create lobbies, share room codes, and play live against friends anywhere in the world. Includes real-time chat and game synchronization.
- **Advanced Match Controls**: 
  - Send real-time **Draw Offers** to your opponent.
  - Instantly **Resign** from matches.
  - Built-in chess clocks and timer increments.
- **Player vs AI & Local PvP**: Test your skills against the built-in AI with an adjustable ELO slider (250 to 3200), or play locally against a friend with dedicated side-by-side chess clocks.
- **Interactive Board Editor (Custom Setup)**: Set up custom scenarios, puzzles, or historical game positions using the drag-and-drop Board Editor, and then instantly play them out against the AI at maximum difficulty.
- **Secure Authentication**: Built-in **Firebase Authentication** allows players to securely log in, sign up, and track their identities across multiplayer sessions.
- **Stunning UI/UX**: Built with **React** and `react-chessboard`, featuring a beautiful dark glassmorphism aesthetic, fully responsive mobile support, smooth move animations, and robust drag-and-drop validation.

---

## 🛠️ Tech Stack

- **Frontend**: React, Vite, CSS (Dark Glassmorphism design)
- **Chess Logic & UI**: `chess.js`, `react-chessboard`
- **Core Engine**: C++
- **Compilation**: Emscripten (WebAssembly)
- **Backend / Real-Time Sync**: Firebase Realtime Database
- **Authentication**: Firebase Auth
- **Hosting**: GitHub Pages

---

## 🚀 Running Locally

If you want to clone and run the project locally on your machine:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Rudra2609/Tactic_Flow.git
   cd Tactic_Flow
   ```

2. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

*(Note: The WebAssembly module `chess_module.js` and `chess_module.wasm` are already pre-compiled and included in the `frontend/public` directory, so you do not need to install C++ compilers or Emscripten to run the frontend!)*

---

## 🧠 Engine Compilation (Advanced)

If you modify the core C++ engine files (`Board.cpp`, `AI.cpp`, etc.) and want to recompile the WebAssembly module, you will need the [Emscripten SDK](https://emscripten.org/):

```bash
emcc Board.cpp BoardAI.cpp AI.cpp Square.cpp WasmBindings.cpp -o frontend/public/chess_module.js -s EXPORT_ES6=1 -s MODULARIZE=1 -s ENVIRONMENT=web -O3 --bind
```
