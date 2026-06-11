#ifndef COMMON_H
#define COMMON_H

enum Piece { KING, QUEEN, BISHOP, KNIGHT, ROOK, PAWN, EMPTY };
enum Color { WHITE, BLACK, NONE };

struct Move {
    int fromX, fromY;
    int toX, toY;
    Piece promotion;

    Move(int fx = 0, int fy = 0, int tx = 0, int ty = 0, Piece prom = QUEEN) 
        : fromX(fx), fromY(fy), toX(tx), toY(ty), promotion(prom) {}
};

#endif
