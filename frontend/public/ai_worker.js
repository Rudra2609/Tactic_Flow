importScripts('chess_module.js');

let wasmModule = null;

chess_module().then(mod => {
    wasmModule = mod;
    postMessage({ type: 'ready' });
});

onmessage = function(e) {
    if (!wasmModule) {
        // If not ready yet, wait a bit and retry
        setTimeout(() => {
            onmessage(e);
        }, 100);
        return;
    }
    
    if (e.data.type === 'calculate') {
        const { fen, elo } = e.data;
        wasmModule.setBoardFromFEN(fen);
        const aiMoveStr = wasmModule.getBestMove(elo);
        postMessage({ type: 'result', move: aiMoveStr });
    }
};
