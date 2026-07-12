package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	// SessionCookie is the HttpOnly JWT cookie used by the web UI.
	SessionCookie = "hill_session"
	// CSRFCookie is a non-HttpOnly double-submit token readable by JS.
	CSRFCookie = "hill_csrf"
	// CSRFHeader is the request header that must match CSRFCookie.
	CSRFHeader = "X-CSRF-Token"
)

// secureCookie reports whether cookies should set the Secure flag.
func secureCookie(c *gin.Context) bool {
	if c.Request.TLS != nil {
		return true
	}
	return strings.EqualFold(c.GetHeader("X-Forwarded-Proto"), "https")
}

// SetSessionCookie writes the JWT as an HttpOnly cookie.
func SetSessionCookie(c *gin.Context, token string, maxAge time.Duration) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     SessionCookie,
		Value:    token,
		Path:     "/",
		MaxAge:   int(maxAge.Seconds()),
		HttpOnly: true,
		Secure:   secureCookie(c),
		SameSite: http.SameSiteLaxMode,
	})
}

// ClearSessionCookie expires the session cookie.
func ClearSessionCookie(c *gin.Context) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     SessionCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   secureCookie(c),
		SameSite: http.SameSiteLaxMode,
	})
}

// EnsureCSRFCookie issues a CSRF cookie when missing and returns its value.
func EnsureCSRFCookie(c *gin.Context) string {
	if cookie, err := c.Cookie(CSRFCookie); err == nil && cookie != "" {
		return cookie
	}
	token, err := randomToken(32)
	if err != nil {
		return ""
	}
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     CSRFCookie,
		Value:    token,
		Path:     "/",
		MaxAge:   int((24 * time.Hour).Seconds()),
		HttpOnly: false, // readable by frontend for double-submit
		Secure:   secureCookie(c),
		SameSite: http.SameSiteLaxMode,
	})
	return token
}

// ClearCSRFCookie expires the CSRF cookie (e.g. on logout).
func ClearCSRFCookie(c *gin.Context) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     CSRFCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: false,
		Secure:   secureCookie(c),
		SameSite: http.SameSiteLaxMode,
	})
}

// CSRFCookieIssuer ensures every response can carry a CSRF cookie for the SPA.
func CSRFCookieIssuer() gin.HandlerFunc {
	return func(c *gin.Context) {
		EnsureCSRFCookie(c)
		c.Next()
	}
}

// CSRFProtect enforces the double-submit cookie pattern on mutating requests
// that authenticate via the session cookie. Pure Bearer / API-token clients
// (no session cookie) are exempt so machine integrations keep working.
func CSRFProtect() gin.HandlerFunc {
	return func(c *gin.Context) {
		switch c.Request.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			c.Next()
			return
		}

		session, err := c.Cookie(SessionCookie)
		if err != nil || session == "" {
			// No browser session cookie → not a cookie-authenticated request.
			c.Next()
			return
		}

		// Machine clients that also send a Bearer token still need CSRF if they
		// carry the session cookie (browser case). API keys use Authorization
		// app_... without a session cookie, so they skip this block above.

		sent := c.GetHeader(CSRFHeader)
		expected, _ := c.Cookie(CSRFCookie)
		if sent == "" || expected == "" || subtleConstantTimeEq(sent, expected) == false {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"code":    http.StatusForbidden,
				"error":   "CSRF_FAILED",
				"message": "csrf token missing or mismatch",
			})
			return
		}
		c.Next()
	}
}

func subtleConstantTimeEq(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	var v byte
	for i := 0; i < len(a); i++ {
		v |= a[i] ^ b[i]
	}
	return v == 0
}

func randomToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// BearerOrCookieToken extracts a JWT from Authorization: Bearer or the session cookie.
func BearerOrCookieToken(c *gin.Context) string {
	authHeader := c.GetHeader("Authorization")
	if authHeader != "" {
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) == 2 && strings.EqualFold(parts[0], "bearer") {
			token := strings.TrimSpace(parts[1])
			// Leave app_ keys to JWTOrAPIToken; cookie path only wants JWTs.
			if token != "" && !strings.HasPrefix(token, "app_") {
				return token
			}
			// app_ keys fall through; caller middleware handles them.
			if strings.HasPrefix(token, "app_") {
				return token
			}
		}
	}
	if cookie, err := c.Cookie(SessionCookie); err == nil {
		return strings.TrimSpace(cookie)
	}
	return ""
}
