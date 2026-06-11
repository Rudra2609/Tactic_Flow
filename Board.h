#ifndef BOARD_H
#define BOARD_H

#include "Square.h"
#include <utility>
#include <vector>

class Board {
public:
    Square board[8][8];
private:
    Color turn;
    std::pair<int, int> enPassantTarget;
    
    int halfMoveClock;
    int fullMoveNumber;
    bool whiteCanCastleKingside;
    bool whiteCanCastleQueenside;
    bool blackCanCastleKingside;
    bool blackCanCastleQueenside;
    std::vector<std::string> positionHistory;

    Color opposite(Color c) const;
    bool isPathClear(int fromX, int fromY, int toX, int toY) const;
    bool isSquareUnderAttack(int x, int y, Color attackerColor);
    bool isValidMoveInternal(int fromX, int fromY, int toX, int toY, bool checkCheckConstraints);
    bool isValidPawnMove(int fromX, int fromY, int toX, int toY);
    bool isValidCastling(int fromX, int fromY, int toX, int toY, bool checkCheckConstraints);
    void promotePawn(int x, int y);

public:
    Board();
    void setBoard();
    bool setBoardFromFEN(const std::string& fen);
    std::string generatePositionString() const;
    void printBoard() const;
    bool makeMove(int fromX, int fromY, int toX, int toY);
    bool makeMoveAI(const Move& m);
    std::vector<Move> getLegalMoves(Color c);
    int evaluate() const;
    bool isInCheck(Color kingColor);
    bool isCheckmate(Color kingColor);
    bool isStalemate(Color playerColor);
    bool isDrawByFiftyMoveRule() const;
    bool isDrawByRepetition() const;
    bool isInsufficientMaterial() const;
    bool hasMatingMaterial(Color c) const;
    int getGameState(); 
    Color getTurn() const { return turn; }
    
    int getHalfMoveClock() const { return halfMoveClock; }
    int getFullMoveNumber() const { return fullMoveNumber; }
    std::pair<int, int> getEnPassantTarget() const { return enPassantTarget; }
    bool getWhiteCanCastleKingside() const { return whiteCanCastleKingside; }
    bool getWhiteCanCastleQueenside() const { return whiteCanCastleQueenside; }
    bool getBlackCanCastleKingside() const { return blackCanCastleKingside; }
    bool getBlackCanCastleQueenside() const { return blackCanCastleQueenside; }
};

#endif
