import { CardRenderer } from './card-renderer.js';
import { makeCardInteractive } from './drag-drop.js';

export function render(game, UI, audio) {
    // 1. Stock
    UI.stock.innerHTML = '';
    if (game.stock.length > 0) {
        // Just show a back card
        const cardEl = document.createElement('div');
        cardEl.className = 'card card-back';
        UI.stock.appendChild(cardEl);
        UI.stock.style.display = 'block';
        UI.stockEmpty.style.display = 'none';
    } else {
        UI.stock.style.display = 'none';
        UI.stockEmpty.style.display = 'flex';
    }

    // 2. Waste
    UI.waste.innerHTML = '';
    if (game.waste.length > 0) {
        // Show last 3 cards drawn
        const visibleWaste = game.waste.slice(-3);
        const topRow = document.getElementById('top-row');
        const fanRight = !topRow.classList.contains('row-reverse');

        visibleWaste.forEach((c, i) => {
            const el = CardRenderer.createCardElement(c);

            // Fan direction depends on deck position:
            // - When deck is on the left (normal), fan to the right.
            // - When deck is on the right (row-reverse), fan to the left.
            el.style.top = '0px';
            if (fanRight) {
                el.style.right = '';
                el.style.left = `${i * 25}%`;
            } else {
                el.style.left = '';
                el.style.right = `${i * 25}%`;
            }

            UI.waste.appendChild(el);

            // Only the top-most card is interactive
            if (i === visibleWaste.length - 1) {
                makeCardInteractive(el, { type: 'waste' }, c);
            }
        });
    }

    // 3. Foundations
    game.foundations.forEach((pile, idx) => {
        const container = UI.foundations[idx];
        container.innerHTML = '';
        if (pile.length > 0) {
            const topCard = pile[pile.length - 1];
            const el = CardRenderer.createCardElement(topCard);
            container.appendChild(el);
            makeCardInteractive(el, { type: 'foundation', index: idx }, topCard);
        }
    });

    // 4. Tableau
    game.tableau.forEach((pile, idx) => {
        const container = UI.tableau[idx];
        container.innerHTML = '';

        let currentTop = 0;

        pile.forEach((card, cardIndex) => {
            const el = CardRenderer.createCardElement(card);

            // Position card using cumulative offset to prevent jumps
            el.style.top = `${currentTop}%`;

            // Calculate offset for the next card
            // 12% for face-down cards to show a strip of the back
            // 35% for face-up cards to ensure the large header (rank + suit) is visible
            currentTop += card.faceUp ? 35 : 12;

            container.appendChild(el);

            if (card.faceUp) {
                makeCardInteractive(el, { type: 'tableau', index: idx, cardIndex }, card);
            }
        });
    });

    // 5. Check win
    if (game.checkWin()) {
        UI.winOverlay.classList.remove('hidden');
        audio.play('win');
    }
}