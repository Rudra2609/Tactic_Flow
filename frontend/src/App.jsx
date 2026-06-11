import { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import './App.css';

function App() {
  const [fen, setFen] = useState("start");
  const [gameMode, setGameMode] = useState("menu"); // "menu", "ai", "pvp"
  const [elo, setElo] = useState(1200);
  const [wasmModule, setWasmModule] = useState(null);

  useEffect(() => {
    // Check if the script created a global Module loading function
    if (window.chess_module) {
      window.chess_module().then((mod) => {
        setWasmModule(mod);
        mod.initBoard();
        setFen(mod.getBoardState());
      });
    }
  }, []);

  const handleStartGame = (mode) => {
    setGameMode(mode);
    if (wasmModule) {
      wasmModule.initBoard();
      setFen(wasmModule.getBoardState());
    }
  };

  const onDrop = (sourceSquare, targetSquare) => {
    if (!wasmModule) return false;

    // Convert 'e2' to coords
    const fromY = sourceSquare.charCodeAt(0) - 'a'.charCodeAt(0);
    const fromX = 8 - parseInt(sourceSquare[1]);
    const toY = targetSquare.charCodeAt(0) - 'a'.charCodeAt(0);
    const toX = 8 - parseInt(targetSquare[1]);

    const isLegal = wasmModule.makeMove(fromX, fromY, toX, toY, 1); // 1 = QUEEN
    if (isLegal) {
      setFen(wasmModule.getBoardState());
      
      if (gameMode === "ai" && wasmModule.getTurn() === 1) { // 1 = BLACK
        setTimeout(() => {
          const aiMoveStr = wasmModule.getBestMove(elo);
          const parts = aiMoveStr.split(",");
          if (parts.length === 4) {
            const [aiFromX, aiFromY, aiToX, aiToY] = parts.map(Number);
            wasmModule.makeMove(aiFromX, aiFromY, aiToX, aiToY, 1);
            setFen(wasmModule.getBoardState());
          }
        }, 100); // slight delay for aesthetics
      }
      return true;
    }
    return false;
  };

  return (
    <div className="app-background">
      {gameMode === "menu" ? (
        <div className="menu-container">
          <h1 className="title">Advance Chess</h1>
          <div className="menu-card">
            <h2>Select Game Mode</h2>
            <button className="btn" onClick={() => handleStartGame("pvp")}>Player vs Player</button>
            <div className="ai-section">
              <label>AI Difficulty (ELO): <strong>{elo}</strong></label>
              <input 
                type="range" 
                min="800" max="3200" step="400"
                value={elo} 
                onChange={(e) => setElo(parseInt(e.target.value))}
                className="slider"
              />
              <button className="btn ai-btn" onClick={() => handleStartGame("ai")}>Start vs AI</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="game-container">
          <div className="sidebar">
            <h2 className="title">{gameMode === "ai" ? "Player vs AI" : "Player vs Player"}</h2>
            {gameMode === "ai" && <p className="subtitle">AI ELO: {elo}</p>}
            <button onClick={() => handleStartGame("menu")} className="btn back-btn">End Game</button>
          </div>
          <div className="board-wrapper">
            <Chessboard 
              position={fen} 
              onPieceDrop={onDrop} 
              boardWidth={560} 
              customDarkSquareStyle={{ backgroundColor: "#779556" }} 
              customLightSquareStyle={{ backgroundColor: "#ebecd0" }} 
              animationDuration={200}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
