package middleware

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"

	"hill-images/internal/repository"
	"hill-images/internal/service"

	"github.com/gin-gonic/gin"
)

// JWTOrAPIToken accepts either a Bearer JWT, a session cookie JWT,
// an X-API-Token header (hill_ tokens), or an Authorization: Bearer app_<hex> API key.
func JWTOrAPIToken(authService *service.AuthService, apiTokenRepo *repository.APITokenRepo, apiKeyRepo *repository.APIKeyRepo, userRepo *repository.UserRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && strings.EqualFold(parts[0], "bearer") {
				token := strings.TrimSpace(parts[1])

				if strings.HasPrefix(token, "app_") {
					hash := sha256.Sum256([]byte(token))
					tokenHash := hex.EncodeToString(hash[:])

					keyRecord, err := apiKeyRepo.FindByTokenHash(tokenHash)
					if err == nil {
						user, userErr := userRepo.FindByID(keyRecord.UserID)
						if userErr == nil {
							c.Set("user_id", user.ID)
							c.Set("username", user.Username)
							c.Set("role", user.Role)
							c.Set("api_key_id", keyRecord.ID)
							c.Set("api_key_name", keyRecord.Name)
							c.Next()
							return
						}
					}
					c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": http.StatusUnauthorized, "error": "AUTH_FAILED", "message": "invalid api key"})
					return
				}

				claims, err := authService.ParseToken(token)
				if err == nil {
					c.Set("user_id", claims.UserID)
					c.Set("username", claims.Username)
					c.Set("role", claims.Role)
					c.Set("auth_token", token)
					c.Next()
					return
				}
			}
		}

		// Session cookie JWT (browser UI).
		if cookie, err := c.Cookie(SessionCookie); err == nil && cookie != "" {
			claims, err := authService.ParseToken(cookie)
			if err == nil {
				c.Set("user_id", claims.UserID)
				c.Set("username", claims.Username)
				c.Set("role", claims.Role)
				c.Set("auth_token", cookie)
				c.Next()
				return
			}
		}

		// Try X-API-Token (opaque hill_<hex> — hash-lookup, NOT a JWT)
		apiToken := c.GetHeader("X-API-Token")
		if apiToken != "" {
			hash := sha256.Sum256([]byte(apiToken))
			tokenHash := hex.EncodeToString(hash[:])

			tokenRecord, err := apiTokenRepo.FindByTokenHash(tokenHash)
			if err == nil {
				user, userErr := userRepo.FindByID(tokenRecord.UserID)
				if userErr == nil {
					c.Set("user_id", user.ID)
					c.Set("username", user.Username)
					c.Set("role", user.Role)
					_ = apiTokenRepo.UpdateLastUsed(tokenRecord.ID)
					c.Next()
					return
				}
			}
		}

		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": http.StatusUnauthorized, "error": "AUTH_FAILED", "message": "unauthorized"})
	}
}
