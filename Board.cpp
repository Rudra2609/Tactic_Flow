#include "Board.h"
#include <iostream>
#include <cmath>
#include <sstream>
#include <cctype>

Color Board::opposite(Color c) const {
    return (c == WHITE) ? BLACK : WHITE;
}

bool Board::isPathClear(int fromX, int fromY, int toX, int toY) const {
    int dx = (toX > fromX) ? 1 : (toX < fromX) ? -1 : 0;
    int dy = (toY > fromY) ? 1 : (toY < fromY) ? -1 : 0;

    int x = fromX + dx;
    int y = fromY + dy;

    while (x != toX || y != toY) {
        if (x < 0 || x > 7 || y < 0 || y > 7) return false;
        if (board[x][y].getPiece() != EMPTY) {
            return false;
        }
        x += dx;
        y += dy;
    }
    return true;
}

bool Board::isSquareUnderAttack(int x, int y, Color attackerColor) {
    Color targetColor = opposite(attackerColor);
    Color originalTurn = turn;
    turn = attackerColor;

    for (int i = 0; i < 8; ++i) {
        for (int j = 0; j < 8; ++j) {
            if (board[i][j].getColor() == attackerColor) {
                if (isValidMoveInternal(i, j, x, y, false)) {
                    turn = originalTurn;
                    return true;
                }
            }
        }
    }
    turn = originalTurn;
    return false;
}

bool Board::isValidMoveInternal(int fromX, int fromY, int toX, int toY, bool checkCheckConstraints) {
    if (fromX < 0 || fromX > 7 || fromY < 0 || fromY > 7 ||
        toX < 0 || toX > 7 || toY < 0 || toY > 7) {
        return false;
    }

    Square* from = &board[fromX][fromY];
    Square* to = &board[toX][toY];

    if (from->getPiece() == EMPTY || (checkCheckConstraints && from->getColor() != turn) ) {
        return false;
    }

    if (to->getColor() == from->getColor() && to->getPiece() != EMPTY) {
       return false;
    }

    int dx_abs = abs(toX - fromX);
    int dy_abs = abs(toY - fromY);
    bool basicMoveValid = false;

    switch(from->getPiece()) {
        case PAWN:
            basicMoveValid = isValidPawnMove(fromX, fromY, toX, toY);
            break;
        case KNIGHT:
            basicMoveValid = (dx_abs == 2 && dy_abs == 1) || (dx_abs == 1 && dy_abs == 2);
            break;
        case BISHOP:
            if (dx_abs == dy_abs) {
                basicMoveValid = isPathClear(fromX, fromY, toX, toY);
            }
            break;
        case ROOK:
            if (dx_abs == 0 || dy_abs == 0) {
                basicMoveValid = isPathClear(fromX, fromY, toX, toY);
            }
            break;
        case QUEEN:
            if (dx_abs == dy_abs || dx_abs == 0 || dy_abs == 0) {
                basicMoveValid = isPathClear(fromX, fromY, toX, toY);
            }
            break;
        case KING:
            if (dx_abs <= 1 && dy_abs <= 1) {
                basicMoveValid = true;
            }
            else if (dx_abs == 0 && dy_abs == 2 && !from->getHasMoved()) {
                basicMoveValid = isValidCastling(fromX, fromY, toX, toY, checkCheckConstraints);
            }
            break;
        case EMPTY:
        default:
            basicMoveValid = false;
            break;
    }

    if (!basicMoveValid) {
        return false;
    }

    if (checkCheckConstraints) {
        Square tempFrom = *from;
        Square tempTo = *to;
        Piece capturedPiece = to->getPiece();
        Color capturedColor = to->getColor();
        bool capturedHasMoved = to->getHasMoved();
        std::pair<int, int> tempEnPassantTarget = enPassantTarget;
        Square enPassantCapturedSquare;
        bool didEnPassantSim = false;
        int enPassantCaptureSimX = -1, enPassantCaptureSimY = -1;

         if (from->getPiece() == PAWN && to->getPiece() == EMPTY && fromY != toY &&
            enPassantTarget.first == toX && enPassantTarget.second == toY)
         {
             int direction = (from->getColor() == WHITE) ? -1 : 1;
             enPassantCaptureSimX = toX - direction;
             enPassantCaptureSimY = toY;

             if (enPassantCaptureSimX >= 0 && enPassantCaptureSimX < 8 &&
                 board[enPassantCaptureSimX][enPassantCaptureSimY].getPiece() == PAWN &&
                 board[enPassantCaptureSimX][enPassantCaptureSimY].getColor() == opposite(turn))
             {
                 enPassantCapturedSquare = board[enPassantCaptureSimX][enPassantCaptureSimY];
                 board[enPassantCaptureSimX][enPassantCaptureSimY].setEmpty();
                 didEnPassantSim = true;
             }
        }

        to->setSpace(from);
        to->setHasMoved(true);
        from->setEmpty();

        bool didCastleSim = false;
        int castleRookSimFromY = -1, castleRookSimToY = -1;
        Square tempRookFrom, tempRookTo;
        if (tempFrom.getPiece() == KING && dy_abs == 2) {
            castleRookSimFromY = (toY > fromY) ? 7 : 0;
            castleRookSimToY = (toY > fromY) ? 5 : 3;
            if(board[fromX][castleRookSimFromY].getPiece() == ROOK){
                tempRookFrom = board[fromX][castleRookSimFromY];
                tempRookTo = board[fromX][castleRookSimToY];
                board[fromX][castleRookSimToY].setSpace(&board[fromX][castleRookSimFromY]);
                board[fromX][castleRookSimToY].setHasMoved(true);
                board[fromX][castleRookSimFromY].setEmpty();
                didCastleSim = true;
            }
        }

        bool leavesKingInCheck = isInCheck(turn);

        from->setPieceAndColor(tempFrom.getPiece(), tempFrom.getColor(), tempFrom.getHasMoved());
        to->setPieceAndColor(capturedPiece, capturedColor, capturedHasMoved);
        enPassantTarget = tempEnPassantTarget;

        if (didEnPassantSim) {
             board[enPassantCaptureSimX][enPassantCaptureSimY] = enPassantCapturedSquare;
        }
        if (didCastleSim) {
            board[fromX][castleRookSimFromY] = tempRookFrom;
            board[fromX][castleRookSimToY] = tempRookTo;
        }

        if (leavesKingInCheck) {
            return false;
        }
    }

    return true;
}

