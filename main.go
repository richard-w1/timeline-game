package main

import (
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"strconv"
	"time"

	spinhttp "github.com/fermyon/spin/sdk/go/v2/http"
)

type HistoricalEvent struct {
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Date        time.Time `json:"date"`
	Year        int       `json:"year"`
}

type WikipediaEvent struct {
	Text string `json:"text"`
	Year int    `json:"year"`
}

type WikipediaResponse struct {
	Events []WikipediaEvent `json:"events"`
}

type GameState struct {
	Events     []HistoricalEvent `json:"events"`
	StartTime  time.Time         `json:"startTime"`
	IsComplete bool              `json:"isComplete"`
}

var gameState GameState

func fetchWikipediaEvents() ([]HistoricalEvent, error) {
	// a random date
	month := time.Month(rand.Intn(12) + 1)
	day := rand.Intn(28) + 1
	if month == 2 && day > 28 {
		day = 28
	} else if (month == 4 || month == 6 || month == 9 || month == 11) && day > 30 {
		day = 30
	} else if day > 31 {
		day = 31
	}

	// get events
	url := fmt.Sprintf("https://byabbe.se/on-this-day/%d/%d/events.json", month, day)

	resp, err := spinhttp.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %v", err)
	}

	// parse response
	var apiResp struct {
		Date   string `json:"date"`
		Events []struct {
			Year        string `json:"year"`
			Description string `json:"description"`
			Wikipedia   []struct {
				Title     string `json:"title"`
				Wikipedia string `json:"wikipedia"`
			} `json:"wikipedia"`
		} `json:"events"`
	}

	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %v", err)
	}

	if len(apiResp.Events) == 0 {
		return nil, fmt.Errorf("no events found for date %d/%d", month, day)
	}

	events := make([]HistoricalEvent, 0, len(apiResp.Events))
	for _, e := range apiResp.Events {
		year, err := strconv.Atoi(e.Year)
		if err != nil || year <= 0 || year > time.Now().Year() {
			continue
		}

		date := time.Date(year, month, day, 0, 0, 0, 0, time.UTC)

		title := e.Description
		if len(e.Wikipedia) > 0 && e.Wikipedia[0].Title != "" {
			title = e.Wikipedia[0].Title
		}

		// no description, skip
		if e.Description == "" {
			continue
		}

		events = append(events, HistoricalEvent{
			Title:       title,
			Description: e.Description,
			Date:        date,
			Year:        year,
		})
	}

	return events, nil
}

// spin http handler
func init() {
	rand.Seed(time.Now().UnixNano())

	spinhttp.Handle(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		if r.URL.Path == "/api/new-game" {
			events, err := fetchWikipediaEvents()
			if err != nil {
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
				return
			}

			rand.Shuffle(len(events), func(i, j int) {
				events[i], events[j] = events[j], events[i]
			})

			numEvents := 5
			if len(events) < numEvents {
				numEvents = len(events)
			}

			response := struct {
				Events []HistoricalEvent `json:"events"`
			}{
				Events: events[:numEvents],
			}

			json.NewEncoder(w).Encode(response)
			return
		}

		if r.URL.Path == "/api/check-order" {
			var req struct {
				Order  []int             `json:"order"`
				Events []HistoricalEvent `json:"events"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				w.WriteHeader(http.StatusBadRequest)
				json.NewEncoder(w).Encode(map[string]string{"error": "Invalid request"})
				return
			}

			if len(req.Order) != len(req.Events) {
				w.WriteHeader(http.StatusBadRequest)
				json.NewEncoder(w).Encode(map[string]string{"error": "Invalid order length"})
				return
			}

			correct := true
			years := make([]int, len(req.Order))
			for i := 1; i < len(req.Order); i++ {
				if req.Events[req.Order[i-1]].Date.After(req.Events[req.Order[i]].Date) {
					correct = false
					break
				}
			}

			for i, idx := range req.Order {
				years[i] = req.Events[idx].Year
			}

			// todo: add scoring (maybe)
			score := 0
			if correct {
				score = 1000
			}

			json.NewEncoder(w).Encode(map[string]interface{}{
				"correct": correct,
				"score":   score,
				"time":    0,
				"years":   years,
			})
			return
		}

		w.WriteHeader(http.StatusNotFound)
		fmt.Fprint(w, "404 not found")
	})
}
