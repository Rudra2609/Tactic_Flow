import { useState, useEffect, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, set, onValue, update, get, onDisconnect, remove } from 'firebase/database';
import { auth, db } from './firebase';
import Auth from './Auth';
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
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [gameMode, setGameMode] = useState("menu"); // menu, pvp, ai, editor
  const [fen, setFen] = useState("start");
  const [elo, setElo] = useState(250);
  const [wasmModule, setWasmModule] = useState(null);
  const [status, setStatus] = useState("Loading engine...");
  const [gameState, setGameState] = useState(0); // 0=Ongoing, 1=Checkmate, 2=Stalemate, 3=Draw50, 4=DrawRep, 5=InsufficientMaterial, 6=Timeout, 7=TimeoutvsInsufficient
  const [pendingPromotion, setPendingPromotion] = useState(null);

  // Editor states
  const [editorPiece, setEditorPiece] = useState('wP');
  const [editorTurn, setEditorTurn] = useState('w');

  // Time control states
  const [timeControl, setTimeControl] = useState({ minutes: 10, increment: 0 });
  const [whiteTime, setWhiteTime] = useState(600);
  const [blackTime, setBlackTime] = useState(600);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const historyContainerRef = useRef(null);
  const [moveFrom, setMoveFrom] = useState(null);
  const [playerColor, setPlayerColor] = useState("white");

  // Multiplayer state
  const [roomId, setRoomId] = useState(null);
  const [joinRoomCode, setJoinRoomCode] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [opponentName, setOpponentName] = useState(null);
  const [showLobbyModal, setShowLobbyModal] = useState(false);
  const [lobbyError, setLobbyError] = useState("");
  const dbRef = useRef(null); // Keep track of current game ref for cleanup

  // Move history state
  const [chess] = useState(new Chess());
  const [moveHistory, setMoveHistory] = useState([]);

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

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Timer Interval
  useEffect(() => {
    if (gameState !== 0 || !isTimerRunning || timeControl.minutes === 0) return;
    
    const timerId = setInterval(() => {
      const activeColor = wasmModule.getTurn(); // 0 = White, 1 = Black
      if (activeColor === 0) {
        setWhiteTime((prev) => {
          if (prev <= 1) { handleTimeout(0); return 0; }
          return prev - 1;
        });
      } else {
        setBlackTime((prev) => {
          if (prev <= 1) { handleTimeout(1); return 0; }
          return prev - 1;
        });
      }
    }, 1000);
    return () => clearInterval(timerId);
  }, [gameState, isTimerRunning, wasmModule, timeControl]);

  const handleTimeout = (timedOutColor) => {
    setIsTimerRunning(false);
    const opponentColor = timedOutColor === 0 ? 1 : 0;
    const opponentHasMaterial = wasmModule.hasMatingMaterial(opponentColor);
    
    if (opponentHasMaterial) {
      setGameState(6);
      setStatus(`Time Out! ${timedOutColor === 0 ? "Black" : "White"} wins!`);
    } else {
      setGameState(7);
      setStatus("Draw: Timeout vs Insufficient Material");
    }
  };

  const createRoom = async () => {
    try {
      setLobbyError("");
      const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const gameRef = ref(db, `games/${newRoomId}`);
      
      await set(gameRef, {
        hostName: user.displayName || user.email.split('@')[0],
        guestName: null,
        status: "waiting", // waiting, playing, finished
        lastMove: null
      });

      onDisconnect(gameRef).remove(); // Auto-cleanup if host drops

      setRoomId(newRoomId);
      setIsHost(true);
      setPlayerColor("white");
      listenToRoom(newRoomId, true);
    } catch (error) {
      console.error(error);
      setLobbyError("Failed to create room. Is Firebase Realtime Database enabled?");
    }
  };

  const joinRoom = async () => {
    if (!joinRoomCode) return;
    try {
      setLobbyError("");
      const code = joinRoomCode.toUpperCase();
      const gameRef = ref(db, `games/${code}`);
      const snapshot = await get(gameRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.status === "waiting") {
          await update(gameRef, {
            guestName: user.displayName || user.email.split('@')[0],
            status: "playing"
          });
          onDisconnect(gameRef).remove(); // If guest drops, destroy room
          setRoomId(code);
          setIsHost(false);
          setPlayerColor("black");
          listenToRoom(code, false);
        } else {
          setLobbyError("Game is already in progress.");
        }
      } else {
        setLobbyError("Invalid room code.");
      }
    } catch (error) {
      console.error(error);
      setLobbyError("Failed to join room. Is Firebase Realtime Database enabled?");
    }
  };

  const listenToRoom = (code, isHostLocal) => {
    const gameRef = ref(db, `games/${code}`);
    dbRef.current = gameRef;
    let hasStarted = false;
    
    onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        if (hasStarted) {
          alert("The Other Player left");
          setGameMode("menu");
          setRoomId(null);
          setShowLobbyModal(false);
        }
        return;
      }

      setOpponentName(isHostLocal ? data.guestName : data.hostName);
      
      if (data.status === "playing") {
        setShowLobbyModal(false);
        
        if (!hasStarted) {
          hasStarted = true;
          handleStartGame("online", isHostLocal ? "white" : "black");
        }
        
        // If we have a new move from the opponent, apply it locally
        if (data.lastMove) {
          const expectedTurn = isHostLocal ? 1 : 0; // Host expects black's move (1)
          if (data.lastMove.turn === expectedTurn) {
            setIncomingMove(data.lastMove);
          }
        }
      }
    });
  };

  const [incomingMove, setIncomingMove] = useState(null);

  useEffect(() => {
    if (incomingMove && wasmModule && gameMode === "online") {
      const { fromX, fromY, toX, toY, promo, turn } = incomingMove;
      if (wasmModule.getTurn() === turn) {
        executeMove(fromX, fromY, toX, toY, promo, true); // true = isOnlineSync
      }
    }
  }, [incomingMove, wasmModule, gameMode]);

  const handleStartGame = (mode, onlineColor = null) => {
    if (!wasmModule) {
      alert("Engine not loaded yet!");
      return;
    }
    
    if (mode === "editor") {
      setGameMode("editor");
      chess.clear(); // Empty board for editor
      setFen(chess.fen());
      return;
    }

    let actualColor = playerColor;
    if (mode === "ai" && playerColor === "random") {
      actualColor = Math.random() < 0.5 ? "white" : "black";
      setPlayerColor(actualColor); // Save the resolved color so the board orients correctly
    } else if (mode === "online" && onlineColor) {
      actualColor = onlineColor;
      setPlayerColor(actualColor); // Sync state for UI
    }

    wasmModule.initBoard();
    chess.reset();
    setFen(wasmModule.getBoardState());
    setMoveHistory([]);
    setGameMode(mode);
    setGameState(0);
    setPendingPromotion(null);
    setWhiteTime(timeControl.minutes * 60);
    setBlackTime(timeControl.minutes * 60);
    setIsTimerRunning(true);
    setStatus(mode === "ai" ? `Your turn (${actualColor})` : "White's turn");

    if (mode === "ai" && actualColor === "black") {
      setStatus("AI thinking...");
      setTimeout(() => triggerAIMove(wasmModule), 50);
    }
  };

  const handleQuitGame = () => {
    if (gameState === 0 && !window.confirm("Are you sure you want to end the game?")) {
      return;
    }
    
    // Clean up online room if quitting an active online match
    if (gameMode === "online" && dbRef.current) {
      remove(dbRef.current);
    }
    
    setRoomId(null);
    setShowLobbyModal(false);
    handleStartGame("menu");
  };

  const triggerAIMove = (mod) => {
    try {
      if (mod.getGameState() !== 0) return;
      const aiMoveStr = mod.getBestMove(elo);
      const parts = aiMoveStr.split(",");
      if (parts.length === 4) {
        const [aiFromX, aiFromY, aiToX, aiToY] = parts.map(Number);
        executeMove(aiFromX, aiFromY, aiToX, aiToY, 1);
      }
    } catch(e) {
      setStatus("AI Error: " + e.message);
    }
  };

  const processGameState = (mod) => {
    const state = mod.getGameState();
    if (state !== 0) {
      setGameState(state);
      setIsTimerRunning(false);
    }
    if (state === 1) {
      setStatus(`Checkmate! ${mod.getTurn() === 0 ? "Black" : "White"} wins!`);
    } else if (state === 2) {
      setStatus("Stalemate! Game is a draw.");
    } else if (state === 3) {
      setStatus("Draw by 50-move rule.");
    } else if (state === 4) {
      setStatus("Draw by threefold repetition.");
    } else if (state === 5) {
      setStatus("Draw by Insufficient Material.");
    }
    return state !== 0;
  };

  const executeMove = (fromX, fromY, toX, toY, promotionPiece, isOnlineSync = false) => {
    const activeColorBefore = wasmModule.getTurn();
    const isLegal = wasmModule.makeMove(fromX, fromY, toX, toY, promotionPiece);
    if (isLegal) {
      setFen(wasmModule.getBoardState());
      
      // Update chess.js shadow board to generate SAN
      const fromStr = String.fromCharCode(fromY + 97) + (8 - fromX);
      const toStr = String.fromCharCode(toY + 97) + (8 - toX);
      const promoChars = ['', 'q', 'b', 'n', 'r'];
      try {
        chess.move({ from: fromStr, to: toStr, promotion: promoChars[promotionPiece] });
        setMoveHistory([...chess.history({ verbose: true })]);
        setTimeout(() => {
          if (historyContainerRef.current) {
            historyContainerRef.current.scrollTo({
              top: historyContainerRef.current.scrollHeight,
              behavior: 'smooth'
            });
          }
        }, 50);
      } catch (e) {
        console.warn("chess.js failed to mirror move:", e);
      }
      
      // Apply increment
      if (timeControl.increment > 0 && timeControl.minutes > 0) {
        if (activeColorBefore === 0) setWhiteTime(prev => prev + timeControl.increment);
        else setBlackTime(prev => prev + timeControl.increment);
      }

      if (processGameState(wasmModule)) return true;
      
      setStatus(wasmModule.getTurn() === 0 ? "White's turn" : "Black's turn");

      if (gameMode === "online" && !isOnlineSync && dbRef.current) {
        update(dbRef.current, {
          lastMove: { fromX, fromY, toX, toY, promo: promotionPiece, turn: activeColorBefore }
        }).catch(e => console.error("Firebase sync error:", e));
      }
      
      if (gameMode === "ai") {
        const aiColorId = playerColor === "white" ? 1 : 0;
        if (wasmModule.getTurn() === aiColorId) {
          setStatus("AI thinking...");
          setTimeout(() => triggerAIMove(wasmModule), 50);
        }
      }
      return true;
    } else {
      setStatus(`Invalid move.`);
      return false;
    }
  };

  const onDrop = ({ sourceSquare, targetSquare }) => {
    setMoveFrom(null);
    if (!wasmModule || gameState !== 0 || pendingPromotion) return false;

    try {
      const fromY = sourceSquare.charCodeAt(0) - 97;
      const fromX = 8 - parseInt(sourceSquare[1]);
      const toY = targetSquare.charCodeAt(0) - 97;
      const toX = 8 - parseInt(targetSquare[1]);

      if ((gameMode === "ai" && wasmModule.getTurn() === (playerColor === "white" ? 1 : 0)) ||
          (gameMode === "online" && wasmModule.getTurn() === (playerColor === "white" ? 1 : 0))) {
        // Prevent moving opponent's pieces
        return false;
      }

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

  const onGameSquareClick = (...args) => {
    if (gameState !== 0 || !wasmModule || pendingPromotion) return;
    
    let square = typeof args[0] === 'string' ? args[0] : args[0]?.square;
    if (!square) return;

    const y = square.charCodeAt(0) - 97;
    const x = 8 - parseInt(square[1]);
    const piece = getPieceAt(fen, x, y);

    const isWhiteTurn = wasmModule.getTurn() === 0;
    const isOwnPiece = piece && ((isWhiteTurn && piece >= 'A' && piece <= 'Z') || (!isWhiteTurn && piece >= 'a' && piece <= 'z'));

    if (!moveFrom) {
      if (isOwnPiece) {
        setMoveFrom(square);
      }
    } else {
      if (isOwnPiece && moveFrom !== square) {
        setMoveFrom(square);
      } else {
        onDrop({ sourceSquare: moveFrom, targetSquare: square });
      }
    }
  };

  const onEditorSquareClick = ({ square }) => {
    if (editorPiece === 'eraser') {
      chess.remove(square);
    } else {
      chess.put({ type: editorPiece[1].toLowerCase(), color: editorPiece[0] }, square);
    }
    const fenParts = chess.fen().split(' ');
    fenParts[1] = editorTurn;
    setFen(fenParts.join(' '));
  };

  const onEditorPieceDrop = ({ sourceSquare, targetSquare }) => {
    const p = chess.remove(sourceSquare);
    if (p) {
      chess.put(p, targetSquare);
      const fenParts = chess.fen().split(' ');
      fenParts[1] = editorTurn;
      setFen(fenParts.join(' '));
      return true;
    }
    return false;
  };

  const onEditorPieceDropOffBoard = ({ sourceSquare }) => {
    chess.remove(sourceSquare);
    const fenParts = chess.fen().split(' ');
    fenParts[1] = editorTurn;
    setFen(fenParts.join(' '));
  };

  const handleEditorTurnToggle = (turn) => {
    setEditorTurn(turn);
    const fenParts = fen.split(' ');
    fenParts[1] = turn;
    setFen(fenParts.join(' '));
    try { chess.load(fenParts.join(' ')); } catch(e){}
  };

  const validateAndPlayEditor = () => {
    let wKings = 0, bKings = 0;
    const boardArr = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = boardArr[r][c];
        if (sq && sq.type === 'k') {
          if (sq.color === 'w') wKings++;
          else bKings++;
        }
      }
    }
    if (wKings !== 1 || bKings !== 1) {
      alert("Board must have exactly one White King and one Black King.");
      return;
    }

    const fenBoard = fen.split(' ')[0];
    const rows = fenBoard.split('/');
    if (rows[0].includes('P') || rows[0].includes('p') || rows[7].includes('P') || rows[7].includes('p')) {
      alert("Pawns cannot be on the 1st or 8th rank.");
      return;
    }

    const oppTurn = editorTurn === 'w' ? 'b' : 'w';
    const fenParts = fen.split(' ');
    fenParts[1] = oppTurn;
    try {
      const tempChess = new Chess(fenParts.join(' '));
      if (tempChess.isCheck()) {
        alert("Invalid position: The side not to move is in check.");
        return;
      }
    } catch(e) {}

    let fullFen = fenParts.join(' ');
    if (fenParts.length < 6) fullFen = `${fenParts[0]} ${fenParts[1]} ${fenParts[2] || '-'} ${fenParts[3] || '-'} 0 1`;
    
    const success = wasmModule.setBoardFromFEN(fullFen);
    if (success) {
      chess.load(fullFen);
      setFen(fullFen);
      setMoveHistory([]);
      setGameMode("ai");
      setGameState(0);
      setPendingPromotion(null);
      setWhiteTime(timeControl.minutes * 60);
      setBlackTime(timeControl.minutes * 60);
      setIsTimerRunning(true);
      setStatus(editorTurn === 'w' ? "Your turn (White)" : "AI thinking...");
      
      if (editorTurn === 'b') {
        setTimeout(() => {
          const aiMoveStr = wasmModule.getBestMove(elo);
          const parts = aiMoveStr.split(",");
          if (parts.length === 4) {
            const [aiFromX, aiFromY, aiToX, aiToY] = parts.map(Number);
            executeMove(aiFromX, aiFromY, aiToX, aiToY, 1);
          }
        }, 50);
      }
    } else {
      alert("WASM Engine rejected the FEN string.");
    }
  };

  const piecesArray = [
    { id: 'wK', icon: '♔' }, { id: 'wQ', icon: '♕' }, { id: 'wR', icon: '♖' }, { id: 'wB', icon: '♗' }, { id: 'wN', icon: '♘' }, { id: 'wP', icon: '♙' },
    { id: 'bK', icon: '♚' }, { id: 'bQ', icon: '♛' }, { id: 'bR', icon: '♜' }, { id: 'bB', icon: '♝' }, { id: 'bN', icon: '♞' }, { id: 'bP', icon: '♟' },
    { id: 'eraser', icon: '❌' }
  ];

  const formatTime = (seconds) => {
    if (timeControl.minutes === 0) return "∞";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatSan = (san, color) => {
    if (san.startsWith('N')) return <><span className={`piece-icon ${color}`}>♞</span>{san.slice(1)}</>;
    if (san.startsWith('B')) return <><span className={`piece-icon ${color}`}>♝</span>{san.slice(1)}</>;
    if (san.startsWith('R')) return <><span className={`piece-icon ${color}`}>♜</span>{san.slice(1)}</>;
    if (san.startsWith('Q')) return <><span className={`piece-icon ${color}`}>♛</span>{san.slice(1)}</>;
    if (san.startsWith('K')) return <><span className={`piece-icon ${color}`}>♚</span>{san.slice(1)}</>;
    return san;
  };

  // Group moves into pairs for display
  const movePairs = [];
  for (let i = 0; i < moveHistory.length; i += 2) {
    movePairs.push({
      white: moveHistory[i],
      black: moveHistory[i + 1]
    });
  }

  if (authLoading) return <div className="app-background"><p className="status-text" style={{ position: 'relative', zIndex: 1 }}>Loading...</p></div>;
  if (!user) return <div className="app-background"><Auth onAuthSuccess={() => {}} /></div>;

  return (
    <div className="app-background">
      {gameMode === "menu" ? (
        <div className="menu-container">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
            <h1 className="title" style={{ marginBottom: 0 }}>Tactic Flow</h1>
          </div>
          <div className="menu-card">
            <p className="status-text">{status}</p>
            
            <div className="time-control-section">
              <label>Time Control: </label>
              <select 
                value={`${timeControl.minutes}|${timeControl.increment}`}
                onChange={(e) => {
                  const [m, i] = e.target.value.split('|').map(Number);
                  setTimeControl({ minutes: m, increment: i });
                }}
                className="time-select"
              >
                <option value="0|0">Unlimited</option>
                <option value="3|2">Blitz (3 | 2)</option>
                <option value="5|3">Blitz (5 | 3)</option>
                <option value="10|0">Rapid (10 | 0)</option>
                <option value="15|10">Rapid (15 | 10)</option>
              </select>
            </div>

            <h2>Select Game Mode</h2>
            <button className="btn" onClick={() => handleStartGame("pvp")}>Player vs Player</button>
            <button className="btn" style={{background: '#10b981', marginTop: '1rem'}} onClick={() => setShowLobbyModal(true)}>Play with Friend</button>

            {showLobbyModal && (
              <div className="lobby-modal">
                <h3>Online Multiplayer</h3>
                {lobbyError && <p style={{color: '#f43f5e', fontWeight: 'bold'}}>{lobbyError}</p>}
                
                {roomId ? (
                  <div className="room-info">
                    <p>Room Code: <strong>{roomId}</strong></p>
                    <p>Waiting for opponent...</p>
                    <button className="btn" onClick={() => {
                      if (dbRef.current) remove(dbRef.current);
                      setRoomId(null);
                    }}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <button className="btn" onClick={createRoom}>Create Game</button>
                    <div style={{ margin: '1.5rem 0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <input 
                        type="text" 
                        placeholder="Enter Room Code" 
                        value={joinRoomCode} 
                        onChange={(e) => setJoinRoomCode(e.target.value)} 
                        style={{ padding: '12px', borderRadius: '4px', border: '1px solid #ccc', background: '#1e293b', color: '#fff', width: '100%', boxSizing: 'border-box' }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn" onClick={joinRoom} style={{ background: '#3b82f6', flex: 1, margin: 0 }}>Join</button>
                        <button className="btn back-btn" onClick={() => setShowLobbyModal(false)} style={{ flex: 1, margin: 0 }}>Close</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="ai-section" style={{ marginTop: '2rem' }}>
              <label>AI Difficulty (ELO): <strong>{elo}</strong></label>
              <input 
                type="range" 
                min="250" max="3200" step="50"
                value={elo} 
                onChange={(e) => setElo(parseInt(e.target.value))}
                className="slider"
              />
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem', marginBottom: '1rem' }}>
                <button className={`color-select-btn ${playerColor === 'white' ? 'selected' : ''}`} onClick={() => setPlayerColor('white')}>♔ White</button>
                <button className={`color-select-btn ${playerColor === 'random' ? 'selected' : ''}`} onClick={() => setPlayerColor('random')}>? Random</button>
                <button className={`color-select-btn ${playerColor === 'black' ? 'selected' : ''}`} onClick={() => setPlayerColor('black')}>♚ Black</button>
              </div>
              <button className="btn ai-btn" onClick={() => handleStartGame("ai")}>Start vs AI</button>
            </div>

            <h2>Analysis Mode</h2>
            <button className="btn" style={{background: '#3b82f6'}} onClick={() => handleStartGame("editor")}>Board Editor</button>
            
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>
                Logged in as <strong style={{ color: 'var(--text-main)' }}>{user?.displayName || user?.email?.split('@')[0]}</strong>
              </span>
              <button className="logout-btn" onClick={() => signOut(auth)}>
                Log Out
              </button>
            </div>
          </div>
        </div>
      ) : gameMode === "editor" ? (
        <div className="game-container">
          <div className="sidebar editor-sidebar">
            <h2 className="title-small">Board Editor</h2>
            <div className="editor-controls">
              <p>Select piece, then click square to place.</p>
              <div className="piece-palette">
                {piecesArray.map(p => (
                  <button 
                    key={p.id} 
                    className={`palette-btn ${editorPiece === p.id ? 'selected' : ''}`}
                    onClick={() => setEditorPiece(p.id)}
                  >
                    {p.icon}
                  </button>
                ))}
              </div>
              
              <div className="turn-toggle">
                <label>Side to move: </label>
                <select value={editorTurn} onChange={(e) => handleEditorTurnToggle(e.target.value)}>
                  <option value="w">White</option>
                  <option value="b">Black</option>
                </select>
              </div>

              <div style={{marginTop: '20px'}}>
                <label>FEN String:</label>
                <input 
                  type="text" 
                  value={fen} 
                  onChange={(e) => {
                    setFen(e.target.value);
                    try { chess.load(e.target.value); } catch(e){}
                  }}
                  className="fen-input"
                />
              </div>

              <div className="editor-actions">
                <button className="btn ai-btn" onClick={validateAndPlayEditor}>Play vs AI</button>
                <button className="btn" onClick={() => setGameMode("menu")}>Back to Menu</button>
              </div>
            </div>
          </div>
          <div className="board-wrapper">
            <div className="board-container">
              <Chessboard 
                options={{
                  position: fen,
                  onSquareClick: onEditorSquareClick,
                  onPieceDrop: onEditorPieceDrop,
                  darkSquareStyle: { backgroundColor: "#312e81" },
                  lightSquareStyle: { backgroundColor: "#94a3b8" },
                  animationDurationInMs: 0,
                  allowDragging: true,
                  allowDragOffBoard: true
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="game-container">
          <div className="sidebar">
            <h2>{gameMode === "pvp" ? "Player vs Player" : gameMode === "ai" ? "Player vs AI" : "Online Match"}</h2>
            
            {gameMode === "online" && (
              <div style={{ marginBottom: '1rem', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                 <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>Opponent: <strong style={{ color: '#10b981' }}>{opponentName || "Waiting..."}</strong></p>
                 <p style={{ margin: '8px 0 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>You are playing: <strong style={{ color: playerColor === 'white' ? '#fff' : '#000', textShadow: playerColor === 'black' ? '0 0 2px rgba(255,255,255,0.5)' : 'none', textTransform: 'capitalize' }}>{playerColor}</strong></p>
              </div>
            )}
            
            <div className="clocks-container">
              <div className={`clock ${wasmModule && wasmModule.getTurn() === 1 ? 'active' : ''}`}>
                <span className="clock-label">{gameMode === "ai" ? "AI" : "Black"}</span>
                <span className="clock-time">{formatTime(blackTime)}</span>
              </div>
              <div className={`clock ${wasmModule && wasmModule.getTurn() === 0 ? 'active' : ''}`}>
                <span className="clock-label">{user?.displayName || "Player"} (White)</span>
                <span className="clock-time">{formatTime(whiteTime)}</span>
              </div>
            </div>

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
            <button onClick={handleQuitGame} className="btn back-btn">End Game</button>
          </div>
          <div className="board-wrapper" style={{ position: 'relative' }}>
            {gameState !== 0 && (
              <div className="board-overlay">
                <h2>Game Over</h2>
                <p>{status}</p>
                <button onClick={handleQuitGame} className="btn">Back to Menu</button>
              </div>
            )}
            <div className="board-container">
              <Chessboard 
                options={{
                  position: fen,
                  onPieceDrop: onDrop,
                  onSquareClick: onGameSquareClick,
                  boardOrientation: (gameMode === "ai" || gameMode === "online") ? playerColor : "white",
                  squareStyles: moveFrom ? { [moveFrom]: { backgroundColor: "rgba(14, 165, 233, 0.5)", boxShadow: "inset 0 0 15px rgba(14, 165, 233, 0.8)" } } : {},
                  darkSquareStyle: { backgroundColor: "#312e81" },
                  lightSquareStyle: { backgroundColor: "#94a3b8" },
                  dropSquareStyle: { boxShadow: "inset 0 0 1px 6px rgba(14, 165, 233, 0.5)" },
                  animationDurationInMs: 250,
                  allowDragging: gameState === 0 && !pendingPromotion
                }}
              />
            </div>
          </div>
          
          <div className="history-sidebar">
            <h3 className="history-title">Move History</h3>
            <div className="history-list" ref={historyContainerRef}>
              {movePairs.map((pair, idx) => (
                <div key={idx} className="history-row">
                  <div className="history-number">{idx + 1}.</div>
                  <div className={`history-move ${moveHistory.length - 1 === idx * 2 ? 'active-move' : ''}`}>
                    {formatSan(pair.white.san, 'white-piece')}
                  </div>
                  <div className={`history-move ${moveHistory.length - 1 === idx * 2 + 1 ? 'active-move' : ''}`}>
                    {pair.black ? formatSan(pair.black.san, 'black-piece') : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
