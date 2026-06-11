#include "Square.h"

Square::Square() : piece(EMPTY), color(NONE), x(0), y(0), hasMoved(false) {}

void Square::setSpace(Square* other) {
    piece = other->piece;
    color = other->color;
    hasMoved = other->hasMoved;
}

void Square::setEmpty() {
    piece = EMPTY;
    color = NONE;
    hasMoved = false;
}

void Square::setPieceAndColor(Piece p, Color c, bool moved) {
    piece = p;
    color = c;
    hasMoved = moved;
}

Piece Square::getPiece() const { return piece; }
Color Square::getColor() const { return color; }
int Square::getX() const { return x; }
int Square::getY() const { return y; }
bool Square::getHasMoved() const { return hasMoved; }

void Square::setX(int xCoord) { x = xCoord; }
void Square::setY(int yCoord) { y = yCoord; }
void Square::setHasMoved(bool moved) { hasMoved = moved; }
