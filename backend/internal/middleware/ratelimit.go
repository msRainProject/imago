package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimiter provides per-IP rate limiting.
type RateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*visitorInfo
	rate     int
	window   time.Duration
}

type visitorInfo struct {
	count    int
	lastSeen time.Time
}

// NewRateLimiter creates a RateLimiter allowing `rate` requests per `window`.
func NewRateLimiter(rate int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		visitors: make(map[string]*visitorInfo),
		rate:     rate,
		window:   window,
	}
}

// Middleware returns a Gin middleware for rate limiting.
func (rl *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		rl.mu.Lock()
		v, exists := rl.visitors[ip]
		if !exists || time.Since(v.lastSeen) > rl.window {
			rl.visitors[ip] = &visitorInfo{count: 1, lastSeen: time.Now()}
			rl.mu.Unlock()
			c.Next()
			return
		}
		v.count++
		v.lastSeen = time.Now()
		if v.count > rl.rate {
			rl.mu.Unlock()
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"code": http.StatusTooManyRequests, "error": "RATE_LIMITED", "message": "rate limit exceeded"})
			return
		}
		rl.mu.Unlock()
		c.Next()
	}
}