bool Board::isValidPawnMove(int fromX, int fromY, int toX, int toY) {
    Square* from = &board[fromX][fromY];
    Square* to = &board[toX][toY];
    Color pawnColor = from->getColor();
    int direction = (pawnColor == WHITE) ? -1 : 1;

    if (fromY == toY && toX == fromX + direction && to->getPiece() == EMPTY) {
        return true;
    }

    bool startRank = (pawnColor == WHITE && fromX == 6) || (pawnColor == BLACK && fromX == 1);
    if (startRank && fromY == toY && toX == fromX + 2 * direction &&
        to->getPiece() == EMPTY && board[fromX + direction][fromY].getPiece() == EMPTY) {
        return true;
    }

    if (abs(fromY - toY) == 1 && toX == fromX + direction &&
        to->getPiece() != EMPTY && to->getColor() != pawnColor) {
        return true;
    }

    if (abs(fromY - toY) == 1 && toX == fromX + direction &&
        to->getPiece() == EMPTY &&
        enPassantTarget.first == toX && enPassantTarget.second == toY)
    {
        int capturedPawnX = toX - direction;
        int capturedPawnY = toY;
        if(capturedPawnX >= 0 && capturedPawnX < 8 &&
           board[capturedPawnX][capturedPawnY].getPiece() == PAWN &&
           board[capturedPawnX][capturedPawnY].getColor() == opposite(pawnColor))
        {
           return true;
        }
    }

    return false;
}

