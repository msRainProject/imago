package middleware

import "github.com/gin-gonic/gin"

// SecurityHeaders sets a conservative baseline of browser security headers.
// Content-Security-Policy is intentionally modest so the embedded SPA and
// third-party-free admin UI keep working; tighten further behind a reverse
// proxy if needed.
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.Writer.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		// Only force HTTPS awareness when the request already arrived over TLS
		// or a trusted proxy marked it as such — avoid breaking plain HTTP dev.
		if c.Request.TLS != nil || c.GetHeader("X-Forwarded-Proto") == "https" {
			h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}
		c.Next()
	}
}
