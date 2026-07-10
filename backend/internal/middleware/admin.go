package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// AdminOnly returns a Gin middleware that checks if the authenticated user
// has the admin role. Must be used after JWTAuth middleware so that
// the "role" value is set in the context.
func AdminOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("role")
		if !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "admin required",
				"code":  "ERR_FORBIDDEN",
			})
			return
		}
		if role != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "admin required",
				"code":  "ERR_FORBIDDEN",
			})
			return
		}
		c.Next()
	}
}
