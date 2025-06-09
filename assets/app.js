let currentEvents = [];
let currentOrder = [];
let correctPositions = new Set();

function startNewGame() {
    fetch('/api/new-game')
        .then(response => response.json())
        .then(data => {
            currentEvents = data.events;
            currentOrder = Array.from({length: currentEvents.length}, (_, i) => i);
            correctPositions.clear();
            displayEvents();
        });
}

function displayEvents() {
    const eventsDiv = document.getElementById('events');
    eventsDiv.innerHTML = '';
    currentOrder.forEach((eventIndex, displayIndex) => {
        const event = currentEvents[eventIndex];
        const div = document.createElement('div');
        div.className = 'event';
        if (correctPositions.has(displayIndex)) {
            div.classList.add('correct');
        }
        div.draggable = true;
        div.innerHTML = '<strong>' + event.title + '</strong><br>' + event.description;
        div.dataset.index = displayIndex;
        
        div.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', displayIndex);
            div.classList.add('dragging');
        });
        
        div.addEventListener('dragend', () => {
            div.classList.remove('dragging');
        });
        
        div.addEventListener('dragover', e => {
            e.preventDefault();
        });
        
        div.addEventListener('drop', e => {
            e.preventDefault();
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const toIndex = parseInt(div.dataset.index);
            
            if (fromIndex !== toIndex) {
                const temp = currentOrder[fromIndex];
                currentOrder[fromIndex] = currentOrder[toIndex];
                currentOrder[toIndex] = temp;
                correctPositions.clear();
                displayEvents();
            }
        });
        
        eventsDiv.appendChild(div);
    });
}

function checkOrder() {
    fetch('/api/check-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: currentOrder, events: currentEvents })
    })
    .then(response => response.json())
    .then(data => {
        const scoreDiv = document.getElementById('score');
        if (data.correct) {
            scoreDiv.innerHTML = 'Correct! <br>Years: ' + data.years.join(', ');
            correctPositions.clear();
            currentOrder.forEach((_, idx) => correctPositions.add(idx));
            displayEvents();
        } else {
            scoreDiv.innerHTML = 'Incorrect order. Try again!';
            
            const correctOrder = [...currentOrder].sort((a, b) => {
                return new Date(currentEvents[a].date) - new Date(currentEvents[b].date);
            });

            correctPositions.clear();
            currentOrder.forEach((eventIdx, displayIdx) => {
                if (correctOrder[displayIdx] === eventIdx) {
                    correctPositions.add(displayIdx);
                }
            });
            
            displayEvents();
        }
    });
}

startNewGame(); 