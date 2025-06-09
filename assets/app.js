let currentEvents = []
let currentOrder = []
const correctPositions = new Set()
let tries = 0


function startNewGame() {
  const scoreDiv = document.getElementById("score")
  scoreDiv.innerHTML = ""
  scoreDiv.className = "score-container"
  tries = 0
  document.getElementById("submitBtn").disabled = false

  fetch("/api/new-game")
    .then((response) => response.json())
    .then((data) => {
      currentEvents = data.events
      currentOrder = Array.from({ length: currentEvents.length }, (_, i) => i)
      correctPositions.clear()
      displayEvents()
    })
}

//
function displayEvents() {

    const eventsDiv = document.getElementById("events")
    eventsDiv.innerHTML = ""
    currentOrder.forEach((eventIndex, displayIndex) => {
    const event = currentEvents[eventIndex]
    const div = document.createElement("div")
    div.className = "event"

    // correct events
    if (correctPositions.has(displayIndex)) { div.classList.add("correct") }

    div.draggable = true
    const row = document.createElement("div")
    row.className = "event-row"
    const yearEl = document.createElement("div")
    yearEl.className = "event-year"
    yearEl.textContent = event.year

    // show year and link if correct
    if (!correctPositions.has(displayIndex)) { 
      yearEl.classList.add("hidden") 
    } else {
      const wikiLink = document.createElement("a")
      wikiLink.href = `https://en.wikipedia.org/wiki/${encodeURIComponent(event.title)}`
      wikiLink.target = "_blank"
      wikiLink.className = "wiki-link"
      wikiLink.textContent = "Learn More"
      yearEl.appendChild(wikiLink)
    }
    row.appendChild(yearEl)

    // image
    const imgEl = document.createElement("div")
    imgEl.className = "event-image"
    if (event.imageUrl) {
      const img = document.createElement("img")
      img.src = event.imageUrl
      img.alt = event.title
      imgEl.appendChild(img)
    }
    row.appendChild(imgEl)

    // container
    const content = document.createElement("div")
    content.className = "event-content"

    const titleEl = document.createElement("div")
    titleEl.className = "event-title"
    titleEl.textContent = event.title
    content.appendChild(titleEl)

    const descEl = document.createElement("div")
    descEl.className = "event-description"
    descEl.textContent = event.description
    content.appendChild(descEl)

    row.appendChild(content)
    div.appendChild(row)
    div.dataset.index = displayIndex

    // drag and drop events
    div.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", displayIndex)
      div.classList.add("dragging")
      setTimeout(() => {
        div.style.opacity = "0.4"
      }, 0)
    })

    div.addEventListener("dragend", () => {
      div.classList.remove("dragging")
      div.style.opacity = "1"
    })

    div.addEventListener("dragover", (e) => {
      e.preventDefault()
    })

    div.addEventListener("dragenter", (e) => {
      e.preventDefault()
      div.style.transform = "translateY(2px)"
    })

    div.addEventListener("dragleave", () => {
      div.style.transform = "none"
    })

    div.addEventListener("drop", (e) => {
      e.preventDefault()
      div.style.transform = "none"
      const fromIndex = Number.parseInt(e.dataTransfer.getData("text/plain"))
      const toIndex = Number.parseInt(div.dataset.index)

      // dont swap if correct
      if (correctPositions.has(fromIndex) || correctPositions.has(toIndex)) {
        return
      }

      if (fromIndex !== toIndex) {
        const temp = currentOrder[fromIndex]
        currentOrder[fromIndex] = currentOrder[toIndex]
        currentOrder[toIndex] = temp
        displayEvents()
      }
    })

    eventsDiv.appendChild(div)
  })
}

//
function checkOrder() {
  // disable if all events are correct
  if (correctPositions.size === currentEvents.length) {
    return
  }

  tries++
  fetch("/api/check-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order: currentOrder, events: currentEvents }),
  })
    .then((response) => response.json())
    .then((data) => {
      const scoreDiv = document.getElementById("score")

        //game completed
      if (data.correct) {
        scoreDiv.innerHTML = "<strong>Well done!</strong> It took you " + tries + " tries."
        scoreDiv.className = "score-container correct"
        correctPositions.clear()
        currentOrder.forEach((_, idx) => correctPositions.add(idx))
        document.getElementById("submitBtn").disabled = true

        // confetti time!
        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
        function randomInRange(min, max) { return Math.random() * (max - min) + min; }

        const interval = setInterval(function() {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            return clearInterval(interval);
          }

          const particleCount = 50 * (timeLeft / duration);
          
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
          });
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
          });
        }, 250);

      } else {

        // incorrect guess behavior
        scoreDiv.innerHTML = "<strong>Incorrect order.</strong> Try again!"
        scoreDiv.className = "score-container incorrect"
        scoreDiv.classList.add('shake')
        setTimeout(() => {scoreDiv.classList.remove('shake')}, 300)

        const correctOrder = [...currentOrder].sort((a, b) => {
          return new Date(currentEvents[a].date) - new Date(currentEvents[b].date)
        })

        correctPositions.clear()
        currentOrder.forEach((eventIdx, displayIdx) => {
          if (correctOrder[displayIdx] === eventIdx) {
            correctPositions.add(displayIdx)
          }
        })
      }

      displayEvents()
    })
}

document.addEventListener("DOMContentLoaded", startNewGame)