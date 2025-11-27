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
        this.history = [];
        this.score = 0;
        this.moves = 0;
        this.time = 0;
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
        this.initDeck();
        shuffle(this.deck);
        this.stock = [...this.deck];
        this.waste = [];
        this.foundations = [[], [], [], []];
        this.tableau = [[], [], [], [], [], [], []];
        this.history = [];
        this.score = 0;
        this.moves = 0;
        this.time = 0;

        // Deal
        for (let i = 0; i < 7; i++) {
            for (let j = i; j < 7; j++) {
                const card = this.stock.pop();
                if (i === j) card.faceUp = true; // Top card face up
                this.tableau[j].push(card);
            }
        }

        // Save initial state after dealing
        this.saveState();
    }

    // Internal helpers for undo/redo
    clonePile(pile) {
        return pile.map(c => ({
            suit: c.suit,
            rank: c.rank,
            id: c.id,
            faceUp: c.faceUp,
            value: c.value,
            color: c.color
        }));
    }

    restorePile(pileData) {
        return pileData.map(c => {
            const card = new Card(c.suit, c.rank, c.id);
            card.faceUp = c.faceUp;
            card.value = c.value;
            card.color = c.color;
            return card;
        });
    }

    saveState() {
        const snapshot = {
            stock: this.clonePile(this.stock),
            waste: this.clonePile(this.waste),
            foundations: this.foundations.map(p => this.clonePile(p)),
            tableau: this.tableau.map(p => this.clonePile(p)),
            score: this.score
        };
        this.history.push(snapshot);
        this.persist();
    }

    undo() {
        if (this.history.length <= 1) {
            // Keep at least the initial state; nothing to undo
            return false;
        }
        // Discard current state
        this.history.pop();
        const prev = this.history[this.history.length - 1];
        this.stock = this.restorePile(prev.stock);
        this.waste = this.restorePile(prev.waste);
        this.foundations = prev.foundations.map(p => this.restorePile(p));
        this.tableau = prev.tableau.map(p => this.restorePile(p));
        this.score = prev.score || 0;
        
        // Moves increment on undo
        this.moves++;
        
        this.persist();
        return true;
    }

    persist() {
        const state = {
            stock: this.clonePile(this.stock),
            waste: this.clonePile(this.waste),
            foundations: this.foundations.map(p => this.clonePile(p)),
            tableau: this.tableau.map(p => this.clonePile(p)),
            history: this.history,
            moves: this.moves,
            time: this.time,
            score: this.score
        };
        try {
            localStorage.setItem('solitaire_state', JSON.stringify(state));
        } catch (e) {
            console.error('Save failed', e);
        }
    }

    load() {
        try {
            const json = localStorage.getItem('solitaire_state');
            if (!json) return false;
            const state = JSON.parse(json);
            
            if (!state.stock || !state.tableau || !state.history) return false;

            this.stock = this.restorePile(state.stock);
            this.waste = this.restorePile(state.waste);
            this.foundations = state.foundations.map(p => this.restorePile(p));
            this.tableau = state.tableau.map(p => this.restorePile(p));
            this.history = state.history;
            this.score = state.score || 0;
            this.moves = state.moves || 0;
            this.time = state.time || 0;
            return true;
        } catch (e) {
            console.error('Load failed', e);
            return false;
        }
    }

    isAutoWinState() {
        if (this.stock.length > 0 || this.waste.length > 0) return false;
        if (this.checkWin()) return false;
        return this.tableau.every(pile => pile.every(c => c.faceUp));
    }

    attemptAutoMove() {
        for (let i = 0; i < 7; i++) {
            const pile = this.tableau[i];
            if (pile.length > 0) {
                const card = pile[pile.length - 1];
                for (let f = 0; f < 4; f++) {
                    if (this.canMoveToFoundation(card, f)) {
                        this.foundations[f].push(pile.pop());
                        return true;
                    }
                }
            }
        }
        return false;
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

    getHint() {
        // 1. Check for moves to Foundation (Tableau -> Foundation)
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

        // 2. Check for moves to Foundation (Waste -> Foundation)
        if (this.waste.length > 0) {
            const card = this.waste[this.waste.length - 1];
            for (let f = 0; f < 4; f++) {
                if (this.canMoveToFoundation(card, f)) {
                    return { type: 'move', source: 'waste', card: card };
                }
            }
        }

        // 3. Check for moves within Tableau (Tableau -> Tableau)
        // Prioritize moves that uncover face-down cards
        for (let i = 0; i < 7; i++) {
            const pile = this.tableau[i];
            if (pile.length === 0) continue;

            // Find first face up card
            let faceUpIndex = -1;
            for (let j = 0; j < pile.length; j++) {
                if (pile[j].faceUp) {
                    faceUpIndex = j;
                    break;
                }
            }

            if (faceUpIndex === -1) continue;

            // If it's a King at the bottom, moving it is low priority (unless we just want to allow it)
            // We'll skip it for hints to avoid loop suggestions unless it helps something else? 
            // Actually, let's skip King at bottom for hints to keep them "progressive".
            if (faceUpIndex === 0 && pile[faceUpIndex].rank === 'K') continue;

            const card = pile[faceUpIndex];
            
            for (let t = 0; t < 7; t++) {
                if (i === t) continue;
                if (this.canMoveToTableau(card, t)) {
                    return { type: 'move', source: 'tableau', index: i, cardIndex: faceUpIndex, card: card };
                }
            }
        }

        // 4. Check for moves from Waste to Tableau
        if (this.waste.length > 0) {
            const card = this.waste[this.waste.length - 1];
            for (let t = 0; t < 7; t++) {
                if (this.canMoveToTableau(card, t)) {
                    return { type: 'move', source: 'waste', card: card };
                }
            }
        }

        // 5. Draw from Stock
        if (this.stock.length > 0 || this.waste.length > 0) {
            return { type: 'draw' };
        }

        return { type: 'none' };
    }

    // Actions
    drawFromStock() {
        // Only save if an action will actually change state
        if (this.stock.length === 0) {
            // Recycle waste
            if (this.waste.length === 0) return false;

            // Perform mutation first, then save resulting state
            this.stock = this.waste.reverse().map(c => { c.faceUp = false; return c; });
            this.waste = [];
            
            this.score = Math.max(0, this.score - 100);
            this.moves++;
            
            this.saveState();
            return 'recycle';
        } else {
            // Draw 1 card
            const card = this.stock.pop();
            card.faceUp = true;
            this.waste.push(card);
            
            this.moves++;
            
            this.saveState();

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