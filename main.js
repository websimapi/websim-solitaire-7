import { SolitaireGame } from './solitaire.js';
import { AudioManager } from './audio-manager.js';
import { render } from './renderer.js';
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
    restartBtn: document.getElementById('restart-btn')
};

const doRender = () => render(game, UI, audio);

(async () => {
    await audio.load();
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
}