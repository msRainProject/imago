package middleware

import (
	"net/http"
	"strings"

	"hill-images/internal/service"

	"github.com/gin-gonic/gin"
)

// JWTAuth returns a Gin middleware that validates JWT tokens from the
// Authorization: Bearer header or the HttpOnly session cookie.
func JWTAuth(authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr := ""

		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && strings.EqualFold(parts[0], "bearer") {
				tokenStr = strings.TrimSpace(parts[1])
			}
		}
		if tokenStr == "" {
			if cookie, err := c.Cookie(SessionCookie); err == nil {
				tokenStr = strings.TrimSpace(cookie)
			}
		}
		if tokenStr == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": http.StatusUnauthorized, "error": "AUTH_FAILED", "message": "missing authorization header"})
			return
		}
		// app_ keys are not JWTs — reject here so AdminOnly routes stay JWT-only.
		if strings.HasPrefix(tokenStr, "app_") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": http.StatusUnauthorized, "error": "AUTH_FAILED", "message": "invalid token"})
			return
		}

		claims, err := authService.ParseToken(tokenStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": http.StatusUnauthorized, "error": "AUTH_FAILED", "message": "invalid token"})
			return
		}
		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("role", claims.Role)
		c.Set("auth_token", tokenStr)
		c.Next()
	}
}
