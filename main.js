import { SolitaireGame } from './solitaire.js';
import { CardRenderer } from './card-renderer.js';
import { AudioManager } from './audio-manager.js';
import { getOverlapArea } from './utils.js';

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

let draggedCards = [];
let dragSource = null; // { type: 'tableau'|'waste'|'foundation', index: number }
let dragStartPos = { x: 0, y: 0 };
let originalPositions = []; // Array of { top, left } for reverting
let isDragging = false;
let pointerId = null;
let lastTap = { time: 0, id: null };
let layoutIndicators = [];

// Initialize
(async () => {
    await audio.load();
    game.start();
    audio.play('shuffle');
    render();
    attachListeners();
})();

UI.restartBtn.addEventListener('click', () => {
    UI.winOverlay.classList.add('hidden');
    game.start();
    audio.play('shuffle');
    render();
});

function render() {
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
        visibleWaste.forEach((c, i) => {
            const el = CardRenderer.createCardElement(c);
            
            // Fan out to the right (25% of card width per card)
            el.style.left = `${i * 25}%`; 
            el.style.top = '0px';
            UI.waste.appendChild(el);

            // Only the top-most card is interactive
            if (i === visibleWaste.length - 1) {
                makeDraggable(el, { type: 'waste' }, c);
                makeClickable(el, { type: 'waste' }, c);
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
            makeDraggable(el, { type: 'foundation', index: idx }, topCard);
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
                makeDraggable(el, { type: 'tableau', index: idx, cardIndex }, card);
                makeClickable(el, { type: 'tableau', index: idx, cardIndex }, card);
            }
        });
    });

    if (game.checkWin()) {
        UI.winOverlay.classList.remove('hidden');
        audio.play('win');
    }
}

function attachListeners() {
    // Stock Interaction (Tap to Draw / Drag to Move Layout)
    const stockContainer = UI.stock.parentElement;
    setupStockInteraction(stockContainer);
}

function setupStockInteraction(container) {
    let startX, startY;
    let isDrag = false;
    let ghost = null;
    let pointerId = null;
    let pressStartTime = 0; // track press time for drag vs tap

    container.addEventListener('pointerdown', (e) => {
        // Allow primary touch/click only
        if (e.button !== 0 && e.type.includes('mouse')) return;

        e.preventDefault(); // Prevent default touch actions (scroll)
        
        startX = e.clientX;
        startY = e.clientY;
        isDrag = false;
        pointerId = e.pointerId;
        pressStartTime = Date.now();
        container.setPointerCapture(pointerId);

        container.addEventListener('pointermove', onMove);
        container.addEventListener('pointerup', onUp);
        container.addEventListener('pointercancel', onUp);
    });

    function onMove(e) {
        if (e.pointerId !== pointerId) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const elapsed = Date.now() - pressStartTime;

        // Only start drag if the press has been held long enough AND moved enough
        if (!isDrag && elapsed > 1500 && Math.hypot(dx, dy) > 20) {
            isDrag = true;
            createGhost(e.clientX, e.clientY);
            showLayoutIndicators();
            highlightActiveIndicator(e.clientX, e.clientY);
        }

        if (isDrag && ghost) {
            ghost.style.left = `${e.clientX}px`;
            ghost.style.top = `${e.clientY}px`;
            ghost.style.transform = 'translate(-50%, -50%)';
            highlightActiveIndicator(e.clientX, e.clientY);
        }
    }

    function onUp(e) {
        if (e.pointerId !== pointerId) return;

        container.releasePointerCapture(pointerId);
        container.removeEventListener('pointermove', onMove);
        container.removeEventListener('pointerup', onUp);
        container.removeEventListener('pointercancel', onUp);

        if (isDrag) {
            // Apply Layout Change
            updateLayout(e.clientX, e.clientY);
            if (ghost) ghost.remove();
            ghost = null;
            hideLayoutIndicators();
        } else {
            // Handle Tap (Draw Card) regardless of exact target inside the stock container
            const result = game.drawFromStock();
            if (result) {
                audio.play('place');
                render();
            }
        }

        isDrag = false;
        pointerId = null;
    }

    function createGhost(x, y) {
        ghost = document.createElement('div');
        ghost.className = 'ghost-deck';
        ghost.style.left = `${x}px`;
        ghost.style.top = `${y}px`;
        ghost.style.transform = 'translate(-50%, -50%)';
        document.body.appendChild(ghost);
    }
}

