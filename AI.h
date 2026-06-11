#ifndef AI_H
#define AI_H

#include "Board.h"

class AI {
    int maxDepth;
    int elo;

    int minimax(Board& b, int depth, int alpha, int beta);

public:
    AI(int eloRating = 1200);
    Move getBestMove(const Board& b);
    void setElo(int eloRating);
};

#endif
