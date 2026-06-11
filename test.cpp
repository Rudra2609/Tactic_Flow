#include <iostream>
#include "Board.h"
#include "Common.h"

int main() {
    Board b;
    Move m(6, 4, 4, 4, QUEEN); // e2 to e4
    bool legal = b.makeMoveAI(m);
    std::cout << "Move e2-e4 legal: " << (legal ? "true" : "false") << std::endl;
    
    if (!legal) {
        std::cout << "turn: " << b.getTurn() << std::endl;
        std::cout << "from piece: " << b.board[6][4].getPiece() << " color: " << b.board[6][4].getColor() << std::endl;
        std::cout << "to piece: " << b.board[4][4].getPiece() << " color: " << b.board[4][4].getColor() << std::endl;
    }
    return 0;
}
