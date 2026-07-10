package middleware

import (
	"crypto/subtle"
	"net/http"

	"github.com/gin-gonic/gin"
)

// CSRF returns a Gin middleware that validates a CSRF token header
// for all mutating requests (POST, PUT, PATCH, DELETE).
func CSRF(headerName string, tokenProvider func(c *gin.Context) string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == http.MethodGet || c.Request.Method == http.MethodHead || c.Request.Method == http.MethodOptions {
			c.Next()
			return
		}
		sentToken := c.GetHeader(headerName)
		expectedToken := tokenProvider(c)
		if sentToken == "" || expectedToken == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "csrf token missing"})
			return
		}
		if subtle.ConstantTimeCompare([]byte(sentToken), []byte(expectedToken)) != 1 {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "csrf token mismatch"})
			return
		}
		c.Next()
	}
}
