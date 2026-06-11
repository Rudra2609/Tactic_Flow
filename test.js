const fs = require('fs');
const code = fs.readFileSync('./frontend/public/chess_module.js', 'utf8');
eval(code);

chess_module().then(mod => {
    mod.initBoard();
    console.log("Initial FEN:", mod.getBoardState());
    const isLegal = mod.makeMove(6, 4, 4, 4, 1);
    console.log("Move Legal:", isLegal);
    console.log("After move FEN:", mod.getBoardState());
});
