const fs = require('fs');
const code = fs.readFileSync('./frontend/public/chess_module.js', 'utf8');
eval(code);

chess_module().then(mod => {
    mod.initBoard();
    console.log("White pawn e2-e4: ", mod.makeMove(6, 4, 4, 4, 1));
    console.log("FEN:", mod.getBoardState());
    console.log("Black pawn e7-e5: ", mod.makeMove(1, 4, 3, 4, 1));
    console.log("FEN:", mod.getBoardState());
    console.log("White knight g1-f3: ", mod.makeMove(7, 6, 5, 5, 1));
    console.log("FEN:", mod.getBoardState());
});
