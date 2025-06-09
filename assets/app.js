
let currentEvents = []
let currentOrder = []
const correctPositions = new Set()
let tries = 0


function startNewGame() {
  const scoreDiv = document.getElementById("score")
  scoreDiv.innerHTML = ""
  scoreDiv.className = "score-container"
  tries = 0


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

    // hide year
    if (!correctPositions.has(displayIndex)) { yearEl.classList.add("hidden") }
    row.appendChild(yearEl)

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
  tries++
  fetch("/api/check-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order: currentOrder, events: currentEvents }),
  })
    .then((response) => response.json())
    .then((data) => {
      const scoreDiv = document.getElementById("score")

      if (data.correct) {
        scoreDiv.innerHTML = "<strong>Well done!</strong> It took you " + tries + " tries."
        scoreDiv.className = "score-container correct"
        correctPositions.clear()
        currentOrder.forEach((_, idx) => correctPositions.add(idx))
      } else {
        scoreDiv.innerHTML = "<strong>Incorrect order.</strong> Try again!"
        scoreDiv.className = "score-container incorrect"

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