#include "AI.h"
#include <algorithm>
#include <cstdlib>

AI::AI(int eloRating) {
    setElo(eloRating);
}

void AI::setElo(int eloRating) {
    elo = eloRating;
    if (elo <= 800) maxDepth = 1;
    else if (elo <= 1200) maxDepth = 2;
    else if (elo <= 1600) maxDepth = 3;
    else if (elo <= 2000) maxDepth = 4;
    else maxDepth = 5;
}

int AI::minimax(Board& b, int depth, int alpha, int beta) {
    if (depth == 0) {
        return b.evaluate();
    }

    Color currentTurn = b.getTurn();
    bool maximizingPlayer = (currentTurn == WHITE);
    std::vector<Move> moves = b.getLegalMoves(currentTurn);

    if (moves.empty()) {
        if (b.isInCheck(currentTurn)) {
            return maximizingPlayer ? -99999 + (maxDepth - depth) : 99999 - (maxDepth - depth); 
        }
        return 0; // Stalemate
    }

    if (maximizingPlayer) {
        int maxEval = -100000;
        for (const Move& move : moves) {
            Board nextBoard = b;
            nextBoard.makeMoveAI(move);
            int eval = minimax(nextBoard, depth - 1, alpha, beta);
            maxEval = std::max(maxEval, eval);
            alpha = std::max(alpha, eval);
            if (beta <= alpha) break; // Beta cutoff
        }
        return maxEval;
    } else {
        int minEval = 100000;
        for (const Move& move : moves) {
            Board nextBoard = b;
            nextBoard.makeMoveAI(move);
            int eval = minimax(nextBoard, depth - 1, alpha, beta);
            minEval = std::min(minEval, eval);
            beta = std::min(beta, eval);
            if (beta <= alpha) break; // Alpha cutoff
        }
        return minEval;
    }
}

Move AI::getBestMove(const Board& b) {
    Color myColor = b.getTurn();
    std::vector<Move> legalMoves = const_cast<Board&>(b).getLegalMoves(myColor);
    
    if (legalMoves.empty()) {
        return Move(); // No moves
    }

    if (elo < 1200 && (rand() % 100 < 30)) {
        return legalMoves[rand() % legalMoves.size()];
    }

    int bestScore = (myColor == WHITE) ? -100000 : 100000;
    Move bestMove = legalMoves[0];

    for (const Move& move : legalMoves) {
        Board nextBoard = b;
        nextBoard.makeMoveAI(move);
        int score = minimax(nextBoard, maxDepth - 1, -100000, 100000);
        
        if (myColor == WHITE) {
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        } else {
            if (score < bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
    }

    return bestMove;
}