bool Board::isValidCastling(int fromX, int fromY, int toX, int toY, bool checkCheckConstraints) {
    if (abs(fromY - toY) != 2 || fromX != toX) return false;
    if (board[fromX][fromY].getHasMoved()) return false;

    Color kingColor = board[fromX][fromY].getColor();

    if (kingColor == WHITE) {
        if (toY > fromY && !whiteCanCastleKingside) return false;
        if (toY < fromY && !whiteCanCastleQueenside) return false;
    } else {
        if (toY > fromY && !blackCanCastleKingside) return false;
        if (toY < fromY && !blackCanCastleQueenside) return false;
    }

    if (checkCheckConstraints && isInCheck(kingColor)) {
         return false;
    }

    int rookY = (toY > fromY) ? 7 : 0;
    if (rookY < 0 || rookY > 7) return false;
    Square* rook = &board[fromX][rookY];
    if (rook->getPiece() != ROOK || rook->getColor() != kingColor || rook->getHasMoved()) {
        return false;
    }

    int step = (rookY > fromY) ? 1 : -1;
    for (int y = fromY + step; y != rookY; y += step) {
        if (board[fromX][y].getPiece() != EMPTY) {
             return false;
        }
    }

    if(checkCheckConstraints) {
        int kingStep = (toY > fromY) ? 1 : -1;
        if (isSquareUnderAttack(fromX, fromY + kingStep, opposite(kingColor))) {
             return false;
        }
         if (isSquareUnderAttack(toX, toY, opposite(kingColor))) {
              return false;
         }
    }

    return true;
}

void Board::promotePawn(int x, int y) {
    Piece newPiece = QUEEN;
    Color pawnColor = board[x][y].getColor();
    std::cout << "Pawn promotion! Choose piece (Q=Queen[default], R=Rook, B=Bishop, N=Knight): ";
    char choice;

    std::string line;
    if (std::getline(std::cin, line) && !line.empty()) {
         choice = line[0];
    } else {
         choice = 'Q';
         if (std::cin.fail()) {
              std::cin.clear();
         }
    }

    switch (toupper(choice)) {
        case 'R': newPiece = ROOK; break;
        case 'B': newPiece = BISHOP; break;
        case 'N': newPiece = KNIGHT; break;
        case 'Q':
        default:
            if (toupper(choice) != 'Q') {
                std::cout << "Invalid choice '" << choice << "', promoting to Queen." << std::endl;
            }
            newPiece = QUEEN;
    }
    board[x][y].setPieceAndColor(newPiece, pawnColor, true);
    char symbol;
    switch (newPiece) {
         case QUEEN: symbol = 'Q'; break;
         case ROOK: symbol = 'R'; break;
         case BISHOP: symbol = 'B'; break;
         case KNIGHT: symbol = 'N'; break;
         default: symbol = '?';
    }
    std::cout << (pawnColor == WHITE ? "White" : "Black") << " promoted pawn to " << symbol << std::endl;
}

bool Board::isInCheck(Color kingColor) {
    int kingX = -1, kingY = -1;
    for (int x = 0; x < 8; ++x) {
        for (int y = 0; y < 8; ++y) {
            if (board[x][y].getPiece() == KING && board[x][y].getColor() == kingColor) {
                kingX = x;
                kingY = y;
                break;
            }
        }
        if (kingX != -1) break;
    }

    if (kingX == -1) {
         std::cerr << "Error: King of color " << (kingColor == WHITE ? "WHITE" : "BLACK") << " not found!" << std::endl;
         return false;
    }

    return isSquareUnderAttack(kingX, kingY, opposite(kingColor));
}

bool Board::isCheckmate(Color kingColor) {
    if (!isInCheck(kingColor)) {
        return false;
    }

    Color originalTurn = turn;
    turn = kingColor;

    for (int fromX = 0; fromX < 8; ++fromX) {
        for (int fromY = 0; fromY < 8; ++fromY) {
            if (board[fromX][fromY].getColor() == kingColor) {
                for (int toX = 0; toX < 8; ++toX) {
                    for (int toY = 0; toY < 8; ++toY) {
                        if (isValidMoveInternal(fromX, fromY, toX, toY, true)) {
                            turn = originalTurn;
                            return false;
                        }
                    }
                }
            }
        }
    }

    turn = originalTurn;
    return true;
}

bool Board::isStalemate(Color playerColor) {
    if (isInCheck(playerColor)) {
        return false;
    }

    Color originalTurn = turn;
    turn = playerColor;

    for (int fromX = 0; fromX < 8; ++fromX) {
        for (int fromY = 0; fromY < 8; ++fromY) {
            if (board[fromX][fromY].getColor() == playerColor) {
                for (int toX = 0; toX < 8; ++toX) {
                    for (int toY = 0; toY < 8; ++toY) {
                        if (isValidMoveInternal(fromX, fromY, toX, toY, true)) {
                            turn = originalTurn;
                            return false;
                        }
                    }
                }
            }
        }
    }

    turn = originalTurn;
    return true;
}

