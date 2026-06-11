import { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import './App.css';

function App() {
  const [fen, setFen] = useState("start");
  const [gameMode, setGameMode] = useState("menu");
  const [elo, setElo] = useState(1200);
  const [wasmModule, setWasmModule] = useState(null);
  const [status, setStatus] = useState("Loading engine...");

  useEffect(() => {
    const initWasm = async () => {
      try {
        if (window.chess_module) {
          const mod = await window.chess_module();
          setWasmModule(mod);
          mod.initBoard();
          setFen(mod.getBoardState());
          setStatus("Engine ready");
        } else {
          setTimeout(initWasm, 500);
        }
      } catch (e) {
        console.error("WASM init error", e);
        setStatus("Failed to load engine");
      }
    };
    initWasm();
  }, []);

  const handleStartGame = (mode) => {
    if (!wasmModule) {
      alert("Engine not loaded yet!");
      return;
    }
    wasmModule.initBoard();
    setFen(wasmModule.getBoardState());
    setGameMode(mode);
    setStatus(mode === "ai" ? "Your turn (White)" : "White's turn");
  };

  const onDrop = (sourceSquare, targetSquare) => {
    if (!wasmModule) return false;

    const fromY = sourceSquare.charCodeAt(0) - 97;
    const fromX = 8 - parseInt(sourceSquare[1]);
    const toY = targetSquare.charCodeAt(0) - 97;
    const toX = 8 - parseInt(targetSquare[1]);

    const isLegal = wasmModule.makeMove(fromX, fromY, toX, toY, 1);
    
    if (isLegal) {
      const newFen = wasmModule.getBoardState();
      setFen(newFen);
      
      const turnMsg = wasmModule.getTurn() === 0 ? "White's turn" : "Black's turn";
      setStatus(turnMsg);

      if (gameMode === "ai" && wasmModule.getTurn() === 1) {
        setStatus("AI is thinking...");
        setTimeout(() => {
          const aiMoveStr = wasmModule.getBestMove(elo);
          const parts = aiMoveStr.split(",");
          if (parts.length === 4) {
            const [aiFromX, aiFromY, aiToX, aiToY] = parts.map(Number);
            wasmModule.makeMove(aiFromX, aiFromY, aiToX, aiToY, 1);
            setFen(wasmModule.getBoardState());
            setStatus("Your turn (White)");
          }
        }, 100);
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
            <p className="status-text">{status}</p>
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
            <h2 className="title-small">{gameMode === "ai" ? "Player vs AI" : "Player vs Player"}</h2>
            {gameMode === "ai" && <p className="subtitle">AI ELO: {elo}</p>}
            <div className="status-box">{status}</div>
            <button onClick={() => handleStartGame("menu")} className="btn back-btn">End Game</button>
          </div>
          <div className="board-wrapper">
            <Chessboard 
              position={fen} 
              onPieceDrop={onDrop} 
              boardWidth={600} 
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
