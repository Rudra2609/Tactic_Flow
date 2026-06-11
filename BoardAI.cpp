#include "Board.h"
#include <iostream>

std::vector<Move> Board::getLegalMoves(Color c) {
    std::vector<Move> moves;
    for (int fromX = 0; fromX < 8; ++fromX) {
        for (int fromY = 0; fromY < 8; ++fromY) {
            if (board[fromX][fromY].getColor() == c) {
                for (int toX = 0; toX < 8; ++toX) {
                    for (int toY = 0; toY < 8; ++toY) {
                        if (isValidMoveInternal(fromX, fromY, toX, toY, true)) {
                            if (board[fromX][fromY].getPiece() == PAWN && (toX == 0 || toX == 7)) {
                                moves.push_back(Move(fromX, fromY, toX, toY, QUEEN));
                                moves.push_back(Move(fromX, fromY, toX, toY, ROOK));
                                moves.push_back(Move(fromX, fromY, toX, toY, BISHOP));
                                moves.push_back(Move(fromX, fromY, toX, toY, KNIGHT));
                            } else {
                                moves.push_back(Move(fromX, fromY, toX, toY, EMPTY));
                            }
                        }
                    }
                }
            }
        }
    }
    return moves;
}

bool Board::makeMoveAI(const Move& m) {
    if (!isValidMoveInternal(m.fromX, m.fromY, m.toX, m.toY, true)) {
        return false;
    }

    Square* from = &board[m.fromX][m.fromY];
    Square* to = &board[m.toX][m.toY];
    Piece movingPiece = from->getPiece();
    Color movingColor = from->getColor();
    Piece capturedPiece = to->getPiece();

    std::pair<int, int> previousEnPassantTarget = enPassantTarget;
    enPassantTarget = {-1, -1};

    if (movingPiece == PAWN && to->getPiece() == EMPTY && m.fromY != m.toY) {
        int capturedPawnX = m.fromX;
        int capturedPawnY = m.toY;
        board[capturedPawnX][capturedPawnY].setEmpty();
    }

    if (movingPiece == KING && abs(m.fromY - m.toY) == 2) {
        int rookStartY = (m.toY > m.fromY) ? 7 : 0;
        int rookEndY = (m.toY > m.fromY) ? 5 : 3;

        Square* rookSquare = &board[m.fromX][rookStartY];
        board[m.fromX][rookEndY].setSpace(rookSquare);
        board[m.fromX][rookEndY].setHasMoved(true);
        rookSquare->setEmpty();
    }

    to->setSpace(from);
    to->setHasMoved(true);
    from->setEmpty();

    if (movingPiece == PAWN && abs(m.fromX - m.toX) == 2) {
        int enPassantRow = (m.fromX + m.toX) / 2;
        enPassantTarget = {enPassantRow, m.toY};
    }

    if (movingPiece == PAWN && (m.toX == 0 || m.toX == 7)) {
        to->setPieceAndColor(m.promotion == EMPTY ? QUEEN : m.promotion, movingColor, true);
    }

    // Update castling rights
    if (movingPiece == KING) {
        if (movingColor == WHITE) {
            whiteCanCastleKingside = false;
            whiteCanCastleQueenside = false;
        } else {
            blackCanCastleKingside = false;
            blackCanCastleQueenside = false;
        }
    } else if (movingPiece == ROOK) {
        if (movingColor == WHITE) {
            if (m.fromX == 7 && m.fromY == 7) whiteCanCastleKingside = false;
            if (m.fromX == 7 && m.fromY == 0) whiteCanCastleQueenside = false;
        } else {
            if (m.fromX == 0 && m.fromY == 7) blackCanCastleKingside = false;
            if (m.fromX == 0 && m.fromY == 0) blackCanCastleQueenside = false;
        }
    }
    // Check if captured piece was a rook that hadn't moved, to revoke opponent's castling rights
    if (to->getPiece() == ROOK) {
        if (m.toX == 7 && m.toY == 7) whiteCanCastleKingside = false;
        if (m.toX == 7 && m.toY == 0) whiteCanCastleQueenside = false;
        if (m.toX == 0 && m.toY == 7) blackCanCastleKingside = false;
        if (m.toX == 0 && m.toY == 0) blackCanCastleQueenside = false;
    }

    // Update 50-move rule clock
    if (movingPiece == PAWN || capturedPiece != EMPTY) {
        halfMoveClock = 0;
    } else {
        halfMoveClock++;
    }

    // Update full move number
    if (turn == BLACK) {
        fullMoveNumber++;
    }

    turn = opposite(turn);
    positionHistory.push_back(generatePositionString());
    return true;
}

int Board::evaluate() const {
    int score = 0;
    for (int i = 0; i < 8; ++i) {
        for (int j = 0; j < 8; ++j) {
            Piece p = board[i][j].getPiece();
            Color c = board[i][j].getColor();
            if (p == EMPTY) continue;
            
            int val = 0;
            switch(p) {
                case PAWN: val = 100; break;
                case KNIGHT: val = 300; break;
                case BISHOP: val = 300; break;
                case ROOK: val = 500; break;
                case QUEEN: val = 900; break;
                case KING: val = 9000; break;
                default: break;
            }
            if (p == PAWN) {
                if (c == WHITE) val += (6 - i) * 5;
                else val += (i - 1) * 5;
            } else if (p == KNIGHT) {
                val += ((3 - abs(i - 3)) + (3 - abs(j - 3))) * 2;
            }
            
            if (c == WHITE) score += val;
            else score -= val;
        }
    }
    return score;
}