bool Board::setBoardFromFEN(const std::string& fen) {
    std::istringstream iss(fen);
    std::string boardPart, activeColorPart, castlingPart, enPassantPart, halfMovePart, fullMovePart;
    iss >> boardPart >> activeColorPart >> castlingPart >> enPassantPart >> halfMovePart >> fullMovePart;

    if (boardPart.empty()) return false;

    // Clear board
    for (int i = 0; i < 8; ++i) {
        for (int j = 0; j < 8; ++j) {
            board[i][j].setPieceAndColor(EMPTY, NONE);
        }
    }

    int row = 0, col = 0;
    for (char c : boardPart) {
        if (c == '/') {
            row++;
            col = 0;
        } else if (isdigit(c)) {
            col += (c - '0');
        } else {
            Color color = isupper(c) ? WHITE : BLACK;
            Piece piece = EMPTY;
            char lower = tolower(c);
            if (lower == 'p') piece = PAWN;
            else if (lower == 'n') piece = KNIGHT;
            else if (lower == 'b') piece = BISHOP;
            else if (lower == 'r') piece = ROOK;
            else if (lower == 'q') piece = QUEEN;
            else if (lower == 'k') piece = KING;
            
            if (row < 8 && col < 8 && piece != EMPTY) {
                board[row][col].setPieceAndColor(piece, color);
                col++;
            }
        }
    }

    if (activeColorPart == "b") turn = BLACK;
    else turn = WHITE;

    whiteCanCastleKingside = (castlingPart.find('K') != std::string::npos);
    whiteCanCastleQueenside = (castlingPart.find('Q') != std::string::npos);
    blackCanCastleKingside = (castlingPart.find('k') != std::string::npos);
    blackCanCastleQueenside = (castlingPart.find('q') != std::string::npos);

    if (enPassantPart != "-" && enPassantPart.length() == 2) {
        int epCol = enPassantPart[0] - 'a';
        int epRow = 8 - (enPassantPart[1] - '0');
        enPassantTarget = {epRow, epCol};
    } else {
        enPassantTarget = {-1, -1};
    }

    if (!halfMovePart.empty()) halfMoveClock = std::stoi(halfMovePart);
    else halfMoveClock = 0;

    if (!fullMovePart.empty()) fullMoveNumber = std::stoi(fullMovePart);
    else fullMoveNumber = 1;

    positionHistory.clear();
    positionHistory.push_back(generatePositionString());
    
    return true;
}

Board::Board() {
    setBoard();
}

void Board::setBoard() {
    for (int i = 0; i < 8; ++i) {
        for (int j = 0; j < 8; ++j) {
            board[i][j].setX(i);
            board[i][j].setY(j);
            board[i][j].setEmpty();
        }
    }

    board[7][0].setPieceAndColor(ROOK, WHITE);
    board[7][1].setPieceAndColor(KNIGHT, WHITE);
    board[7][2].setPieceAndColor(BISHOP, WHITE);
    board[7][3].setPieceAndColor(QUEEN, WHITE);
    board[7][4].setPieceAndColor(KING, WHITE);
    board[7][5].setPieceAndColor(BISHOP, WHITE);
    board[7][6].setPieceAndColor(KNIGHT, WHITE);
    board[7][7].setPieceAndColor(ROOK, WHITE);
    for (int i = 0; i < 8; ++i) {
        board[6][i].setPieceAndColor(PAWN, WHITE);
    }

    board[0][0].setPieceAndColor(ROOK, BLACK);
    board[0][1].setPieceAndColor(KNIGHT, BLACK);
    board[0][2].setPieceAndColor(BISHOP, BLACK);
    board[0][3].setPieceAndColor(QUEEN, BLACK);
    board[0][4].setPieceAndColor(KING, BLACK);
    board[0][5].setPieceAndColor(BISHOP, BLACK);
    board[0][6].setPieceAndColor(KNIGHT, BLACK);
    board[0][7].setPieceAndColor(ROOK, BLACK);
    for (int i = 0; i < 8; ++i) {
        board[1][i].setPieceAndColor(PAWN, BLACK);
    }

    turn = WHITE;
    enPassantTarget = {-1, -1};
    halfMoveClock = 0;
    fullMoveNumber = 1;
    whiteCanCastleKingside = true;
    whiteCanCastleQueenside = true;
    blackCanCastleKingside = true;
    blackCanCastleQueenside = true;
    positionHistory.clear();
    positionHistory.push_back(generatePositionString());
}

