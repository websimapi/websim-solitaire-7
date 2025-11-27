import { SUIT_ICONS, COLORS } from './constants.js';

export class CardRenderer {
    static createCardElement(card) {
        const el = document.createElement('div');
        el.className = 'card';
        el.dataset.suit = card.suit;
        el.dataset.rank = card.rank;
        el.dataset.color = COLORS[card.suit];
        el.dataset.cid = card.id; // unique card id

        if (!card.faceUp) {
            el.classList.add('card-back');
            return el;
        }

        el.classList.add(COLORS[card.suit]);

        const icon = SUIT_ICONS[card.suit];
        
        // Top Left
        const topDiv = document.createElement('div');
        topDiv.className = 'card-top';
        topDiv.innerHTML = `<span>${card.rank}</span><span>${icon}</span>`;
        el.appendChild(topDiv);

        // Center (Simplified)
        const centerDiv = document.createElement('div');
        centerDiv.className = 'card-center';
        centerDiv.textContent = icon;
        el.appendChild(centerDiv);

        // Bottom Right
        const bottomDiv = document.createElement('div');
        bottomDiv.className = 'card-bottom';
        bottomDiv.innerHTML = `<span>${card.rank}</span><span>${icon}</span>`;
        el.appendChild(bottomDiv);

        return el;
    }
}