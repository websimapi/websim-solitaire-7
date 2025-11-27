import { SUITS, RANKS, COLORS } from './constants.js';
import { shuffle } from './utils.js';

class Card {
    constructor(suit, rank, id) {
        this.suit = suit;
        this.rank = rank;
        this.id = id;
        this.faceUp = false;
        this.value = RANKS.indexOf(rank) + 1;
        this.color = COLORS[suit];
    }
}

export class SolitaireGame {
    constructor() {
        this.deck = [];
        this.stock = [];
        this.waste = [];
        this.foundations = [[], [], [], []]; // 4 piles
        this.tableau = [[], [], [], [], [], [], []]; // 7 piles
        this.initDeck();
    }

    initDeck() {
        this.deck = [];
        let id = 0;
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                this.deck.push(new Card(suit, rank, id++));
            }
        }
    }

    start() {
        shuffle(this.deck);
        this.stock = [...this.deck];
        this.waste = [];
        this.foundations = [[], [], [], []];
        this.tableau = [[], [], [], [], [], [], []];

        // Deal
        for (let i = 0; i < 7; i++) {
            for (let j = i; j < 7; j++) {
                const card = this.stock.pop();
                if (i === j) card.faceUp = true; // Top card face up
                this.tableau[j].push(card);
            }
        }
    }

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

    // Actions
    drawFromStock() {
        if (this.stock.length === 0) {
            // Recycle waste
            if (this.waste.length === 0) return false;
            this.stock = this.waste.reverse().map(c => { c.faceUp = false; return c; });
            this.waste = [];
            return 'recycle';
        } else {
            // Draw 1 card
            const card = this.stock.pop();
            card.faceUp = true;
            this.waste.push(card);

            /* Previous "Draw 3" logic stored for later:
            let drawnCount = 0;
            while (this.stock.length > 0 && drawnCount < 3) {
                const card = this.stock.pop();
                card.faceUp = true;
                this.waste.push(card);
                drawnCount++;
            }
            */

            return 'draw';
        }
    }

    checkWin() {
        return this.foundations.every(f => f.length === 13);
    }
}