void Board::printBoard() const {
    std::cout << "\n    a  b  c  d  e  f  g  h \n";
    std::cout << "  +------------------------+\n";
    for (int i = 0; i < 8; i++) {
        std::cout << 8-i << " |";
        for (int j = 0; j < 8; j++) {
            Piece p = board[i][j].getPiece();
            Color c = board[i][j].getColor();
            char symbol;

            switch (p) {
                case KING:   symbol = 'K'; break;
                case QUEEN:  symbol = 'Q'; break;
                case BISHOP: symbol = 'B'; break;
                case KNIGHT: symbol = 'N'; break;
                case ROOK:   symbol = 'R'; break;
                case PAWN:   symbol = 'P'; break;
                case EMPTY:  symbol = '.'; break;
                default:     symbol = '?'; break;
            }

            if (c == WHITE) {
                symbol = tolower(symbol);
            }
            std::cout << ' ' << symbol << ' ';
        }
        std::cout << "| " << 8-i << "\n";
    }
    std::cout << "  +------------------------+\n";
    std::cout << "    a  b  c  d  e  f  g  h \n\n";
    std::cout << (turn == WHITE ? "White" : "Black") << " to move." << std::endl;
}

bool Board::makeMove(int fromX, int fromY, int toX, int toY) {
    if (!isValidMoveInternal(fromX, fromY, toX, toY, true)) {
        std::cout << "--- ILLEGAL MOVE --- Please try again." << std::endl;
        return false;
    }

    Square* from = &board[fromX][fromY];
    Square* to = &board[toX][toY];
    Piece movingPiece = from->getPiece();
    Color movingColor = from->getColor();

    std::pair<int, int> previousEnPassantTarget = enPassantTarget;
    enPassantTarget = {-1, -1};

    if (movingPiece == PAWN && to->getPiece() == EMPTY && fromY != toY) {
        if (toX == previousEnPassantTarget.first && toY == previousEnPassantTarget.second) {
            int capturedPawnX = fromX;
            int capturedPawnY = toY;
            if (board[capturedPawnX][capturedPawnY].getPiece() == PAWN && board[capturedPawnX][capturedPawnY].getColor() == opposite(movingColor)) {
                board[capturedPawnX][capturedPawnY].setEmpty();
            } else {
                std::cerr << "Error: En passant state inconsistency during move execution." << std::endl;
            }
        } else {
             std::cerr << "Error: Mismatch between pawn move and en passant target during move execution." << std::endl;
        }
    }

    if (movingPiece == KING && abs(fromY - toY) == 2) {
        int rookStartY = (toY > fromY) ? 7 : 0;
        int rookEndY = (toY > fromY) ? 5 : 3;

        Square* rookSquare = &board[fromX][rookStartY];
         if (rookSquare->getPiece() == ROOK && rookSquare->getColor() == movingColor) {
             board[fromX][rookEndY].setSpace(rookSquare);
             board[fromX][rookEndY].setHasMoved(true);
             rookSquare->setEmpty();
         } else {
             std::cerr << "Error: Castling state inconsistency during move execution." << std::endl;
         }
    }

    to->setSpace(from);
    to->setHasMoved(true);
    from->setEmpty();

    if (movingPiece == PAWN && abs(fromX - toX) == 2) {
        int enPassantRow = (fromX + toX) / 2;
        enPassantTarget = {enPassantRow, toY};
    }

    if (movingPiece == PAWN && (toX == 0 || toX == 7)) {
        promotePawn(toX, toY);
    }

    turn = opposite(turn);

    if (isInCheck(turn)) {
        if (isCheckmate(turn)) {
            printBoard();
            std::cout << "\nCHECKMATE! " << (turn == WHITE ? "Black" : "White") << " wins!" << std::endl;
            return false;
        } else {
            std::cout << "\nCHECK!" << std::endl;
        }
    } else if (isStalemate(turn)) {
        printBoard();
        std::cout << "\nSTALEMATE! The game is a draw." << std::endl;
        return false;
    }

    return true;
}

