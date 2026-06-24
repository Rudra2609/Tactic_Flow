import { useState, useEffect, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { onAuthStateChanged, signOut, updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { ref, set, onValue, update, get, onDisconnect, remove, push } from 'firebase/database';
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
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  const aiWorkerRef = useRef(null);
  const resolveAIMove = useRef(null);

  // Initialize Web Worker for AI
  useEffect(() => {
    aiWorkerRef.current = new Worker(import.meta.env.BASE_URL + 'ai_worker.js');
    aiWorkerRef.current.onmessage = (e) => {
      if (e.data.type === 'result' && resolveAIMove.current) {
        resolveAIMove.current(e.data.move);
        resolveAIMove.current = null;
      }
    };
    return () => {
      if (aiWorkerRef.current) aiWorkerRef.current.terminate();
    };
  }, []);
  const [user, setUser] = useState(null);
  const [gameMode, setGameMode] = useState("menu"); // menu, pvp, ai, editor
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(() => chess.fen());
  const [elo, setElo] = useState(250);
  const [wasmModule, setWasmModule] = useState(null);
  const [status, setStatus] = useState("Waiting to start...");
  const [gameState, setGameState] = useState(0); // 0=playing, 1=checkmate, 2=stalemate, etc., 6=resign, 7=draw agreement
  const gameStateRef = useRef(0);
  const [pendingPromotion, setPendingPromotion] = useState(null);

  // Editor states
  const [editorPiece, setEditorPiece] = useState('wP');
  const [editorTurn, setEditorTurn] = useState('w');

  // Theme state
  const [theme, setTheme] = useState(() => localStorage.getItem('tacticflow-theme') || 'marble');
  const [showSettings, setShowSettings] = useState(false);

  // Display state
  const [showCoordinates, setShowCoordinates] = useState(() => localStorage.getItem('tacticflow-coordinates') !== 'false');
  const [highlightLastMove, setHighlightLastMove] = useState(() => localStorage.getItem('tacticflow-highlight-last') !== 'false');
  const [confirmActions, setConfirmActions] = useState(() => localStorage.getItem('tacticflow-confirm') !== 'false');
  const [pendingPremove, setPendingPremove] = useState(null);

  // Accessibility state
  const [colorblindMode, setColorblindMode] = useState(() => localStorage.getItem('tacticflow-colorblind') === 'true');
  const [pieceSymbols, setPieceSymbols] = useState(() => localStorage.getItem('tacticflow-piece-symbols') === 'true');

  // Account state
  const [editName, setEditName] = useState('');
  const [editNameMode, setEditNameMode] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [verifySent, setVerifySent] = useState(false);

  // Piece set state
  const [pieceSet, setPieceSet] = useState(() => localStorage.getItem('tacticflow-piece-set') || 'standard');

  // Confirm action state
  const [pendingResign, setPendingResign] = useState(false);
  const [pendingEnd, setPendingEnd] = useState(false);

  // Last move tracking
  const [lastMoveFrom, setLastMoveFrom] = useState(null);
  const [lastMoveTo, setLastMoveTo] = useState(null);

  // Time control states
  const [timeControl, setTimeControl] = useState({ minutes: 10, increment: 0 });
  const [whiteTime, setWhiteTime] = useState(600);
  const [blackTime, setBlackTime] = useState(600);
  const historyContainerRef = useRef(null);
  const [moveFrom, setMoveFrom] = useState(null);
  const [playerColor, setPlayerColor] = useState("white");

  // Multiplayer state
  const [roomId, setRoomId] = useState(null);
  const [joinRoomCode, setJoinRoomCode] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [opponentName, setOpponentName] = useState(null);
  const [showLobbyModal, setShowLobbyModal] = useState(false);
  const [showAISetup, setShowAISetup] = useState(false);
  const [showPVPSetup, setShowPVPSetup] = useState(false);
  const [lobbyError, setLobbyError] = useState("");
  const [incomingDrawOffer, setIncomingDrawOffer] = useState(false);
  const [waitingForDrawResponse, setWaitingForDrawResponse] = useState(false);
  const dbRef = useRef(null); // Keep track of current game ref for cleanup
  const isQuitting = useRef(false); // Track if we intentionally quit

  // Tournament states
  const [showTournamentMenu, setShowTournamentMenu] = useState(false);
  const [showCreateTournament, setShowCreateTournament] = useState(false);
  const [activeTournament, setActiveTournament] = useState(null);
  const [tournamentPlayers, setTournamentPlayers] = useState({});
  const [tournamentMatches, setTournamentMatches] = useState({});
  const [activeTournamentMatch, setActiveTournamentMatch] = useState(null);
  const [tournamentCode, setTournamentCode] = useState("");
  const [tournamentJoinCode, setTournamentJoinCode] = useState("");
  const [tournamentError, setTournamentError] = useState("");
  const [createTournamentName, setCreateTournamentName] = useState("");
  const [createTournamentFormat, setCreateTournamentFormat] = useState("single_elimination");
  const [createTournamentMaxPlayers, setCreateTournamentMaxPlayers] = useState("0");
  const [createTournamentScheduled, setCreateTournamentScheduled] = useState(false);
  const [createTournamentScheduleDate, setCreateTournamentScheduleDate] = useState("");
  const tournamentRef = useRef(null);
  const [tournamentMatchRoomId, setTournamentMatchRoomId] = useState(null);

  // Chat states
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [activeTab, setActiveTab] = useState("history"); // "history" or "chat"
  const [unreadChat, setUnreadChat] = useState(false);
  const chatMessagesEndRef = useRef(null);

  // Move history state
  const [moveHistory, setMoveHistory] = useState([]);
  const [viewIndex, setViewIndex] = useState(-1);

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

  useEffect(() => { localStorage.setItem('tacticflow-theme', theme); }, [theme]);

  useEffect(() => { localStorage.setItem('tacticflow-coordinates', showCoordinates); }, [showCoordinates]);
  useEffect(() => { localStorage.setItem('tacticflow-highlight-last', highlightLastMove); }, [highlightLastMove]);
  useEffect(() => { localStorage.setItem('tacticflow-confirm', confirmActions); }, [confirmActions]);
  useEffect(() => { localStorage.setItem('tacticflow-colorblind', colorblindMode); }, [colorblindMode]);
  useEffect(() => { localStorage.setItem('tacticflow-piece-symbols', pieceSymbols); }, [pieceSymbols]);
  useEffect(() => { localStorage.setItem('tacticflow-piece-set', pieceSet); }, [pieceSet]);

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
    isQuitting.current = false;
    const gameRef = ref(db, `games/${code}`);
    dbRef.current = gameRef;
    let hasStarted = false;
    
    const chatRef = ref(db, `games/${code}/chat`);
    onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const msgs = Object.values(data);
        msgs.sort((a, b) => a.timestamp - b.timestamp);
        setChatMessages(msgs);
        
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg && lastMsg.sender !== (user?.displayName || user?.email?.split('@')[0])) {
          setUnreadChat(true);
        }
      } else {
        setChatMessages([]);
      }
    });
    
    onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        if (hasStarted && !isQuitting.current) {
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

        if (data.gameAction) {
          const myRole = isHostLocal ? 'host' : 'guest';
          if (data.gameAction.type === 'resign' && data.gameAction.by !== myRole && gameStateRef.current === 0) {
            setGameState(6);
            gameStateRef.current = 6;
            setStatus("Opponent resigned. You win!");
            setIsTimerRunning(false);
          } else if (data.gameAction.type === 'offer_draw' && data.gameAction.by !== myRole && gameStateRef.current === 0) {
            setIncomingDrawOffer(true);
          } else if (data.gameAction.type === 'accept_draw' && gameStateRef.current === 0) {
            setGameState(7);
            gameStateRef.current = 7;
            setStatus("Draw by mutual agreement.");
            setIsTimerRunning(false);
            setIncomingDrawOffer(false);
            setWaitingForDrawResponse(false);
          } else if (data.gameAction.type === 'decline_draw') {
            setIncomingDrawOffer(false);
            setWaitingForDrawResponse(false);
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

  // Execute premove when it becomes the player's turn
  useEffect(() => {
    if (!pendingPremove || !wasmModule || gameState !== 0 || gameMode !== "online") return;
    const isMyTurn = wasmModule.getTurn() === (playerColor === "white" ? 0 : 1);
    if (isMyTurn) {
      const { fromX, fromY, toX, toY } = pendingPremove;
      setPendingPremove(null);
      executeMove(fromX, fromY, toX, toY, 1);
    }
  }, [incomingMove, wasmModule, gameMode, pendingPremove, gameState, playerColor]);

  // ---- Tournament Functions ----

  const generateTournamentCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const createTournament = async () => {
    if (!createTournamentName.trim()) { setTournamentError("Enter a tournament name"); return; }
    try {
      setTournamentError("");
      const code = generateTournamentCode();
      const tRef = ref(db, `tournaments/${code}`);
      const tournamentData = {
        name: createTournamentName.trim(),
        hostUid: user.uid,
        hostName: user.displayName || user.email.split('@')[0],
        format: createTournamentFormat,
        maxPlayers: parseInt(createTournamentMaxPlayers) || 0,
        timeControl: { minutes: timeControl.minutes, increment: timeControl.increment },
        scheduledAt: createTournamentScheduled && createTournamentScheduleDate ? new Date(createTournamentScheduleDate).getTime() : null,
        status: "waiting",
        inviteCode: code,
        players: { [user.uid]: { name: user.displayName || user.email.split('@')[0], joinedAt: Date.now() } },
        createdAt: Date.now(),
        winner: null
      };
      await set(tRef, tournamentData);
      setTournamentCode(code);
      setShowCreateTournament(false);
      listenToTournament(code);
    } catch (e) {
      console.error(e);
      setTournamentError("Failed to create tournament");
    }
  };

  const joinTournament = async () => {
    if (!tournamentJoinCode.trim()) return;
    try {
      setTournamentError("");
      const code = tournamentJoinCode.toUpperCase();
      const tRef = ref(db, `tournaments/${code}`);
      const snap = await get(tRef);
      if (!snap.exists()) { setTournamentError("Invalid tournament code"); return; }
      const data = snap.val();
      if (data.status !== "waiting") { setTournamentError("Tournament already started"); return; }
      if (data.players[user.uid]) { setTournamentError("Already joined"); return; }
      const playerCount = Object.keys(data.players || {}).length;
      if (data.maxPlayers > 0 && playerCount >= data.maxPlayers) { setTournamentError("Tournament is full"); return; }
      await update(tRef, {
        [`players/${user.uid}`]: { name: user.displayName || user.email.split('@')[0], joinedAt: Date.now() }
      });
      setTournamentCode(code);
      setTournamentJoinCode("");
      listenToTournament(code);
    } catch (e) {
      console.error(e);
      setTournamentError("Failed to join tournament");
    }
  };

  const leaveTournament = async () => {
    if (!tournamentCode) return;
    try {
      const ref_ = ref(db, `tournaments/${tournamentCode}`);
      const snap = await get(ref_);
      if (snap.exists() && snap.val().status === "waiting") {
        await update(ref_, { [`players/${user.uid}`]: null });
      }
      cleanupTournament();
    } catch (e) { console.error(e); }
  };

  const cleanupTournament = () => {
    if (tournamentRef.current) {
      tournamentRef.current();
      tournamentRef.current = null;
    }
    setActiveTournament(null);
    setTournamentPlayers({});
    setTournamentMatches({});
    setTournamentCode("");
    setActiveTournamentMatch(null);
    setShowTournamentMenu(false);
    setTournamentError("");
  };

  const listenToTournament = (code) => {
    const tRef = ref(db, `tournaments/${code}`);
    const unsub = onValue(tRef, (snap) => {
      const data = snap.val();
      if (!data) { cleanupTournament(); return; }
      setActiveTournament(data);
      setTournamentPlayers(data.players || {});
      setTournamentMatches(data.matches || {});
      if (data.status === "in_progress" && data.matches) {
        const myMatch = Object.entries(data.matches).find(([_, m]) =>
          (m.player1 === user.uid || m.player2 === user.uid) && m.status === "playing"
        );
        if (myMatch) {
          setActiveTournamentMatch(myMatch[0]);
          setTournamentMatchRoomId(`tournament_${code}_${myMatch[0]}`);
        }
      }
    });
    tournamentRef.current = unsub;
  };

  const generateBracket = (playerIds, format) => {
    const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
    if (format === "single_elimination") {
      const matches = {};
      let matchId = 1;
      const nextPow2 = Math.pow(2, Math.ceil(Math.log2(shuffled.length)));
      const padded = [...shuffled];
      while (padded.length < nextPow2) padded.push(null);
      for (let i = 0; i < padded.length; i += 2) {
        matches[`m${matchId}`] = {
          round: 1,
          player1: padded[i],
          player2: padded[i + 1],
          winner: null,
          status: padded[i] && padded[i + 1] ? "pending" : "bye",
          roomId: null
        };
        matchId++;
      }
      return matches;
    }
    // round_robin
    const matches = {};
    let matchId = 1;
    for (let i = 0; i < shuffled.length; i++) {
      for (let j = i + 1; j < shuffled.length; j++) {
        matches[`rr${matchId}`] = {
          round: 1,
          player1: shuffled[i],
          player2: shuffled[j],
          winner: null,
          status: "pending",
          roomId: null
        };
        matchId++;
      }
    }
    return matches;
  };

  const startTournament = async () => {
    if (!tournamentCode) return;
    try {
      const playerIds = Object.keys(tournamentPlayers);
      if (playerIds.length < 2) { setTournamentError("Need at least 2 players"); return; }
      const matches = generateBracket(playerIds, activeTournament?.format || "single_elimination");
      await update(ref(db, `tournaments/${tournamentCode}`), {
        status: "in_progress",
        matches
      });
    } catch (e) { console.error(e); setTournamentError("Failed to start tournament"); }
  };

  const playTournamentMatch = async (matchId) => {
    if (!tournamentCode || !activeTournament) return;
    const match = (tournamentMatches || {})[matchId];
    if (!match) return;
    if (match.player1 !== user.uid && match.player2 !== user.uid) return;
    const isPlayer1 = match.player1 === user.uid;
    const matchRoomId = `tournament_${tournamentCode}_${matchId}`;
    setTournamentMatchRoomId(matchRoomId);
    setActiveTournamentMatch(matchId);
    setShowTournamentMenu(false);

    const gameRef = ref(db, `games/${matchRoomId}`);
    const snap = await get(gameRef);
    const roomExists = snap.exists();

    if (!roomExists) {
      // First player: create the room
      await set(gameRef, {
        hostName: user.displayName || user.email.split('@')[0],
        guestName: null,
        status: "waiting",
        lastMove: null
      });
      onDisconnect(gameRef).remove();
      await update(ref(db, `tournaments/${tournamentCode}/matches/${matchId}`), { status: "playing" });
      setPlayerColor("white");
      handleStartGame("online", "white");
      setGameMode("online");
      listenToOnlineRoom(matchRoomId, true, matchId);
    } else {
      // Second player: join existing room
      await update(gameRef, {
        guestName: user.displayName || user.email.split('@')[0],
        status: "playing"
      });
      onDisconnect(gameRef).remove();
      await update(ref(db, `tournaments/${tournamentCode}/matches/${matchId}`), { status: "playing" });
      setPlayerColor("black");
      handleStartGame("online", "black");
      setGameMode("online");
      listenToOnlineRoom(matchRoomId, false, matchId);
    }
  };

  const listenToOnlineRoom = (roomCode, isHostLocal, matchId) => {
    isQuitting.current = false;
    const gameRef = ref(db, `games/${roomCode}`);
    dbRef.current = gameRef;
    let hasStarted = false;

    onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        if (hasStarted && !isQuitting.current) { alert("The Other Player left"); handleEndTournamentMatch(); }
        return;
      }
      setOpponentName(isHostLocal ? data.guestName : data.hostName);
      if (data.status === "waiting") {
        setStatus("Waiting for opponent to join...");
        return;
      }
      if (data.status === "playing") {
        setShowTournamentMenu(false);
        if (!hasStarted) { hasStarted = true; }
        if (data.lastMove) {
          const expectedTurn = isHostLocal ? 1 : 0;
          if (data.lastMove.turn === expectedTurn) setIncomingMove(data.lastMove);
        }
        if (data.gameAction) {
          const myRole = isHostLocal ? 'host' : 'guest';
          if (data.gameAction.type === 'resign' && data.gameAction.by !== myRole && gameStateRef.current === 0) {
            setGameState(6); gameStateRef.current = 6;
            setStatus("Opponent resigned. You win!"); setIsTimerRunning(false);
            reportTournamentMatchResult(matchId, user.uid);
          } else if (data.gameAction.type === 'offer_draw' && data.gameAction.by !== myRole && gameStateRef.current === 0) {
            setIncomingDrawOffer(true);
          } else if (data.gameAction.type === 'accept_draw' && gameStateRef.current === 0) {
            setGameState(7); gameStateRef.current = 7;
            setStatus("Draw by mutual agreement."); setIsTimerRunning(false);
            setIncomingDrawOffer(false); setWaitingForDrawResponse(false);
            reportTournamentMatchResult(matchId, null);
          } else if (data.gameAction.type === 'decline_draw') {
            setIncomingDrawOffer(false); setWaitingForDrawResponse(false);
          }
        }
      }
    });
  };

  const reportTournamentMatchResult = async (matchId, winnerUid) => {
    if (!tournamentCode || !matchId) return;
    try {
      await update(ref(db, `tournaments/${tournamentCode}/matches/${matchId}`), {
        winner: winnerUid,
        status: "finished"
      });
      advanceTournamentBracket(matchId, winnerUid);
    } catch (e) { console.error(e); }
  };

  const advanceTournamentBracket = async (finishedMatchId, winnerUid) => {
    if (!tournamentCode || !activeTournament) return;
    const matches = { ...tournamentMatches };
    const finishedMatch = matches[finishedMatchId];
    if (!finishedMatch) return;

    if (activeTournament.format === "single_elimination") {
      const currentRound = finishedMatch.round;
      const matchIds = Object.keys(matches).filter(k => matches[k].round === currentRound);
      const allFinished = matchIds.every(k => matches[k].status === "finished" || matches[k].status === "bye");
      if (!allFinished) return;

      const nextRound = currentRound + 1;
      const winners = matchIds.map(k => matches[k].winner === null ? matches[k].player1 || matches[k].player2 : matches[k].winner).filter(Boolean);
      if (winners.length <= 1) {
        const champ = winners[0] || null;
        await update(ref(db, `tournaments/${tournamentCode}`), { status: "finished", winner: champ });
        return;
      }
      const nextMatches = {};
      let mid = 1;
      for (let i = 0; i < winners.length; i += 2) {
        nextMatches[`m${nextRound}_${mid}`] = {
          round: nextRound, player1: winners[i], player2: winners[i + 1] || null,
          winner: null, status: winners[i + 1] ? "pending" : "bye", roomId: null
        };
        mid++;
      }
      await update(ref(db, `tournaments/${tournamentCode}/matches`), nextMatches);
    } else {
      // round_robin: just update match status, tournament ends when all matches done
      const allDone = Object.values(matches).every(m => m.status === "finished");
      if (allDone) {
        const standings = {};
        Object.values(matches).forEach(m => {
          if (m.winner) { standings[m.winner] = (standings[m.winner] || 0) + 1; }
        });
        const champ = Object.keys(standings).sort((a, b) => standings[b] - standings[a])[0] || null;
        await update(ref(db, `tournaments/${tournamentCode}`), { status: "finished", winner: champ });
      }
    }
  };

  const handleEndTournamentMatch = () => {
    setIsTimerRunning(false);
    setGameMode("menu");
    setActiveTournamentMatch(null);
    setTournamentMatchRoomId(null);
    setShowTournamentMenu(true);
    setIncomingDrawOffer(false);
    setWaitingForDrawResponse(false);
  };

  // ---- End Tournament Functions ----

  useEffect(() => {
    if (activeTab === "chat") {
      setUnreadChat(false);
      chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, activeTab]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !roomId) return;
    
    const chatRef = ref(db, `games/${roomId}/chat`);
    push(chatRef, {
      sender: user?.displayName || user?.email?.split('@')[0] || "Anonymous",
      text: chatInput.trim(),
      timestamp: Date.now()
    });
    setChatInput("");
  };

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
    setViewIndex(-1);
    setLastMoveFrom(null);
    setLastMoveTo(null);
    setPendingPremove(null);
    setPendingResign(false);
    setPendingEnd(false);
    setGameMode(mode);
    setGameState(0);
    gameStateRef.current = 0;
    setPendingPromotion(null);
    setIncomingDrawOffer(false);
    setWaitingForDrawResponse(false);
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
    if (gameState === 0 && confirmActions && !pendingEnd) {
      setPendingEnd(true);
      return;
    }
    setPendingEnd(false);

    if (tournamentMatchRoomId) {
      handleEndTournamentMatch();
      if (dbRef.current) {
        remove(dbRef.current).catch(e => console.error("Error removing room:", e));
        dbRef.current = null;
      }
      return;
    }

    isQuitting.current = true;
    setIsTimerRunning(false);
    setGameMode("menu");
    setPendingPromotion(null);
    setIncomingDrawOffer(false);
    setWaitingForDrawResponse(false);

    if (dbRef.current) {
      remove(dbRef.current).catch(e => console.error("Error removing room:", e));
      dbRef.current = null;
    }
    setRoomId(null);
    setShowLobbyModal(false);
  };

  const handleResign = () => {
    if (gameState !== 0) return;
    if (confirmActions && !pendingResign) {
      setPendingResign(true);
      return;
    }
    setPendingResign(false);
    setIsTimerRunning(false);
    setGameState(6);
    gameStateRef.current = 6;
    
    if (gameMode === "ai") {
      setStatus("You resigned. AI wins.");
    } else if (gameMode === "pvp") {
      const loser = wasmModule.getTurn() === 0 ? "White" : "Black";
      const winner = wasmModule.getTurn() === 0 ? "Black" : "White";
      setStatus(`${loser} resigned. ${winner} wins.`);
    } else if (gameMode === "online" && dbRef.current) {
      update(dbRef.current, {
        gameAction: { type: 'resign', by: isHost ? 'host' : 'guest', timestamp: Date.now() }
      });
      setStatus("You resigned. Opponent wins.");
    }
  };

  const handleOfferDraw = () => {
    if (gameState !== 0) return;

    if (gameMode === "pvp") {
      setGameState(7);
      gameStateRef.current = 7;
      setStatus("Draw by mutual agreement.");
      setIsTimerRunning(false);
    } else if (gameMode === "online" && dbRef.current) {
      setWaitingForDrawResponse(true);
      update(dbRef.current, {
        gameAction: { type: 'offer_draw', by: isHost ? 'host' : 'guest', timestamp: Date.now() }
      });
    }
  };

  const handleAcceptDraw = () => {
    if (gameMode === "online" && dbRef.current) {
      update(dbRef.current, {
        gameAction: { type: 'accept_draw', timestamp: Date.now() }
      });
    }
    setIncomingDrawOffer(false);
  };

  const handleDeclineDraw = () => {
    if (gameMode === "online" && dbRef.current) {
      update(dbRef.current, {
        gameAction: { type: 'decline_draw', timestamp: Date.now() }
      });
    }
    setIncomingDrawOffer(false);
  };

  const triggerAIMove = async (mod) => {
    try {
      if (mod.getGameState() !== 0) return;
      
      const currentFen = mod.getBoardState();
      const aiMoveStr = await new Promise((resolve) => {
         resolveAIMove.current = resolve;
         if (aiWorkerRef.current) {
             aiWorkerRef.current.postMessage({ type: 'calculate', fen: currentFen, elo });
         } else {
             resolve(mod.getBestMove(elo)); // Fallback
         }
      });
      
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
      const winner = mod.getTurn() === 0 ? user.uid : null;
      setStatus(`Checkmate! ${mod.getTurn() === 0 ? "Black" : "White"} wins!`);
      if (tournamentMatchRoomId && activeTournamentMatch) reportTournamentMatchResult(activeTournamentMatch, winner);
    } else if (state === 2) {
      setStatus("Stalemate! Game is a draw.");
      if (tournamentMatchRoomId && activeTournamentMatch) reportTournamentMatchResult(activeTournamentMatch, null);
    } else if (state === 3) {
      setStatus("Draw by 50-move rule.");
      if (tournamentMatchRoomId && activeTournamentMatch) reportTournamentMatchResult(activeTournamentMatch, null);
    } else if (state === 4) {
      setStatus("Draw by threefold repetition.");
      if (tournamentMatchRoomId && activeTournamentMatch) reportTournamentMatchResult(activeTournamentMatch, null);
    } else if (state === 5) {
      setStatus("Draw by Insufficient Material.");
      if (tournamentMatchRoomId && activeTournamentMatch) reportTournamentMatchResult(activeTournamentMatch, null);
    }
    return state !== 0;
  };

  const executeMove = (fromX, fromY, toX, toY, promotionPiece, isOnlineSync = false) => {
    const activeColorBefore = wasmModule.getTurn();
    const isLegal = wasmModule.makeMove(fromX, fromY, toX, toY, promotionPiece);
    if (isLegal) {
      setFen(wasmModule.getBoardState());
      const fromStr = String.fromCharCode(fromY + 97) + (8 - fromX);
      const toStr = String.fromCharCode(toY + 97) + (8 - toX);
      setLastMoveFrom(fromStr);
      setLastMoveTo(toStr);

      const promoChars = ['', 'q', 'b', 'n', 'r'];
      try {
        chess.move({ from: fromStr, to: toStr, promotion: promoChars[promotionPiece] });
        setMoveHistory([...chess.history({ verbose: true })]);
        setViewIndex(-1);
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
    if (!wasmModule || gameState !== 0 || pendingPromotion || viewIndex !== -1) return false;

    try {
      const fromY = sourceSquare.charCodeAt(0) - 97;
      const fromX = 8 - parseInt(sourceSquare[1]);
      const toY = targetSquare.charCodeAt(0) - 97;
      const toX = 8 - parseInt(targetSquare[1]);

      const isOpponentTurn = wasmModule.getTurn() === (playerColor === "white" ? 1 : 0);
      if ((gameMode === "ai" && isOpponentTurn) ||
          (gameMode === "online" && isOpponentTurn)) {
        if (gameMode === "online" && isOpponentTurn) {
          setPendingPremove({ fromX, fromY, toX, toY });
          return true;
        }
        return false;
      }

      let actualToY = toY;
      const pieceStr = getPieceAt(fen, fromX, fromY);
      
      // Handle castling by dragging King onto Rook
      if (pieceStr && pieceStr.toLowerCase() === 'k') {
        if (fromY === 4 && toY === 7) actualToY = 6; // Kingside
        if (fromY === 4 && toY === 0) actualToY = 2; // Queenside
      }

      if ((pieceStr === 'P' && toX === 0) || (pieceStr === 'p' && toX === 7)) {
        setPendingPromotion({ fromX, fromY, toX, toY: actualToY });
        return true; // Visually keep the piece there until selected
      }

      return executeMove(fromX, fromY, toX, actualToY, 1); // 1 = Queen default
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
    if (gameState !== 0 || !wasmModule || pendingPromotion || viewIndex !== -1) return;
    
    let square = typeof args[0] === 'string' ? args[0] : args[0]?.square;
    if (!square) return;

    const y = square.charCodeAt(0) - 97;
    const x = 8 - parseInt(square[1]);
    const piece = getPieceAt(fen, x, y);

    const isWhiteTurn = wasmModule.getTurn() === 0;
    const isOwnPiece = piece && ((isWhiteTurn && piece >= 'A' && piece <= 'Z') || (!isWhiteTurn && piece >= 'a' && piece <= 'z'));
    const isMyPiece = piece && ((playerColor === 'white' && piece >= 'A' && piece <= 'Z') || (playerColor === 'black' && piece >= 'a' && piece <= 'z'));

    const isOpponentTurn = (gameMode === "online" || gameMode === "ai") &&
      wasmModule.getTurn() === (playerColor === "white" ? 1 : 0);

    if (isOpponentTurn && gameMode === "online") {
      if (!moveFrom) {
        if (isMyPiece) {
          setMoveFrom(square);
        }
      } else {
        if (isMyPiece && moveFrom !== square) {
          setMoveFrom(square);
        } else {
          const fromY = moveFrom.charCodeAt(0) - 97;
          const fromX = 8 - parseInt(moveFrom[1]);
          const toY = square.charCodeAt(0) - 97;
          const toX = 8 - parseInt(square[1]);
          setPendingPremove({ fromX, fromY, toX, toY });
          setMoveFrom(null);
        }
      }
      return;
    }

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

  const validateAndPlayEditor = (mode) => {
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

    const fenParts = fen.split(' ');
    const oppTurn = fenParts[1] === 'w' ? 'b' : 'w';
    const testParts = [...fenParts];
    testParts[1] = oppTurn;
    try {
      const tempChess = new Chess(testParts.join(' '));
      if (tempChess.isCheck()) {
        alert("Invalid position: The side not to move is in check.");
        return;
      }
    } catch(e) {}

    let fullFen = fen;
    if (fenParts.length < 6) fullFen = `${fenParts[0]} ${fenParts[1]} ${fenParts[2] || '-'} ${fenParts[3] || '-'} 0 1`;
    
    const success = wasmModule.setBoardFromFEN(fullFen);
    if (success) {
      chess.load(fullFen);
      setFen(fullFen);
      setMoveHistory([]);
      
      if (mode === "pvp") {
        setGameMode("pvp");
        setGameState(0);
        setStatus(fenParts[1] === 'w' ? "White's turn" : "Black's turn");
      } else {
        setGameMode("ai");
        setGameState(0);
        setElo(3200); // Force optimal AI
        setPlayerColor(fenParts[1] === 'w' ? 'white' : 'black'); // User plays the current turn
        setStatus(fenParts[1] === 'w' ? "White's turn" : "Black's turn");
      }
      setWhiteTime(timeControl.minutes * 60);
      setBlackTime(timeControl.minutes * 60);
      setIsTimerRunning(true);
      // AI Turn already triggered if needed above
    } else {
      alert("WASM Engine rejected the FEN string.");
    }
  };

  const getPieceSrc = (color, type) => {
    if (pieceSet === 'standard') return `pieces/${color}${type}.svg`;
    if (pieceSet === 'unicode') return '';
    return `pieces/${pieceSet}/${color}${type}.svg`;
  };

  const getPieceChar = (color, type) => {
    const chars = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙', k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
    return chars[color === 'w' ? type : type.toLowerCase()] || '';
  };

  const themeBoards = {

    classic:  { light: "#f0d9b5", dark: "#b58863" },
    ebony:    { light: "#e8dcc8", dark: "#696969" },
    marble:   { light: "#e8e0d4", dark: "#8a8a8a" },
    staunton: { light: "#eeeedd", dark: "#7b9c6b" },
  };

  const themeLabels = {

    classic: "Classic",
    ebony: "Ebony & Ivory",
    marble: "Marble",
    staunton: "Staunton",
  };

  const piecesArray = [
    { id: 'wK', icon: <img src={getPieceSrc('w', 'K')} alt="wK" style={{width: '60%', height: '60%'}} /> }, 
    { id: 'wQ', icon: <img src={getPieceSrc('w', 'Q')} alt="wQ" style={{width: '60%', height: '60%'}} /> }, 
    { id: 'wR', icon: <img src={getPieceSrc('w', 'R')} alt="wR" style={{width: '60%', height: '60%'}} /> }, 
    { id: 'wB', icon: <img src={getPieceSrc('w', 'B')} alt="wB" style={{width: '60%', height: '60%'}} /> }, 
    { id: 'wN', icon: <img src={getPieceSrc('w', 'N')} alt="wN" style={{width: '60%', height: '60%'}} /> }, 
    { id: 'wP', icon: <img src={getPieceSrc('w', 'P')} alt="wP" style={{width: '60%', height: '60%'}} /> },
    { id: 'bK', icon: <img src={getPieceSrc('b', 'K')} alt="bK" style={{width: '60%', height: '60%'}} /> }, 
    { id: 'bQ', icon: <img src={getPieceSrc('b', 'Q')} alt="bQ" style={{width: '60%', height: '60%'}} /> }, 
    { id: 'bR', icon: <img src={getPieceSrc('b', 'R')} alt="bR" style={{width: '60%', height: '60%'}} /> }, 
    { id: 'bB', icon: <img src={getPieceSrc('b', 'B')} alt="bB" style={{width: '60%', height: '60%'}} /> }, 
    { id: 'bN', icon: <img src={getPieceSrc('b', 'N')} alt="bN" style={{width: '60%', height: '60%'}} /> }, 
    { id: 'bP', icon: <img src={getPieceSrc('b', 'P')} alt="bP" style={{width: '60%', height: '60%'}} /> },
    { id: 'eraser', icon: '❌' }
  ];

  const pieceSetLabels = { standard: 'Standard', unicode: 'Unicode' };

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
  if (moveHistory.length > 0) {
      for (let i = 0; i < moveHistory.length; i += 2) {
        movePairs.push({
          white: moveHistory[i],
          black: moveHistory[i + 1] || null
        });
      }
    }

    const userName = user?.displayName || user?.email?.split('@')[0];
  const userInitial = userName ? userName[0].toUpperCase() : '?';

  const timePresets = [
    { label: '∞', m: 0, i: 0 },
    { label: '3|2', m: 3, i: 2 },
    { label: '5|3', m: 5, i: 3 },
    { label: '10|0', m: 10, i: 0 },
    { label: '15|10', m: 15, i: 10 },
  ];

  const displayFen = viewIndex === -1 ? fen : (viewIndex === 0 ? (moveHistory.length > 0 ? moveHistory[0].before : fen) : moveHistory[viewIndex - 1].after);

  if (authLoading) return <div className={`app-background theme-${theme}`}><div className="grid-overlay" /><div className="noise-overlay" /><p className="status-text" style={{ position: 'relative', zIndex: 1 }}>Loading...</p></div>;
  if (!user) return <div className={`app-background theme-${theme}`}><div className="grid-overlay" /><div className="noise-overlay" /><Auth onAuthSuccess={() => {}} /></div>;

  return (
    <div className={`app-background theme-${theme}`}>
      <div className="grid-overlay" />
      <div className="noise-overlay" />
      {gameMode === "menu" ? (
        <div className="hero-wrapper">
          <div className="title-section">
            <h1 className="title">Tactic Flow</h1>
            <p className="tagline">Train. Play. Improve.</p>
          </div>

          <div className="game-mode-grid">
            <button className="mode-card" onClick={() => { setShowLobbyModal(false); setShowPVPSetup(true); }}>
              <span className="mode-icon">♟</span>
              <span className="mode-label">Player vs Player</span>
              <span className="mode-desc">Local two-player match</span>
            </button>
            <button className="mode-card" onClick={() => { setShowLobbyModal(false); setShowAISetup(true); }}>
              <span className="mode-icon">🤖</span>
              <span className="mode-label">Play vs AI</span>
              <span className="mode-desc">Challenge the engine</span>
            </button>
            <button className="mode-card" onClick={() => setShowLobbyModal(true)}>
              <span className="mode-icon">🌐</span>
              <span className="mode-label">Play Online</span>
              <span className="mode-desc">Battle a friend</span>
            </button>
            <button className="mode-card" onClick={() => handleStartGame("editor")}>
              <span className="mode-icon">✏️</span>
              <span className="mode-label">Board Editor</span>
              <span className="mode-desc">Custom positions</span>
            </button>
            <button className="mode-card" onClick={() => setShowTournamentMenu(true)}>
              <span className="mode-icon">🏆</span>
              <span className="mode-label">Tournaments</span>
              <span className="mode-desc">Compete in brackets</span>
            </button>
            <button className="mode-card" onClick={() => setShowSettings(true)}>
              <span className="mode-icon">⚙</span>
              <span className="mode-label">Settings</span>
              <span className="mode-desc">Theme & preferences</span>
            </button>
          </div>

          {(showLobbyModal || showAISetup || showPVPSetup || showTournamentMenu || showCreateTournament) && (
            <div className="modal-backdrop" />
          )}

          {showLobbyModal && (
            <div className="lobby-overlay" onClick={() => setShowLobbyModal(false)}>
              <div className="lobby-modal" onClick={e => e.stopPropagation()}>
                <h3>🌐 Play Online</h3>
                {lobbyError && <p className="lobby-error">{lobbyError}</p>}
                {roomId ? (
                  <div className="room-info">
                    <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', margin: '0 0 0.5rem 0' }}>Room Code</p>
                    <p><strong>{roomId}</strong></p>
                    <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem' }}>Waiting for opponent...</p>
                    <button className="btn btn-sm" onClick={() => { if (dbRef.current) remove(dbRef.current); setRoomId(null); }} style={{ marginTop: '0.5rem' }}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <button className="btn btn-sm btn-primary" onClick={createRoom} style={{ width: '100%' }}>Create Game</button>
                    <div style={{ margin: '0.75rem 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <input type="text" placeholder="Enter Room Code" value={joinRoomCode} onChange={(e) => setJoinRoomCode(e.target.value)} className="lobby-input" />
                      <div className="lobby-buttons">
                        <button className="btn btn-sm" onClick={joinRoom} style={{ background: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.3)', flex: 1 }}>Join</button>
                        <button className="btn btn-sm" onClick={() => setShowLobbyModal(false)} style={{ flex: 1 }}>Close</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {showAISetup && (
            <div className="lobby-overlay" onClick={() => setShowAISetup(false)}>
              <div className="lobby-modal" onClick={e => e.stopPropagation()}>
                <h3 style={{ color: '#a78bfa' }}>🤖 Play vs AI</h3>
                <div className="game-settings" style={{ padding: 0, border: 'none', background: 'none' }}>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <span className="settings-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Time</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                      {timePresets.filter(p => p.label !== '∞').map(p => (
                        <button key={p.label} className={`pill-btn ${timeControl.minutes === p.m && timeControl.increment === p.i ? 'active' : ''}`} onClick={() => setTimeControl({ minutes: p.m, increment: p.i })}>{p.label}</button>
                      ))}
                    </div>
                    <button className={`pill-btn ${timeControl.minutes === 0 && timeControl.increment === 0 ? 'active' : ''}`} onClick={() => setTimeControl({ minutes: 0, increment: 0 })} style={{ width: '100%', marginTop: '0.35rem' }}>∞ No limit</button>
                  </div>
                  <div className="settings-row">
                    <span className="settings-label">Color</span>
                    <div className="settings-control">
                      <button className={`pill-btn color-white ${playerColor === 'white' ? 'active' : ''}`} onClick={() => setPlayerColor('white')}>♔ White</button>
                      <button className={`pill-btn color-random ${playerColor === 'random' ? 'active' : ''}`} onClick={() => setPlayerColor('random')}>? Random</button>
                      <button className={`pill-btn color-black ${playerColor === 'black' ? 'active' : ''}`} onClick={() => setPlayerColor('black')}>♚ Black</button>
                    </div>
                  </div>
                  <div className="settings-row elo-section">
                    <div className="elo-header">
                      <span className="settings-label">AI ELO</span>
                      <span className="elo-value">{elo}</span>
                    </div>
                    <input type="range" min="250" max="3200" step="50" value={elo} onChange={(e) => setElo(parseInt(e.target.value))} className="elo-slider" />
                    <div className="elo-labels"><span>Beginner</span><span>Grandmaster</span></div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button className="btn btn-sm btn-primary" onClick={() => { setShowAISetup(false); handleStartGame("ai"); }} style={{ flex: 1 }}>Start</button>
                  <button className="btn btn-sm" onClick={() => setShowAISetup(false)} style={{ flex: 1 }}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {showPVPSetup && (
            <div className="lobby-overlay" onClick={() => setShowPVPSetup(false)}>
              <div className="lobby-modal" onClick={e => e.stopPropagation()}>
                <h3 style={{ color: '#f59e0b' }}>♟ Player vs Player</h3>
                <div className="game-settings" style={{ padding: 0, border: 'none', background: 'none' }}>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <span className="settings-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Time</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                      {timePresets.filter(p => p.label !== '∞').map(p => (
                        <button key={p.label} className={`pill-btn ${timeControl.minutes === p.m && timeControl.increment === p.i ? 'active' : ''}`} onClick={() => setTimeControl({ minutes: p.m, increment: p.i })}>{p.label}</button>
                      ))}
                    </div>
                    <button className={`pill-btn ${timeControl.minutes === 0 && timeControl.increment === 0 ? 'active' : ''}`} onClick={() => setTimeControl({ minutes: 0, increment: 0 })} style={{ width: '100%', marginTop: '0.35rem' }}>∞ No limit</button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button className="btn btn-sm btn-primary" onClick={() => { setShowPVPSetup(false); handleStartGame("pvp"); }} style={{ flex: 1 }}>Start</button>
                  <button className="btn btn-sm" onClick={() => setShowPVPSetup(false)} style={{ flex: 1 }}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {showTournamentMenu && (
            <div className="lobby-overlay" onClick={() => { if (!activeTournament) setShowTournamentMenu(false); }}>
              <div className="lobby-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
                {activeTournament ? (
                  <>
                    <div className="tournament-header">
                      <h3 style={{ margin: 0, color: '#f59e0b' }}>🏆 {activeTournament.name}</h3>
                      <span className={`tournament-status ${activeTournament.status}`}>{activeTournament.status === "waiting" ? "Open" : activeTournament.status === "in_progress" ? "In Progress" : "Finished"}</span>
                    </div>

                    {activeTournament.status === "waiting" && (
                      <div className="tournament-lobby">
                        <div className="tournament-invite">
                          <span className="settings-label">Invite Code</span>
                          <div className="tournament-code-box">{activeTournament.inviteCode}</div>
                        </div>
                        {activeTournament.scheduledAt && (
                          <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', textAlign: 'center', margin: '0.5rem 0' }}>
                            Scheduled: {new Date(activeTournament.scheduledAt).toLocaleString()}
                          </p>
                        )}
                        <div className="tournament-players-list">
                          <div className="tournament-players-header">
                            <span>Players ({Object.keys(tournamentPlayers).length}/{activeTournament.maxPlayers || '∞'})</span>
                          </div>
                          {Object.entries(tournamentPlayers).map(([uid, p]) => (
                            <div key={uid} className="tournament-player-row">
                              <div className="user-avatar" style={{ width: 28, height: 28, fontSize: '0.7rem' }}>{p.name[0].toUpperCase()}</div>
                              <span>{p.name}{uid === user.uid ? ' (You)' : ''}{uid === activeTournament.hostUid ? ' (Host)' : ''}</span>
                            </div>
                          ))}
                        </div>
                        {activeTournament.hostUid === user.uid && (
                          <button className="btn btn-sm btn-primary" onClick={startTournament} style={{ width: '100%', marginTop: '0.75rem' }} disabled={Object.keys(tournamentPlayers).length < 2}>
                            Start Tournament
                          </button>
                        )}
                        <button className="btn btn-sm" onClick={leaveTournament} style={{ width: '100%', marginTop: '0.5rem' }}>Leave Tournament</button>
                      </div>
                    )}

                    {activeTournament.status === "in_progress" && (
                      <div className="tournament-bracket">
                        {activeTournament.format === "single_elimination" ? (
                          <div className="bracket-tree">
                            {[1, 2, 3, 4].map(round => {
                              const roundMatches = Object.entries(tournamentMatches).filter(([_, m]) => m.round === round);
                              if (roundMatches.length === 0) return null;
                              return (
                                <div key={round} className="bracket-round">
                                  <div className="bracket-round-label">Round {round}</div>
                                  {roundMatches.map(([mid, m]) => {
                                    const p1Name = m.player1 ? (tournamentPlayers[m.player1]?.name || 'TBD') : 'Bye';
                                    const p2Name = m.player2 ? (tournamentPlayers[m.player2]?.name || 'TBD') : 'Bye';
                                    const isMyMatch = m.player1 === user.uid || m.player2 === user.uid;
                                    return (
                                      <div key={mid} className={`bracket-match ${m.status} ${isMyMatch ? 'my-match' : ''}`}>
                                        <div className={`bracket-player ${m.winner === m.player1 ? 'winner' : ''}`}>{p1Name}</div>
                                        <div className="bracket-vs">vs</div>
                                        <div className={`bracket-player ${m.winner === m.player2 ? 'winner' : ''}`}>{p2Name}</div>
                                        {m.status === "pending" && isMyMatch && m.player1 && m.player2 && (
                                          <button className="btn btn-sm btn-primary" onClick={() => playTournamentMatch(mid)} style={{ marginTop: '0.35rem', width: '100%' }}>Play</button>
                                        )}
                                        {m.status === "bye" && <span className="bracket-bye">Bye</span>}
                                        {m.status === "finished" && (
                                          <span className="bracket-result">{m.winner ? `${tournamentPlayers[m.winner]?.name || '?'} wins` : 'Draw'}</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="round-robin">
                            {Object.entries(tournamentMatches).map(([mid, m]) => {
                              const p1Name = m.player1 ? (tournamentPlayers[m.player1]?.name || 'TBD') : 'TBD';
                              const p2Name = m.player2 ? (tournamentPlayers[m.player2]?.name || 'TBD') : 'TBD';
                              const isMyMatch = m.player1 === user.uid || m.player2 === user.uid;
                              return (
                                <div key={mid} className={`bracket-match ${m.status} ${isMyMatch ? 'my-match' : ''}`}>
                                  <div className={`bracket-player ${m.winner === m.player1 ? 'winner' : ''}`}>{p1Name}</div>
                                  <div className="bracket-vs">vs</div>
                                  <div className={`bracket-player ${m.winner === m.player2 ? 'winner' : ''}`}>{p2Name}</div>
                                  {m.status === "pending" && isMyMatch && m.player1 && m.player2 && (
                                    <button className="btn btn-sm btn-primary" onClick={() => playTournamentMatch(mid)} style={{ marginTop: '0.35rem', width: '100%' }}>Play</button>
                                  )}
                                  {m.status === "finished" && (
                                    <span className="bracket-result">{m.winner ? `${tournamentPlayers[m.winner]?.name || '?'} wins` : 'Draw'}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <button className="btn btn-sm" onClick={() => setShowTournamentMenu(false)} style={{ width: '100%', marginTop: '0.75rem' }}>Close</button>
                      </div>
                    )}

                    {activeTournament.status === "finished" && (
                      <div className="tournament-finished" style={{ textAlign: 'center', padding: '1rem 0' }}>
                        {activeTournament.winner ? (
                          <>
                            <p style={{ fontSize: '2rem', margin: 0 }}>🏆</p>
                            <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>Winner: {tournamentPlayers[activeTournament.winner]?.name || 'Unknown'}</p>
                          </>
                        ) : (
                          <p style={{ color: 'var(--text-sub)' }}>Tournament ended with no winner</p>
                        )}
                        <button className="btn btn-sm" onClick={() => { cleanupTournament(); setShowTournamentMenu(false); }} style={{ marginTop: '1rem' }}>Close</button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <h3 style={{ color: '#f59e0b', margin: '0 0 1rem 0' }}>🏆 Tournaments</h3>
                    <button className="btn btn-sm btn-primary" onClick={() => setShowCreateTournament(true)} style={{ width: '100%' }}>Create Tournament</button>
                    <div style={{ margin: '0.75rem 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <input type="text" placeholder="Enter Tournament Code" value={tournamentJoinCode} onChange={(e) => setTournamentJoinCode(e.target.value)} className="lobby-input" />
                      <div className="lobby-buttons">
                        <button className="btn btn-sm" onClick={joinTournament} style={{ background: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.3)', flex: 1 }}>Join</button>
                        <button className="btn btn-sm" onClick={() => setShowTournamentMenu(false)} style={{ flex: 1 }}>Close</button>
                      </div>
                    </div>
                    {tournamentError && <p className="lobby-error">{tournamentError}</p>}
                  </>
                )}
              </div>
            </div>
          )}

          {showCreateTournament && (
            <div className="lobby-overlay" onClick={() => setShowCreateTournament(false)}>
              <div className="lobby-modal" onClick={e => e.stopPropagation()}>
                <h3 style={{ color: '#f59e0b', margin: '0 0 1rem 0' }}>🏆 Create Tournament</h3>
                {tournamentError && <p className="lobby-error">{tournamentError}</p>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <span className="settings-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Tournament Name</span>
                    <input type="text" value={createTournamentName} onChange={e => setCreateTournamentName(e.target.value)} placeholder="My Tournament" className="lobby-input" />
                  </div>
                  <div>
                    <span className="settings-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Format</span>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button className={`pill-btn ${createTournamentFormat === 'single_elimination' ? 'active' : ''}`} onClick={() => setCreateTournamentFormat('single_elimination')}>Single Elimination</button>
                      <button className={`pill-btn ${createTournamentFormat === 'round_robin' ? 'active' : ''}`} onClick={() => setCreateTournamentFormat('round_robin')}>Round Robin</button>
                    </div>
                  </div>
                  <div>
                    <span className="settings-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Max Players (0 = no limit)</span>
                    <input type="number" min="0" max="128" value={createTournamentMaxPlayers} onChange={e => setCreateTournamentMaxPlayers(e.target.value)} className="lobby-input" />
                  </div>
                  <div>
                    <span className="settings-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Time Control</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                      {timePresets.filter(p => p.label !== '∞').map(p => (
                        <button key={p.label} className={`pill-btn ${timeControl.minutes === p.m && timeControl.increment === p.i ? 'active' : ''}`} onClick={() => setTimeControl({ minutes: p.m, increment: p.i })}>{p.label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-sub)', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={createTournamentScheduled} onChange={e => setCreateTournamentScheduled(e.target.checked)} />
                      Schedule start time
                    </label>
                    {createTournamentScheduled && (
                      <input type="datetime-local" value={createTournamentScheduleDate} onChange={e => setCreateTournamentScheduleDate(e.target.value)} className="lobby-input" style={{ marginTop: '0.35rem' }} />
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button className="btn btn-sm btn-primary" onClick={createTournament} style={{ flex: 1 }}>Create</button>
                  <button className="btn btn-sm" onClick={() => setShowCreateTournament(false)} style={{ flex: 1 }}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {showSettings && (
            <div className="settings-overlay" onClick={() => { setShowSettings(false); setEditNameMode(false); setNameSaved(false); setShowPasswordChange(false); setOldPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordError(''); setPasswordSuccess(''); setShowForgotPassword(false); setForgotEmail(''); setForgotError(''); setForgotSent(false); setVerifySent(false); setPendingResign(false); setPendingEnd(false); }}>
              <div className="settings-drawer" onClick={(e) => e.stopPropagation()}>
                <div className="settings-header">
                  <h3>Settings</h3>
                  <button className="settings-close-btn" onClick={() => { setShowSettings(false); setEditNameMode(false); setNameSaved(false); setShowPasswordChange(false); setOldPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordError(''); setPasswordSuccess(''); }}>✕</button>
                </div>
                <div className="settings-section">
                  <h4>Display</h4>
                  <div className="settings-toggle-row">
                    <span>Board coordinates</span>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={showCoordinates} onChange={e => setShowCoordinates(e.target.checked)} />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                  <div className="settings-toggle-row">
                    <span>Highlight last move</span>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={highlightLastMove} onChange={e => setHighlightLastMove(e.target.checked)} />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                  <div className="settings-toggle-row">
                    <span>Confirmation dialogs</span>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={confirmActions} onChange={e => setConfirmActions(e.target.checked)} />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                </div>
                <div className="settings-section">
                  <h4>Accessibility</h4>
                  <div className="settings-toggle-row">
                    <span>Colorblind mode</span>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={colorblindMode} onChange={e => setColorblindMode(e.target.checked)} />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                  <div className="settings-toggle-row">
                    <span>Piece symbols</span>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={pieceSymbols} onChange={e => setPieceSymbols(e.target.checked)} />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                </div>
                <div className="settings-section">
                  <h4>Account</h4>
                  {editNameMode ? (
                    <div className="account-edit-row">
                      <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="name-input" placeholder="Enter display name" />
                      <button className="save-btn" onClick={async () => {
                        if (!editName.trim()) return;
                        try {
                          await updateProfile(auth.currentUser, { displayName: editName.trim() });
                          setUser({ ...user, displayName: editName.trim() });
                          setEditNameMode(false);
                          setNameSaved(true);
                          setTimeout(() => setNameSaved(false), 2000);
                        } catch (e) { alert("Failed to update name"); }
                      }}>Save</button>
                      <button className="cancel-btn" onClick={() => { setEditNameMode(false); setEditName(''); }}>Cancel</button>
                    </div>
                  ) : (
                    <div className="account-row">
                      <span className="account-label">Name</span>
                      <span className="account-value">{user?.displayName || 'Not set'}</span>
                      <button className="edit-name-btn" onClick={() => { setEditName(user?.displayName || ''); setEditNameMode(true); setNameSaved(false); }}>Edit</button>
                    </div>
                  )}
                  {nameSaved && <span className="name-saved">Name updated!</span>}
                  <div className="account-row" style={{ marginTop: '0.5rem' }}>
                    <span className="account-label">Email</span>
                    <span className="account-value">{user?.email || ''}</span>
                  </div>
                  <div style={{ marginTop: '0.75rem' }}>
                    {showPasswordChange ? (
                      <div className="password-change-form">
                        <input type="password" value={oldPassword} onChange={e => { setOldPassword(e.target.value); setPasswordError(''); setPasswordSuccess(''); }} className="name-input" placeholder="Current password" style={{ marginBottom: '0.35rem' }} />
                        <input type="password" value={newPassword} onChange={e => { setNewPassword(e.target.value); setPasswordError(''); setPasswordSuccess(''); }} className="name-input" placeholder="New password" style={{ marginBottom: '0.35rem' }} />
                        <input type="password" value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setPasswordError(''); setPasswordSuccess(''); }} className="name-input" placeholder="Confirm new password" style={{ marginBottom: '0.5rem' }} />
                        {passwordError && <span className="password-error">{passwordError}</span>}
                        {passwordSuccess && <span className="password-success">{passwordSuccess}</span>}
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button className="save-btn" onClick={async () => {
                            if (!oldPassword || !newPassword || !confirmPassword) { setPasswordError('All fields required'); return; }
                            if (newPassword.length < 6) { setPasswordError('New password must be at least 6 characters'); return; }
                            if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match'); return; }
                            try {
                              const credential = EmailAuthProvider.credential(auth.currentUser.email, oldPassword);
                              await reauthenticateWithCredential(auth.currentUser, credential);
                              await updatePassword(auth.currentUser, newPassword);
                              setPasswordSuccess('Password updated!');
                              setOldPassword(''); setNewPassword(''); setConfirmPassword('');
                              setTimeout(() => setShowPasswordChange(false), 2000);
                            } catch (e) {
                              if (e.code === 'auth/wrong-password') setPasswordError('Current password is incorrect');
                              else if (e.code === 'auth/weak-password') setPasswordError('Password too weak');
                              else setPasswordError(e.message);
                            }
                          }}>Save</button>
                          <button className="cancel-btn" onClick={() => { setShowPasswordChange(false); setOldPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordError(''); setPasswordSuccess(''); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button className="edit-name-btn" onClick={() => { setShowPasswordChange(true); setPasswordError(''); setPasswordSuccess(''); }}>Change Password</button>
                    )}
                  </div>
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {user && !user.emailVerified && (
                      <div>
                        {verifySent ? (
                          <span className="password-success">Verification email sent! Check your inbox.</span>
                        ) : (
                          <button className="edit-name-btn" onClick={async () => {
                            try {
                              await sendEmailVerification(auth.currentUser);
                              setVerifySent(true);
                            } catch (e) { alert(e.message); }
                          }}>Verify Email</button>
                        )}
                      </div>
                    )}
                    {showForgotPassword ? (
                      <div className="password-change-form">
                        <input type="email" value={forgotEmail} onChange={e => { setForgotEmail(e.target.value); setForgotError(''); setForgotSent(false); }} className="name-input" placeholder="Enter your email" style={{ marginBottom: '0.35rem' }} />
                        {forgotError && <span className="password-error">{forgotError}</span>}
                        {forgotSent && <span className="password-success">Reset email sent! Check your inbox.</span>}
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button className="save-btn" onClick={async () => {
                            if (!forgotEmail.trim()) { setForgotError('Enter your email'); return; }
                            try {
                              await sendPasswordResetEmail(auth, forgotEmail.trim());
                              setForgotSent(true);
                              setForgotError('');
                            } catch (e) { setForgotError(e.message); }
                          }}>Send Reset</button>
                          <button className="cancel-btn" onClick={() => { setShowForgotPassword(false); setForgotEmail(''); setForgotError(''); setForgotSent(false); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button className="edit-name-btn" onClick={() => { setShowForgotPassword(true); setForgotEmail(user?.email || ''); }}>Forgot Password</button>
                    )}
                  </div>
                </div>
                <div className="settings-section">
                  <h4>Piece Style</h4>
                  <div className="piece-set-grid">
                    {Object.entries(pieceSetLabels).map(([key, label]) => (
                      <button key={key} className={`piece-set-card ${pieceSet === key ? 'selected' : ''}`} onClick={() => setPieceSet(key)}>
                        {key === 'unicode' ? <span className="piece-set-preview">♔♚</span> : <span className="piece-set-preview"><img src="pieces/wK.svg" alt="K" style={{height: 28}} /> <img src="pieces/bK.svg" alt="k" style={{height: 28}} /></span>}
                        <span className="piece-set-name">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="settings-section">
                  <h4>Theme</h4>
                  <div className="theme-grid">
                    {Object.entries(themeBoards).map(([key, colors]) => (
                      <button key={key} className={`theme-card ${theme === key ? 'selected' : ''}`} onClick={() => { setTheme(key); }}>
                        <div className="theme-preview">
                          <div className="theme-preview-light" style={{ backgroundColor: colors.light }} />
                          <div className="theme-preview-dark" style={{ backgroundColor: colors.dark }} />
                        </div>
                        <span className="theme-name">{themeLabels[key]}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem' }}>
                  <button className="btn btn-sm" onClick={() => signOut(auth)} style={{ width: '100%', color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)' }}>Log Out</button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : gameMode === "editor" ? (
        <div className="editor-layout">
          <div className="editor-panel">
            <h2 className="title-small" style={{ fontSize: '1.25rem', textAlign: 'center' }}>Board Editor</h2>
            <p style={{ color: 'var(--text-sub)', fontSize: '0.8rem', textAlign: 'center', margin: 0 }}>Select piece, then click square</p>
            <div className="editor-toolbar">
              {piecesArray.map(p => (
                <button
                  key={p.id}
                  className={`editor-piece-btn ${editorPiece === p.id ? 'active' : ''}${p.id === 'eraser' ? ' eraser-btn' : ''}`}
                  onClick={() => setEditorPiece(p.id)}
                >{p.icon}</button>
              ))}
            </div>
            <div className="editor-controls-row">
              <span style={{ color: 'var(--text-sub)', fontSize: '0.8rem', fontWeight: 600 }}>Side to move</span>
              <select className="editor-select" value={editorTurn} onChange={(e) => handleEditorTurnToggle(e.target.value)}>
                <option value="w">White</option>
                <option value="b">Black</option>
              </select>
            </div>
            <div>
              <span style={{ color: 'var(--text-sub)', fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>FEN</span>
              <div className="editor-fen-row">
                <input type="text" value={fen} onChange={(e) => { setFen(e.target.value); try { chess.load(e.target.value); } catch(e){} }} className="fen-input" />
                <button className="editor-icon-btn" onClick={() => navigator.clipboard?.writeText(fen)} title="Copy FEN">📋</button>
              </div>
            </div>
            <button className="btn btn-sm" onClick={() => {
              setElo(3200);
              validateAndPlayEditor("ai");
            }}>Start</button>
            <button className="btn btn-sm" onClick={() => setGameMode("menu")} style={{ width: '100%' }}>← Back to Menu</button>
          </div>
          <div className="board-wrapper">
            <div className="board-frame">
              <div className="board-container">
                <Chessboard
                  options={{
                    position: fen,
                    onSquareClick: onEditorSquareClick,
                    onPieceDrop: onEditorPieceDrop,
                    darkSquareStyle: { backgroundColor: themeBoards[theme].dark },
                    lightSquareStyle: { backgroundColor: themeBoards[theme].light },
                    animationDurationInMs: 0,
                  allowDragging: true,
                  allowDragOffBoard: true
                }}
              />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="game-container">
          <div className="info-panel">
            <div className="info-card">
              <div className="clocks-container">
                <div className={`clock ${wasmModule && wasmModule.getTurn() === (playerColor === 'white' ? 1 : 0) ? 'active' : ''}${(playerColor === 'white' ? blackTime : whiteTime) <= 30 ? ' urgent' : ''}`}>
                  <div className="clock-ring" style={{ background: `conic-gradient(${wasmModule && wasmModule.getTurn() === (playerColor === 'white' ? 1 : 0) ? '#a78bfa' : 'rgba(255,255,255,0.1)'} ${Math.min(100, ((playerColor === 'white' ? blackTime : whiteTime) / (timeControl.minutes * 60 || 1)) * 100)}%, transparent 0)` }}>
                    <div className="clock-ring-inner" />
                    <div className="clock-ring-dot" />
                  </div>
                  <div className="clock-info">
                    <span className="clock-label">{gameMode === "ai" ? "AI" : (opponentName || "Opponent")}</span>
                    <span className="clock-time">{formatTime(playerColor === 'white' ? blackTime : whiteTime)}</span>
                  </div>
                </div>
                <div className={`clock ${wasmModule && wasmModule.getTurn() === (playerColor === 'white' ? 0 : 1) ? 'active' : ''}${(playerColor === 'white' ? whiteTime : blackTime) <= 30 ? ' urgent' : ''}`}>
                  <div className="clock-ring" style={{ background: `conic-gradient(${wasmModule && wasmModule.getTurn() === (playerColor === 'white' ? 0 : 1) ? '#a78bfa' : 'rgba(255,255,255,0.1)'} ${Math.min(100, ((playerColor === 'white' ? whiteTime : blackTime) / (timeControl.minutes * 60 || 1)) * 100)}%, transparent 0)` }}>
                    <div className="clock-ring-inner" />
                    <div className="clock-ring-dot" />
                  </div>
                  <div className="clock-info">
                    <span className="clock-label">{user?.displayName || "Player"}</span>
                    <span className="clock-time">{formatTime(playerColor === 'white' ? whiteTime : blackTime)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={`info-card${gameState !== 0 ? ' game-over' : ''}`}>
              <div className={`status-pill ${gameState !== 0 ? 'game-over' : ''}`}>
                <span className="status-dot" />
                {status}
              </div>
            </div>

            {gameMode === "online" && (
              <div className="info-card">
                <div className="online-info-row">
                  <span className="online-info-label">Opponent</span>
                  <span className="online-info-value">{opponentName || "Waiting..."}</span>
                </div>
                <div className="online-info-row">
                  <span className="online-info-label">Playing as</span>
                  <span className="online-info-value" style={{ textTransform: 'capitalize' }}>{playerColor}</span>
                </div>
              </div>
            )}

            {gameState === 0 && (
              <div className="info-card" style={{ padding: '0.65rem 1rem' }}>
                <div className="floating-actions">
                  {gameMode !== "ai" && !waitingForDrawResponse && (
                    <button onClick={handleOfferDraw} className="floating-action-btn draw-action" disabled={waitingForDrawResponse}>
                      🤝 Draw
                    </button>
                  )}
                  {waitingForDrawResponse && (
                    <button className="floating-action-btn" disabled style={{ opacity: 0.6 }}>⏳ Waiting...</button>
                  )}
                  <button onClick={handleResign} className="floating-action-btn resign-action">🏳️ Resign</button>
                  <button onClick={handleQuitGame} className="floating-action-btn end-action">✕ End</button>
                </div>
              </div>
            )}

            {incomingDrawOffer && (
              <div className="info-card" style={{ padding: '0.65rem 1rem' }}>
                <div className="draw-offer-toast">
                  <p>Opponent offered a draw</p>
                  <div className="draw-offer-buttons">
                    <button onClick={handleAcceptDraw} className="draw-offer-btn accept-btn">Accept</button>
                    <button onClick={handleDeclineDraw} className="draw-offer-btn decline-btn">Decline</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="board-wrapper" style={{ position: 'relative' }}>
            {gameState !== 0 && (
              <div className="board-overlay">
                <div className="result-icon">{gameState === 1 ? '🏆' : '🤝'}</div>
                <h2>{gameState === 1 ? 'Checkmate!' : 'Game Over'}</h2>
                <p>{status}</p>
                <button onClick={handleQuitGame} className="btn btn-sm">Back to Menu</button>
              </div>
            )}
            <div className={`board-frame${colorblindMode ? ' colorblind-mode' : ''}${pieceSymbols ? ' piece-symbols' : ''}`}>
              <div className="board-container">
                <Chessboard
                  options={{
                    position: displayFen,
                    onPieceDrop: onDrop,
                    onSquareClick: onGameSquareClick,
                    boardOrientation: (gameMode === "ai" || gameMode === "online") ? playerColor : "white",
                    squareStyles: {
                      ...(moveFrom ? { [moveFrom]: { backgroundColor: "rgba(14, 165, 233, 0.5)", boxShadow: "inset 0 0 15px rgba(14, 165, 233, 0.8)" } } : {}),
                      ...(highlightLastMove && lastMoveFrom ? { [lastMoveFrom]: { backgroundColor: "rgba(255, 255, 0, 0.2)", boxShadow: "inset 0 0 10px rgba(255, 255, 0, 0.3)" } } : {}),
                      ...(highlightLastMove && lastMoveTo ? { [lastMoveTo]: { backgroundColor: "rgba(255, 255, 0, 0.2)", boxShadow: "inset 0 0 10px rgba(255, 255, 0, 0.3)" } } : {})
                    },
                    showBoardNotation: showCoordinates,
                    darkSquareStyle: { backgroundColor: themeBoards[theme].dark },
                    lightSquareStyle: { backgroundColor: themeBoards[theme].light },
                    dropSquareStyle: { boxShadow: "inset 0 0 1px 6px rgba(14, 165, 233, 0.5)" },
                    animationDurationInMs: 250,
                    allowDragging: gameState === 0 && !pendingPromotion
                  }}
                />
              </div>
            </div>
            {pendingPromotion && (() => {
              const pColor = wasmModule.getTurn() === 0 ? 'w' : 'b';
              const promoY = wasmModule.getTurn() === 0 ? -60 : 220;
              return (
                <div className="promotion-popover" style={{ bottom: promoY + 'px', left: '50%', transform: 'translateX(-50%)' }}>
                  <div className="promotion-popover-row">
                    <button className="promotion-piece-btn" onClick={() => handlePromotionSelection(1)}>{pieceSet === 'unicode' ? <span style={{fontSize:'1.8rem'}}>{getPieceChar(pColor, 'Q')}</span> : <img src={getPieceSrc(pColor, 'Q')} alt="Queen" />}</button>
                    <button className="promotion-piece-btn" onClick={() => handlePromotionSelection(4)}>{pieceSet === 'unicode' ? <span style={{fontSize:'1.8rem'}}>{getPieceChar(pColor, 'R')}</span> : <img src={getPieceSrc(pColor, 'R')} alt="Rook" />}</button>
                    <button className="promotion-piece-btn" onClick={() => handlePromotionSelection(2)}>{pieceSet === 'unicode' ? <span style={{fontSize:'1.8rem'}}>{getPieceChar(pColor, 'B')}</span> : <img src={getPieceSrc(pColor, 'B')} alt="Bishop" />}</button>
                    <button className="promotion-piece-btn" onClick={() => handlePromotionSelection(3)}>{pieceSet === 'unicode' ? <span style={{fontSize:'1.8rem'}}>{getPieceChar(pColor, 'N')}</span> : <img src={getPieceSrc(pColor, 'N')} alt="Knight" />}</button>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="history-sidebar">
            {gameMode === "online" ? (
              <div className="sidebar-tabs">
                <button className={`tab-btn ${activeTab === "history" ? "active" : ""}`} onClick={() => setActiveTab("history")}>Move History</button>
                <button className={`tab-btn ${activeTab === "chat" ? "active" : ""}`} onClick={() => { setActiveTab("chat"); setUnreadChat(false); }}>
                  Live Chat {activeTab !== "chat" && unreadChat && <span className="unread-dot" />}
                </button>
              </div>
            ) : (
              <h3 className="history-title">Move History</h3>
            )}

            {activeTab === "history" ? (
              <>
                <div className="history-list" ref={historyContainerRef}>
                {movePairs.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-sub)', fontSize: '0.85rem', padding: '1rem 0' }}>No moves yet</div>}
                {movePairs.map((pair, idx) => {
                  const whiteIdx = idx * 2;
                  const blackIdx = idx * 2 + 1;
                  const currentIdx = viewIndex === -1 ? moveHistory.length - 1 : viewIndex - 1;
                  return (
                    <div key={idx} className="history-row">
                      <span className="history-number">{idx + 1}.</span>
                      <span className={`history-move ${currentIdx === whiteIdx ? 'active-move' : ''}`} onClick={() => setViewIndex(whiteIdx + 1)}>
                        {formatSan(pair.white.san, 'white-piece')}
                      </span>
                      <span className={`history-move ${currentIdx === blackIdx ? 'active-move' : ''}`} onClick={() => pair.black && setViewIndex(blackIdx + 1)}>
                        {pair.black ? formatSan(pair.black.san, 'black-piece') : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="history-controls">
                <button className="history-btn" onClick={() => setViewIndex(0)} disabled={viewIndex === 0 || moveHistory.length === 0}>&lt;&lt;</button>
                <button className="history-btn" onClick={() => setViewIndex(prev => (prev === -1 ? Math.max(0, moveHistory.length - 1) : Math.max(0, prev - 1)))} disabled={viewIndex === 0 || moveHistory.length === 0}>&lt;</button>
                <button className="history-btn" onClick={() => { setViewIndex(prev => { if (prev === -1) return -1; if (prev + 1 >= moveHistory.length) return -1; return prev + 1; }); }} disabled={viewIndex === -1 || moveHistory.length === 0}>&gt;</button>
                <button className="history-btn" onClick={() => setViewIndex(-1)} disabled={viewIndex === -1 || moveHistory.length === 0}>&gt;&gt;</button>
              </div>
              </>
            ) : (
              <div className="chat-container">
                <div className="chat-messages">
                  {chatMessages.length === 0 ? (
                    <div className="chat-empty">Say hi to your friend!</div>
                  ) : (
                    chatMessages.map((msg, idx) => {
                      const isMe = msg.sender === (user?.displayName || user?.email?.split('@')[0]);
                      return (
                        <div key={idx} className={`chat-message ${isMe ? 'message-mine' : 'message-theirs'}`}>
                          <span className="chat-sender">{isMe ? "You" : msg.sender}</span>
                          <div className="chat-bubble">{msg.text}</div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatMessagesEndRef} />
                </div>
                <form className="chat-input-form" onSubmit={handleSendMessage}>
                  <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type a message..." className="chat-input" />
                  <button type="submit" className="chat-send-btn">Send</button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {(pendingResign || pendingEnd) && (
        <div className="confirm-overlay" onClick={() => { setPendingResign(false); setPendingEnd(false); }}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>{pendingResign ? 'Resign?' : 'End game?'}</h3>
            <p>{pendingResign ? 'Are you sure you want to resign?' : 'Are you sure you want to end the game?'}</p>
            <div className="confirm-dialog-buttons">
              <button className="btn btn-sm confirm-yes" onClick={pendingResign ? handleResign : handleQuitGame}>Yes</button>
              <button className="btn btn-sm confirm-no" onClick={() => { setPendingResign(false); setPendingEnd(false); }}>No</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