function updateLayout(x, y) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const gameContainer = document.getElementById('game-container');
    const topRow = document.getElementById('top-row');

    // Quadrants
    const isRight = x > w / 2;
    const isBottom = y > h / 2;

    if (isBottom) {
        gameContainer.classList.add('col-reverse');
    } else {
        gameContainer.classList.remove('col-reverse');
    }

    if (isRight) {
        topRow.classList.add('row-reverse');
    } else {
        topRow.classList.remove('row-reverse');
    }
}

function makeClickable(el, source, card) {
    // Double click / Single click logic for auto move
    // For mobile, "tap" is click.
    // We'll use a simple click handler that attempts to move to Foundation first.

    // Note: Click triggers after pointerup if no drag occurred.
    // We need to differentiate drag and click. Drag logic handles this.
    // If drag distance < threshold, treat as click.
}

// DRAG AND DROP LOGIC
function makeDraggable(el, sourceInfo, cardData) {
    el.addEventListener('pointerdown', (e) => onPointerDown(e, el, sourceInfo, cardData));
}

function onPointerDown(e, el, sourceInfo, cardData) {
    if (isDragging) return;
    if (e.button !== 0 && e.type.includes('mouse')) return;

    e.preventDefault(); // Prevent text selection / native drag
    e.stopPropagation();

    pointerId = e.pointerId;
    el.setPointerCapture(pointerId);

    dragSource = sourceInfo;
    dragStartPos = { x: e.clientX, y: e.clientY };

    // Identify which cards are being dragged
    draggedCards = [];

    if (sourceInfo.type === 'tableau') {
        const pile = game.tableau[sourceInfo.index];
        // Get this card and all below it
        const slice = pile.slice(sourceInfo.cardIndex);
        // Find their elements
        const container = UI.tableau[sourceInfo.index];
        const children = Array.from(container.children);
        const elements = children.slice(sourceInfo.cardIndex);

        slice.forEach((c, i) => {
            draggedCards.push({
                card: c,
                el: elements[i],
                originalTop: elements[i].style.top,
                originalLeft: elements[i].style.left,
                originalParent: elements[i].parentElement
            });
        });
    } else {
        // Single card (Waste or Foundation)
        draggedCards.push({
            card: cardData,
            el: el,
            originalTop: el.style.top,
            originalLeft: el.style.left,
            originalParent: el.parentElement
        });
    }

    // Visual setup for dragging
    // We don't move them to body, we translate them.
    // However, z-index context is tricky in stacks.
    // Best mobile web practice: Move to a fixed overlay or high z-index container?
    // Or just use transform.

    // To ensure they appear on top of everything, z-index 1000 is usually enough if parents don't clip.
    // Our containers don't have overflow hidden, but they might establish stacking contexts.
    // Let's rely on adding a class that boosts z-index.

    isDragging = false; // Will set to true on move threshold

    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
}

function onPointerMove(e) {
    if (!pointerId || e.pointerId !== pointerId) return;

    const dx = e.clientX - dragStartPos.x;
    const dy = e.clientY - dragStartPos.y;

    if (!isDragging) {
        if (Math.hypot(dx, dy) > 5) {
            isDragging = true;
            draggedCards.forEach(dc => dc.el.classList.add('dragging'));
        } else {
            return;
        }
    }

    // Move all dragged cards
    draggedCards.forEach(dc => {
        dc.el.style.transform = `translate(${dx}px, ${dy}px)`;
    });
}

function onPointerUp(e) {
    if (!pointerId || e.pointerId !== pointerId) return;

    const el = draggedCards[0].el;
    el.releasePointerCapture(pointerId);
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', onPointerUp);

    pointerId = null;

    if (!isDragging) {
        const card = draggedCards[0].card;
        handleAutoMove(card, dragSource);
        cleanupDrag();
        return;
    }

    // Drop Logic
    // Get the bounding rect of the primary card (first one)
    const cardRect = el.getBoundingClientRect();

    // Check intersections with Foundations and Tableau
    let bestTarget = null;
    let maxOverlap = 0;

    // Check Foundations (only if single card)
    if (draggedCards.length === 1) {
        UI.foundations.forEach((fEl, idx) => {
            const fRect = fEl.getBoundingClientRect();
            const overlap = getOverlapArea(cardRect, fRect);
            if (overlap > maxOverlap) {
                maxOverlap = overlap;
                bestTarget = { type: 'foundation', index: idx };
            }
        });
    }

    // Check Tableau
    UI.tableau.forEach((tEl, idx) => {
        // If dropping onto empty pile, check container rect
        // If dropping onto cards, check the top card rect? 
        // Actually, the pile container usually encompasses the area we care about roughly.
        // But for long piles, we want to drop on the bottom card.

        // Let's check overlap with the last card in the pile, or the empty placeholder area.
        const pile = game.tableau[idx];
        let targetRect;

        if (pile.length > 0) {
            // Last card element
            const lastCardEl = tEl.lastElementChild;
            targetRect = lastCardEl.getBoundingClientRect();
        } else {
            targetRect = tEl.getBoundingClientRect();
        }

        const overlap = getOverlapArea(cardRect, targetRect);
        if (overlap > maxOverlap) {
            maxOverlap = overlap;
            bestTarget = { type: 'tableau', index: idx };
        }
    });

    if (bestTarget) {
        attemptMove(bestTarget);
    } else {
        cancelMove();
    }
}

