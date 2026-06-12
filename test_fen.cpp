#include "AI.h"
#include <iostream>

int main() {
    Board b;
    std::string fen = "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1";
    std::cout << "Setting FEN..." << std::endl;
    bool success = b.setBoardFromFEN(fen);
    std::cout << "Success: " << success << std::endl;
    std::cout << "Getting best move..." << std::endl;
    AI ai(250);
    Move m = ai.getBestMove(b);
    std::cout << "Best move: " << m.fromX << "," << m.fromY << " -> " << m.toX << "," << m.toY << std::endl;
    return 0;
}
