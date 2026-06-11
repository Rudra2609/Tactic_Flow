import { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import './App.css';

function getPieceAt(fen, x, y) {
  const rows = fen.split(' ')[0].split('/');
  const row = rows[x];
  let col = 0;
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (isNaN(char)) {
      if (col === y) return char;
      col++;
    } else {
      col += parseInt(char);
      if (y < col) return '.';
    }
  }
  return '.';
}

function App() {
  const [fen, setFen] = useState("start");
  const [gameMode, setGameMode] = useState("menu");
  const [elo, setElo] = useState(1200);
  const [wasmModule, setWasmModule] = useState(null);
  const [status, setStatus] = useState("Loading engine...");
  const [gameState, setGameState] = useState(0); // 0=Ongoing, 1=Checkmate, 2=Stalemate, 3=Draw50, 4=DrawRep
  const [pendingPromotion, setPendingPromotion] = useState(null);

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
    setGameState(0);
    setPendingPromotion(null);
    setStatus(mode === "ai" ? "Your turn (White)" : "White's turn");
  };

  const processGameState = (mod) => {
    const state = mod.getGameState();
    setGameState(state);
    if (state === 1) {
      setStatus(`Checkmate! ${mod.getTurn() === 0 ? "Black" : "White"} wins!`);
    } else if (state === 2) {
      setStatus("Stalemate! Game is a draw.");
    } else if (state === 3) {
      setStatus("Draw by 50-move rule.");
    } else if (state === 4) {
      setStatus("Draw by threefold repetition.");
    }
    return state !== 0;
  };

  const executeMove = (fromX, fromY, toX, toY, promotionPiece) => {
    const isLegal = wasmModule.makeMove(fromX, fromY, toX, toY, promotionPiece);
    if (isLegal) {
      setFen(wasmModule.getBoardState());
      if (processGameState(wasmModule)) return true;
      
      setStatus(wasmModule.getTurn() === 0 ? "White's turn" : "Black's turn");
      
      if (gameMode === "ai" && wasmModule.getTurn() === 1) {
        setStatus("AI thinking...");
        setTimeout(() => {
          try {
            if (wasmModule.getGameState() !== 0) return;
            const aiMoveStr = wasmModule.getBestMove(elo);
            const parts = aiMoveStr.split(",");
            if (parts.length === 4) {
              const [aiFromX, aiFromY, aiToX, aiToY] = parts.map(Number);
              wasmModule.makeMove(aiFromX, aiFromY, aiToX, aiToY, 1); // AI defaults to Queen
              setFen(wasmModule.getBoardState());
              if (processGameState(wasmModule)) return;
              setStatus("Your turn (White)");
            }
          } catch(e) {
            setStatus("AI Error: " + e.message);
          }
        }, 50);
      }
      return true;
    } else {
      setStatus(`Invalid move.`);
      return false;
    }
  };

  const onDrop = ({ sourceSquare, targetSquare }) => {
    if (!wasmModule || gameState !== 0 || pendingPromotion) return false;

    try {
      const fromY = sourceSquare.charCodeAt(0) - 97;
      const fromX = 8 - parseInt(sourceSquare[1]);
      const toY = targetSquare.charCodeAt(0) - 97;
      const toX = 8 - parseInt(targetSquare[1]);

      const piece = getPieceAt(fen, fromX, fromY);
      
      if ((piece === 'P' && toX === 0) || (piece === 'p' && toX === 7)) {
        setPendingPromotion({ fromX, fromY, toX, toY });
        return true; // Visually keep the piece there until selected
      }

      return executeMove(fromX, fromY, toX, toY, 1); // 1 = Queen default
    } catch (e) {
      setStatus(`Crash: ${e.message}`);
      return false;
    }
  };

  const handlePromotionSelection = (pieceEnum) => {
    if (!pendingPromotion) return;
    executeMove(pendingPromotion.fromX, pendingPromotion.fromY, pendingPromotion.toX, pendingPromotion.toY, pieceEnum);
    setPendingPromotion(null);
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
            <div className={`status-box ${gameState !== 0 ? 'game-over' : ''}`}>
              {status}
            </div>
            {pendingPromotion && (
              <div className="promotion-modal">
                <h3>Select Promotion Piece</h3>
                <div className="promotion-buttons">
                  <button onClick={() => handlePromotionSelection(1)}>Queen</button>
                  <button onClick={() => handlePromotionSelection(4)}>Rook</button>
                  <button onClick={() => handlePromotionSelection(2)}>Bishop</button>
                  <button onClick={() => handlePromotionSelection(3)}>Knight</button>
                </div>
              </div>
            )}
            <button onClick={() => handleStartGame("menu")} className="btn back-btn">End Game</button>
          </div>
          <div className="board-wrapper" style={{ position: 'relative' }}>
            {gameState !== 0 && (
              <div className="board-overlay">
                <h2>Game Over</h2>
                <p>{status}</p>
                <button onClick={() => handleStartGame("menu")} className="btn">Back to Menu</button>
              </div>
            )}
            <div style={{ width: 600, height: 600 }}>
              <Chessboard 
                options={{
                  position: fen,
                  onPieceDrop: onDrop,
                  darkSquareStyle: { backgroundColor: "#779556" },
                  lightSquareStyle: { backgroundColor: "#ebecd0" },
                  animationDurationInMs: 200,
                  arePiecesDraggable: gameState === 0 && !pendingPromotion
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