function cleanupDrag() {
    draggedCards.forEach(dc => {
        dc.el.classList.remove('dragging');
        dc.el.style.transform = '';
    });
    draggedCards = [];
    isDragging = false;
    dragSource = null;
}

function cancelMove() {
    // Animate back? For simplicity, just snap back.
    // CSS transition handles transform removal if we set it right, but we are removing transform property.
    // If we want smooth snap back: set transform to current px, then transition to 0.

    // Current simple version:
    cleanupDrag();
}

function attemptMove(target) {
    let success = false;
    const card = draggedCards[0].card;

    if (target.type === 'foundation') {
        if (game.canMoveToFoundation(card, target.index)) {
            executeMove(target);
            success = true;
        }
    } else if (target.type === 'tableau') {
        // Validate
        // If drag source was tableau, we are moving a substack.
        // Check if the bottom card of the stack fits on the target tableau.
        // Wait, draggedCards[0] is the top-most card of the dragging stack (visually top), 
        // which corresponds to the lowest index in the stack being moved.
        // Example: Tableau has 5,4,3. We drag 4,3. draggedCards[0] is 4.
        // We need to see if 4 fits on target.
        if (game.canMoveToTableau(card, target.index)) {
            executeMove(target);
            success = true;
        }
    }

    if (success) {
        audio.play('place');
        render(); // Re-render whole board to be safe and clean
    } else {
        cancelMove();
    }

    cleanupDrag(); // draggedCards array cleared here, but `dragging` class removed by render mostly
}

function executeMove(target) {
    // Update Game State

    // Remove from source
    let movingCards = [];
    if (dragSource.type === 'waste') {
        movingCards = [game.waste.pop()];
    } else if (dragSource.type === 'foundation') {
        movingCards = [game.foundations[dragSource.index].pop()];
    } else if (dragSource.type === 'tableau') {
        const pile = game.tableau[dragSource.index];
        movingCards = pile.splice(dragSource.cardIndex); // Remove from source

        // Flip new top card of source if exists
        if (pile.length > 0) {
            pile[pile.length - 1].faceUp = true;
        }
    }

    // Add to target
    if (target.type === 'foundation') {
        game.foundations[target.index].push(movingCards[0]);
    } else if (target.type === 'tableau') {
        game.tableau[target.index].push(...movingCards);
    }
}

function handleAutoMove(card, source) {
    // 1. Try Foundation (Only if single card)
    let isSingleCard = true;
    if (source.type === 'tableau') {
        const pile = game.tableau[source.index];
        // If the card index is not the last one, it has cards on top (is a stack)
        if (source.cardIndex < pile.length - 1) {
            isSingleCard = false;
        }
    }

    if (isSingleCard) {
        for (let i = 0; i < 4; i++) {
            if (game.canMoveToFoundation(card, i)) {
                executeMove({ type: 'foundation', index: i });
                audio.play('place');
                render();
                return;
            }
        }
    }

    // 2. Try Tableau (Stacks or Single)
    for (let i = 0; i < 7; i++) {
        // Skip self
        if (source.type === 'tableau' && source.index === i) continue;

        if (game.canMoveToTableau(card, i)) {
            executeMove({ type: 'tableau', index: i });
            audio.play('place');
            render();
            return;
        }
    }
}

function showLayoutIndicators() {
    const positions = ['tl', 'tr', 'bl', 'br'];
    positions.forEach(pos => {
        const el = document.createElement('div');
        el.className = `layout-target ${pos}`;
        document.body.appendChild(el);
        layoutIndicators.push(el);
    });
}

function hideLayoutIndicators() {
    layoutIndicators.forEach(el => el.remove());
    layoutIndicators = [];
}

function highlightActiveIndicator(x, y) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const isRight = x > w / 2;
    const isBottom = y > h / 2;
    
    const targetClass = (isBottom ? 'b' : 't') + (isRight ? 'r' : 'l');
    
    layoutIndicators.forEach(el => {
        if (el.classList.contains(targetClass)) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
}