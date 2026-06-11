#ifndef SQUARE_H
#define SQUARE_H

#include "Common.h"

class Square {
    Piece piece;
    Color color;
    int x, y;
    bool hasMoved;

public:
    Square();
    void setSpace(Square* other);
    void setEmpty();
    void setPieceAndColor(Piece p, Color c, bool moved = false);

    Piece getPiece() const;
    Color getColor() const;
    int getX() const;
    int getY() const;
    bool getHasMoved() const;

    void setX(int xCoord);
    void setY(int yCoord);
    void setHasMoved(bool moved);
};

#endif
