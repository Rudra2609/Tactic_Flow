#include <emscripten/bind.h>
#include "AI.h"
#include <string>

using namespace emscripten;

Board globalBoard;
AI globalAI;

void initBoard() {
    globalBoard.setBoard();
}

bool makeMove(int fromX, int fromY, int toX, int toY, int promotion) {
    Move m(fromX, fromY, toX, toY, static_cast<Piece>(promotion));
    return globalBoard.makeMoveAI(m);
}

std::string getBoardState() {
    std::string fen = "";
    for (int i = 0; i < 8; ++i) {
        int emptyCount = 0;
        for (int j = 0; j < 8; ++j) {
            Piece p = globalBoard.board[i][j].getPiece();
            if (p == EMPTY) {
                emptyCount++;
            } else {
                if (emptyCount > 0) {
                    fen += std::to_string(emptyCount);
                    emptyCount = 0;
                }
                Color c = globalBoard.board[i][j].getColor();
                char symbol = '.';
                switch (p) {
                    case KING:   symbol = 'k'; break;
                    case QUEEN:  symbol = 'q'; break;
                    case BISHOP: symbol = 'b'; break;
                    case KNIGHT: symbol = 'n'; break;
                    case ROOK:   symbol = 'r'; break;
                    case PAWN:   symbol = 'p'; break;
                    default: break;
                }
                if (c == WHITE) symbol = toupper(symbol);
                fen += symbol;
            }
        }
        if (emptyCount > 0) {
            fen += std::to_string(emptyCount);
        }
        if (i < 7) fen += "/";
    }
    fen += (globalBoard.getTurn() == WHITE) ? " w - - 0 1" : " b - - 0 1";
    return fen;
}

std::string getBestMove(int elo) {
    globalAI.setElo(elo);
    Move m = globalAI.getBestMove(globalBoard);
    return std::to_string(m.fromX) + "," + std::to_string(m.fromY) + "," + 
           std::to_string(m.toX) + "," + std::to_string(m.toY);
}

int getTurn() {
    return globalBoard.getTurn() == WHITE ? 0 : 1;
}

EMSCRIPTEN_BINDINGS(chess_module) {
    function("initBoard", &initBoard);
    function("makeMove", &makeMove);
    function("getBoardState", &getBoardState);
    function("getBestMove", &getBestMove);
    function("getTurn", &getTurn);
}
