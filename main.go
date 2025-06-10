package main

import (
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"strconv"
	"time"

	spinhttp "github.com/fermyon/spin/sdk/go/v2/http"
)

type WikiEvent struct {
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Date        time.Time `json:"date"`
	Year        int       `json:"year"`
	ImageURL    string    `json:"imageUrl,omitempty"`
}

var (
	dailyEvents    []WikiEvent
	dailyTimestamp time.Time
	gameRnd        = rand.New(rand.NewSource(time.Now().UnixNano()))
	dailyRnd       = rand.New(rand.NewSource(0))
)

func getImages(title string) string {
	url := fmt.Sprintf("https://en.wikipedia.org/w/api.php?action=query&titles=%s&prop=pageimages&format=json&pithumbsize=300", url.QueryEscape(title))
	resp, _ := spinhttp.Get(url)
	defer resp.Body.Close()

	var result struct {
		Query struct {
			Pages map[string]struct {
				Thumbnail struct {
					Source string `json:"source"`
				} `json:"thumbnail"`
			} `json:"pages"`
		} `json:"query"`
	}

	json.NewDecoder(resp.Body).Decode(&result)
	for _, page := range result.Query.Pages {
		if page.Thumbnail.Source != "" {
			return page.Thumbnail.Source
		}
	}
	return ""
}

func fetchEvents(mode int) []WikiEvent {
	now := time.Now()
	var targetDate time.Time

	if mode == 0 {
		// daily
		targetDate = now
	} else {
		// random
		startOfYear := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, time.UTC)
		randomDays := gameRnd.Intn(365)
		targetDate = startOfYear.AddDate(0, 0, randomDays)
	}

	url := fmt.Sprintf("https://byabbe.se/on-this-day/%d/%d/events.json",
		targetDate.Month(), targetDate.Day())
	resp, _ := spinhttp.Get(url)
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

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
	json.Unmarshal(body, &apiResp)

	validEvents := make([]WikiEvent, 0, len(apiResp.Events))
	for _, e := range apiResp.Events {
		year, _ := strconv.Atoi(e.Year)
		if year <= 0 || year > time.Now().Year() {
			continue
		}

		date := time.Date(year, targetDate.Month(), targetDate.Day(), 0, 0, 0, 0, time.UTC)
		title := e.Description
		if len(e.Wikipedia) > 0 && e.Wikipedia[0].Title != "" {
			title = e.Wikipedia[0].Title
		}

		if e.Description == "" {
			continue
		}

		validEvents = append(validEvents, WikiEvent{
			Title:       title,
			Description: e.Description,
			Date:        date,
			Year:        year,
		})
	}

	// check mode
	if mode == 0 {
		dailyRnd.Shuffle(len(validEvents), func(i, j int) {
			validEvents[i], validEvents[j] = validEvents[j], validEvents[i]
		})
	} else {
		gameRnd.Shuffle(len(validEvents), func(i, j int) {
			validEvents[i], validEvents[j] = validEvents[j], validEvents[i]
		})
	}

	numEvents := 5
	if len(validEvents) < numEvents {
		numEvents = len(validEvents)
	}

	for i := 0; i < numEvents; i++ {
		validEvents[i].ImageURL = getImages(validEvents[i].Title)
	}

	return validEvents[:numEvents]
}

// api handlers
func init() {
	spinhttp.Handle(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		if r.URL.Path == "/api/new-game" {
			events := fetchEvents(1)
			json.NewEncoder(w).Encode(struct {
				Events []WikiEvent `json:"events"`
			}{
				Events: events,
			})
			return
		}

		if r.URL.Path == "/api/daily-challenge" {
			events := fetchEvents(0)
			json.NewEncoder(w).Encode(struct {
				Events []WikiEvent `json:"events"`
			}{
				Events: events,
			})
			return
		}

		if r.URL.Path == "/api/check-order" {
			var req struct {
				Order  []int       `json:"order"`
				Events []WikiEvent `json:"events"`
			}
			json.NewDecoder(r.Body).Decode(&req)

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
