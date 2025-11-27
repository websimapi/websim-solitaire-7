import { SolitaireGame } from './solitaire.js';
import { AudioManager } from './audio-manager.js';
import { render, highlightHint } from './renderer.js';
import { setupDragAndDrop } from './drag-drop.js';
import { setupStockInteraction } from './stock-layout.js';

const game = new SolitaireGame();
const audio = new AudioManager();

const UI = {
    stock: document.getElementById('stock'),
    stockEmpty: document.getElementById('stock-empty'),
    waste: document.getElementById('waste'),
    foundations: [
        document.getElementById('foundation-0'),
        document.getElementById('foundation-1'),
        document.getElementById('foundation-2'),
        document.getElementById('foundation-3')
    ],
    tableau: [
        document.getElementById('tableau-0'),
        document.getElementById('tableau-1'),
        document.getElementById('tableau-2'),
        document.getElementById('tableau-3'),
        document.getElementById('tableau-4'),
        document.getElementById('tableau-5'),
        document.getElementById('tableau-6')
    ],
    winOverlay: document.getElementById('win-overlay'),
    restartBtn: document.getElementById('restart-btn'),
    navUndoBtn: document.getElementById('nav-undo-btn'),
    navHintBtn: document.getElementById('nav-hint-btn')
};

let autoCompleting = false;

// Apply any saved deck layout preference from previous sessions
function applySavedLayout() {
    let pos;
    try {
        pos = localStorage.getItem('deckLayout');
    } catch (e) {
        pos = null;
    }
    if (!pos) return;

    const gameContainer = document.getElementById('game-container');
    const topRow = document.getElementById('top-row');
    if (!gameContainer || !topRow) return;

    // First char: 't' or 'b' (top/bottom)
    if (pos[0] === 'b') {
        gameContainer.classList.add('col-reverse');
    } else {
        gameContainer.classList.remove('col-reverse');
    }

    // Second char: 'l' or 'r' (left/right)
    if (pos[1] === 'r') {
        topRow.classList.add('row-reverse');
    } else {
        topRow.classList.remove('row-reverse');
    }
}

const doRender = () => {
    render(game, UI, audio);
    if (!autoCompleting && game.isAutoWinState()) {
        startAutoComplete();
    }
};

function startAutoComplete() {
    autoCompleting = true;
    if (UI.navUndoBtn) UI.navUndoBtn.disabled = true;
    if (UI.navHintBtn) UI.navHintBtn.disabled = true;

    const interval = setInterval(() => {
        if (game.checkWin()) {
            clearInterval(interval);
            autoCompleting = false;
            doRender();
            return;
        }

        const moved = game.attemptAutoMove();
        if (moved) {
            if (!game.checkWin()) audio.play('place');
            render(game, UI, audio);
        } else {
            clearInterval(interval);
            autoCompleting = false;
            if (UI.navUndoBtn) UI.navUndoBtn.disabled = false;
            if (UI.navHintBtn) UI.navHintBtn.disabled = false;
        }
    }, 100);
}

(async () => {
    await audio.load();

    // Restore preferred deck layout before starting the game/render
    applySavedLayout();

    game.start();
    audio.play('shuffle');

    setupDragAndDrop({
        game,
        UI,
        audio,
        render: doRender
    });

    doRender();

    attachListeners();
})();

function attachListeners() {
    const stockContainer = UI.stock.parentElement;
    setupStockInteraction(stockContainer, game, audio, doRender);

    UI.restartBtn.addEventListener('click', () => {
        UI.winOverlay.classList.add('hidden');
        game.start();
        audio.play('shuffle');
        doRender();
    });

    if (UI.navHintBtn) {
        UI.navHintBtn.addEventListener('click', () => {
            const hint = game.getHint();
            if (hint.type === 'none') {
                if (confirm("No moves possible. Start a new game?")) {
                    game.start();
                    audio.play('shuffle');
                    doRender();
                }
            } else {
                highlightHint(UI, hint);
            }
        });
    }

    if (UI.navUndoBtn) {
        UI.navUndoBtn.addEventListener('click', () => {
            const undone = game.undo();
            if (undone) {
                doRender();
            }
        });
    }
}

