// ... existing code ...

    // Rules
    canMoveToFoundation(card, foundationIndex) {
        const pile = this.foundations[foundationIndex];
        if (pile.length === 0) {
            return card.rank === 'A';
        }
        const top = pile[pile.length - 1];
        return card.suit === top.suit && card.value === top.value + 1;
    }

    canMoveToTableau(card, tableauIndex) {
        const pile = this.tableau[tableauIndex];
        if (pile.length === 0) {
            return card.rank === 'K';
        }
        const top = pile[pile.length - 1];
        return top.color !== card.color && top.value === card.value + 1;
    }

    // Helper to check if a move to tableau is "progressive"
    // i.e., it's not just moving a King between empty spots
    isProgressiveTableauMove(card, tableauIndex) {
        if (!this.canMoveToTableau(card, tableauIndex)) return false;

        const pile = this.tableau[tableauIndex];
        // If target is empty, it's a King. Always progressive unless we are moving a King base to another empty spot (handled in getHint)
        if (pile.length === 0) return true;

        return true; 
    }

    getHint() {
        // Priority 1: Move to Foundation (Tableau -> Foundation)
        for (let i = 0; i < 7; i++) {
            const pile = this.tableau[i];
            if (pile.length > 0) {
                const card = pile[pile.length - 1];
                for (let f = 0; f < 4; f++) {
                    if (this.canMoveToFoundation(card, f)) {
                        return { type: 'move', source: 'tableau', index: i, card: card };
                    }
                }
            }
        }

        // Priority 2: Move to Foundation (Waste -> Foundation)
        if (this.waste.length > 0) {
            const card = this.waste[this.waste.length - 1];
            for (let f = 0; f < 4; f++) {
                if (this.canMoveToFoundation(card, f)) {
                    return { type: 'move', source: 'waste', card: card };
                }
            }
        }

        // Priority 3: Reveal Face-Down Cards (Tableau -> Tableau)
        // Moves that immediately expose a face-down card. High value.
        for (let i = 0; i < 7; i++) {
            const pile = this.tableau[i];
            if (pile.length === 0) continue;

            // Find the deepest face-up card
            let firstFaceUp = -1;
            for (let j = 0; j < pile.length; j++) {
                if (pile[j].faceUp) {
                    firstFaceUp = j;
                    break;
                }
            }

            // If the card below the first face-up card is face-down, moving this stack reveals it.
            if (firstFaceUp > 0 && !pile[firstFaceUp - 1].faceUp) {
                const card = pile[firstFaceUp];
                for (let t = 0; t < 7; t++) {
                    if (i === t) continue;
                    if (this.canMoveToTableau(card, t)) {
                        return { type: 'move', source: 'tableau', index: i, cardIndex: firstFaceUp, card: card };
                    }
                }
            }
        }

        // Priority 4: Move from Waste -> Tableau
        // Gets a card into play.
        if (this.waste.length > 0) {
            const card = this.waste[this.waste.length - 1];
            for (let t = 0; t < 7; t++) {
                if (this.canMoveToTableau(card, t)) {
                    return { type: 'move', source: 'waste', card: card };
                }
            }
        }

        // Priority 5: Clear a Tableau Column (Tableau -> Tableau)
        // Only suggest this if we have a King available (in Waste or Tableau) that can fill the spot.
        // Otherwise, we might just be shuffling stacks around pointlessly.
        for (let i = 0; i < 7; i++) {
            const pile = this.tableau[i];
            // Must be a base card (index 0) that is face up
            if (pile.length > 0 && pile[0].faceUp) {
                // If it's already a King at the bottom, don't move it just to empty the spot
                if (pile[0].rank === 'K') continue;

                // Check if we have a King available to fill this spot
                let kingAvailable = false;

                // Check Waste for King
                if (this.waste.some(c => c.rank === 'K')) kingAvailable = true;

                // Check other Tableau piles for a King that is NOT at the bottom (i.e., is covering something)
                if (!kingAvailable) {
                    for (let k = 0; k < 7; k++) {
                        if (k === i) continue;
                        const kPile = this.tableau[k];
                        const kFaceUpIndex = kPile.findIndex(c => c.faceUp);
                        if (kFaceUpIndex > 0 && kPile[kFaceUpIndex].rank === 'K') {
                            kingAvailable = true;
                            break;
                        }
                    }
                }

                if (kingAvailable) {
                    const card = pile[0];
                    for (let t = 0; t < 7; t++) {
                        if (i === t) continue;
                        if (this.canMoveToTableau(card, t)) {
                            return { type: 'move', source: 'tableau', index: i, cardIndex: 0, card: card };
                        }
                    }
                }
            }
        }

        // Priority 6: Lateral Moves to Aid Foundation (Tableau -> Tableau)
        // Move a partial stack ONLY if the card underneath it can immediately go to a Foundation.
        for (let i = 0; i < 7; i++) {
            const pile = this.tableau[i];
            if (pile.length <= 1) continue; // Need at least 2 cards to have something "underneath"

            let firstFaceUp = -1;
            for (let j = 0; j < pile.length; j++) {
                if (pile[j].faceUp) {
                    firstFaceUp = j;
                    break;
                }
            }
            if (firstFaceUp === -1) continue;

            // Check substacks starting from firstFaceUp + 1
            // We want to move the stack starting at 'j' to expose 'j-1'
            for (let j = firstFaceUp + 1; j < pile.length; j++) {
                const cardToExpose = pile[j - 1];

                // Check if exposed card can go to foundation
                let exposesUseful = false;
                for (let f = 0; f < 4; f++) {
                    if (this.canMoveToFoundation(cardToExpose, f)) {
                        exposesUseful = true;
                        break;
                    }
                }

                if (exposesUseful) {
                    const cardToMove = pile[j];
                    for (let t = 0; t < 7; t++) {
                        if (i === t) continue;
                        if (this.canMoveToTableau(cardToMove, t)) {
                            return { type: 'move', source: 'tableau', index: i, cardIndex: j, card: cardToMove };
                        }
                    }
                }
            }
        }

        // Priority 7: Draw from Stock
        // Only suggest if there is a card in Stock/Waste that can actually be played 
        // (to Foundation or Tableau) and isn't just a pointless shuffle.
        if (this.stock.length > 0 || this.waste.length > 0) {
            const allDeckCards = [...this.waste, ...this.stock]; // Check in order roughly
            let useful = false;

            for (const card of allDeckCards) {
                // Check Foundation
                for (let f = 0; f < 4; f++) {
                    if (this.canMoveToFoundation(card, f)) {
                        useful = true; 
                        break;
                    }
                }
                if (useful) break;

                // Check Tableau
                for (let t = 0; t < 7; t++) {
                    if (this.canMoveToTableau(card, t)) {
                        // Ensure it's not a King moving to an empty spot if we already have empty spots? 
                        // Actually, getting a King from deck to board is always good.
                        useful = true;
                        break;
                    }
                }
                if (useful) break;
            }

            if (useful) {
                return { type: 'draw' };
            }
        }

        // No productive moves found
        return { type: 'none' };
    }

    // Actions
// ... existing code ...