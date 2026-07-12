package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimiter provides per-IP fixed-window rate limiting with periodic GC.
type RateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*visitorInfo
	rate     int
	window   time.Duration
	stopGC   chan struct{}
}

type visitorInfo struct {
	count    int
	windowAt time.Time
}

// NewRateLimiter creates a RateLimiter allowing `rate` requests per `window`.
// window must be a positive duration (e.g. 60*time.Second). Values less than
// one second are clamped to one second so a bare integer can never silently
// become a nanosecond window again.
func NewRateLimiter(rate int, window time.Duration) *RateLimiter {
	if rate < 1 {
		rate = 1
	}
	if window < time.Second {
		window = time.Second
	}
	rl := &RateLimiter{
		visitors: make(map[string]*visitorInfo),
		rate:     rate,
		window:   window,
		stopGC:   make(chan struct{}),
	}
	go rl.gcLoop()
	return rl
}

func (rl *RateLimiter) gcLoop() {
	// Sweep at most once per window, never more often than every 30s.
	interval := rl.window
	if interval < 30*time.Second {
		interval = 30 * time.Second
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			rl.mu.Lock()
			cutoff := time.Now().Add(-2 * rl.window)
			for ip, v := range rl.visitors {
				if v.windowAt.Before(cutoff) {
					delete(rl.visitors, ip)
				}
			}
			rl.mu.Unlock()
		case <-rl.stopGC:
			return
		}
	}
}

// Stop terminates the background GC goroutine. Optional; process exit is fine.
func (rl *RateLimiter) Stop() {
	select {
	case <-rl.stopGC:
	default:
		close(rl.stopGC)
	}
}

// Middleware returns a Gin middleware for rate limiting.
func (rl *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		now := time.Now()

		rl.mu.Lock()
		v, exists := rl.visitors[ip]
		if !exists || now.Sub(v.windowAt) > rl.window {
			rl.visitors[ip] = &visitorInfo{count: 1, windowAt: now}
			rl.mu.Unlock()
			c.Next()
			return
		}
		v.count++
		if v.count > rl.rate {
			rl.mu.Unlock()
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"code":    http.StatusTooManyRequests,
				"error":   "RATE_LIMITED",
				"message": "rate limit exceeded",
			})
			return
		}
		rl.mu.Unlock()
		c.Next()
	}
}
