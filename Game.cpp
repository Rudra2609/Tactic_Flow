#include "Game.h"
#include <iostream>
#include <string>
#include <cctype>

void Game::playGame() {
    b.setBoard();
    bool gameContinues = true;

    while (gameContinues) {
        b.printBoard();

        std::string moveInput;
        std::cout << "Enter move (e.g., e2e4, or type 'quit'): ";

         if (!std::getline(std::cin, moveInput)) {
             if (std::cin.eof()) {
                  std::cout << "\nInput stream ended. Game aborted." << std::endl;
             } else {
                  std::cout << "\nInput error. Game aborted." << std::endl;
                  std::cin.clear();
             }
             break;
         }

        if (moveInput == "quit") {
             std::cout << "Game aborted by user." << std::endl;
             break;
        }

         if (moveInput.length() != 4 ||
             !isalpha(moveInput[0]) || !isdigit(moveInput[1]) ||
             !isalpha(moveInput[2]) || !isdigit(moveInput[3]))
         {
             std::cout << "Invalid move format. Use algebraic notation like 'e2e4'." << std::endl;
             continue;
         }

        int fromY = tolower(moveInput[0]) - 'a';
        int fromX = 8 - (moveInput[1] - '0');
        int toY = tolower(moveInput[2]) - 'a';
        int toX = 8 - (moveInput[3] - '0');

         if (fromX < 0 || fromX > 7 || fromY < 0 || fromY > 7 ||
             toX < 0 || toX > 7 || toY < 0 || toY > 7)
         {
             std::cout << "Invalid coordinates. Use ranks 1-8 and files a-h." << std::endl;
             continue;
         }

        if (!b.makeMove(fromX, fromY, toX, toY)) {
            Color potentiallyEndedPlayer = b.getTurn();
            if (b.isCheckmate(potentiallyEndedPlayer) || b.isStalemate(potentiallyEndedPlayer)) {
                 gameContinues = false;
            }
        }
    }

     std::cout << "\nGame Over." << std::endl;
}
