// Package web embeds the React frontend dist into the Go binary so a single
// hill-api binary can serve both the API and the SPA.
//
// Source of truth is ../frontend/dist/. Run `make build` (or the build.sh
// script) before `go build` to refresh the embedded tree. The //go:embed
// directive only re-runs when the source files in this directory change; an
// out-of-date dist will not trigger a rebuild.
package web

import (
	"embed"
	"io/fs"
	"net/http"
	"strings"
)

//go:embed all:dist
var distFS embed.FS

// FS returns the embedded filesystem rooted at the dist/ directory.
// It strips the "dist" prefix so callers can treat the result as the
// frontend root (i.e. /index.html, /assets/...).
func FS() fs.FS {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		panic("web: dist/ subdirectory missing from embed: " + err.Error())
	}
	return sub
}

// Handler returns an http.Handler that serves the embedded SPA. Any path
// that does not match a real file falls back to /index.html (SPA routing).
// The fallback is gated on a "text/html" Accept header so JSON API clients
// still get a clean 404 instead of the SPA shell.
func Handler() http.Handler {
	root := FS()
	fileServer := http.FileServer(http.FS(root))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Reject obvious API paths so they never get masked by the SPA fallback.
		// Real API routing is registered separately in main.go, but if a path
		// slips through (e.g. a typo), we want a 404 rather than index.html.
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}

		// Serve the file directly if it exists in the embed.
		cleanPath := strings.TrimPrefix(r.URL.Path, "/")
		if cleanPath == "" {
			cleanPath = "index.html"
		}
		if _, err := fs.Stat(root, cleanPath); err == nil {
			fileServer.ServeHTTP(w, r)
			return
		}

		// SPA fallback for client-side routes — only when the client accepts HTML.
		if acceptsHTML(r) {
			data, err := fs.ReadFile(root, "index.html")
			if err != nil {
				http.Error(w, "index.html missing from embed", http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Header().Set("Cache-Control", "no-cache")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(data)
			return
		}

		http.NotFound(w, r)
	})
}

func acceptsHTML(r *http.Request) bool {
	accept := r.Header.Get("Accept")
	if accept == "" {
		return false
	}
	return strings.Contains(accept, "text/html") || strings.Contains(accept, "*/*")
}
