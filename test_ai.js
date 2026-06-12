const chess_module = require('./frontend/public/chess_module.js');

async function run() {
    const mod = await chess_module();
    mod.initBoard();
    const fen = "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1";
    console.log("Setting FEN:", fen);
    const success = mod.setBoardFromFEN(fen);
    console.log("Success:", success);
    console.log("Current state:", mod.getBoardState());
    console.log("Getting best move...");
    const move = mod.getBestMove(250);
    console.log("Best move:", move);
}

run().catch(console.error);