std::string Board::generatePositionString() const {
    std::string fen = "";
    for (int i = 0; i < 8; ++i) {
        int emptyCount = 0;
        for (int j = 0; j < 8; ++j) {
            Piece p = board[i][j].getPiece();
            if (p == EMPTY) {
                emptyCount++;
            } else {
                if (emptyCount > 0) {
                    fen += std::to_string(emptyCount);
                    emptyCount = 0;
                }
                Color c = board[i][j].getColor();
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
    fen += (turn == WHITE) ? " w " : " b ";
    
    std::string castling = "";
    if (whiteCanCastleKingside) castling += "K";
    if (whiteCanCastleQueenside) castling += "Q";
    if (blackCanCastleKingside) castling += "k";
    if (blackCanCastleQueenside) castling += "q";
    if (castling.empty()) castling = "-";
    fen += castling + " ";

    if (enPassantTarget.first != -1) {
        char file = 'a' + enPassantTarget.second;
        char rank = '8' - enPassantTarget.first;
        fen += file;
        fen += rank;
    } else {
        fen += "-";
    }

    return fen;
}

bool Board::isDrawByFiftyMoveRule() const {
    return halfMoveClock >= 100;
}

bool Board::isDrawByRepetition() const {
    int count = 0;
    std::string currentPos = generatePositionString();
    for (const std::string& pos : positionHistory) {
        if (pos == currentPos) {
            count++;
            if (count >= 3) return true;
        }
    }
    return false;
}

int Board::getGameState() {
    if (isCheckmate(turn)) return 1;
    if (isStalemate(turn)) return 2;
    if (isDrawByFiftyMoveRule()) return 3;
    if (isDrawByRepetition()) return 4;
    if (isInsufficientMaterial()) return 5;
    return 0;
}

bool Board::hasMatingMaterial(Color c) const {
    int knightCount = 0;
    int bishopCount = 0;
    int pawnCount = 0;
    int rookCount = 0;
    int queenCount = 0;

    for (int i = 0; i < 8; ++i) {
        for (int j = 0; j < 8; ++j) {
            if (board[i][j].getColor() == c) {
                Piece p = board[i][j].getPiece();
                if (p == PAWN) pawnCount++;
                else if (p == KNIGHT) knightCount++;
                else if (p == BISHOP) bishopCount++;
                else if (p == ROOK) rookCount++;
                else if (p == QUEEN) queenCount++;
            }
        }
    }

    if (pawnCount > 0 || rookCount > 0 || queenCount > 0) return true;
    if (knightCount >= 2) return true; 
    if (knightCount > 0 && bishopCount > 0) return true;
    if (bishopCount >= 2) return true; 
    
    return false;
}

bool Board::isInsufficientMaterial() const {
    int whitePieces = 0;
    int blackPieces = 0;
    int whiteBishopsLight = 0;
    int whiteBishopsDark = 0;
    int blackBishopsLight = 0;
    int blackBishopsDark = 0;
    int whiteKnights = 0;
    int blackKnights = 0;

    for (int i = 0; i < 8; ++i) {
        for (int j = 0; j < 8; ++j) {
            Piece p = board[i][j].getPiece();
            if (p != EMPTY && p != KING) {
                Color c = board[i][j].getColor();
                if (c == WHITE) {
                    whitePieces++;
                    if (p == BISHOP) {
                        if ((i + j) % 2 == 0) whiteBishopsLight++;
                        else whiteBishopsDark++;
                    } else if (p == KNIGHT) {
                        whiteKnights++;
                    } else {
                        return false; 
                    }
                } else {
                    blackPieces++;
                    if (p == BISHOP) {
                        if ((i + j) % 2 == 0) blackBishopsLight++;
                        else blackBishopsDark++;
                    } else if (p == KNIGHT) {
                        blackKnights++;
                    } else {
                        return false; 
                    }
                }
            }
        }
    }

    if (whitePieces == 0 && blackPieces == 0) return true;
    if (whitePieces == 1 && whiteKnights == 1 && blackPieces == 0) return true;
    if (blackPieces == 1 && blackKnights == 1 && whitePieces == 0) return true;
    if (whitePieces == 1 && (whiteBishopsLight == 1 || whiteBishopsDark == 1) && blackPieces == 0) return true;
    if (blackPieces == 1 && (blackBishopsLight == 1 || blackBishopsDark == 1) && whitePieces == 0) return true;
    if (whitePieces == 1 && blackPieces == 1) {
        if (whiteBishopsLight == 1 && blackBishopsLight == 1) return true;
        if (whiteBishopsDark == 1 && blackBishopsDark == 1) return true;
    }

    return false;
}
