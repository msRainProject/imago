package main

import (
	"context"
	"fmt"
	stdfs "io/fs"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"hill-images/internal/config"
	"hill-images/internal/handler"
	"hill-images/internal/middleware"
	"hill-images/internal/models"
	"hill-images/internal/repository"
	"hill-images/internal/service"
	"hill-images/internal/storage"
	"hill-images/internal/web"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	_ "modernc.org/sqlite"
)

func isDevOrigin(origin string) bool {
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	host := u.Hostname()
	if host == "localhost" || host == "127.0.0.1" || host == "::1" {
		return true
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	return ip.IsPrivate()
}

func isConfiguredWebAuthnOrigin(origin string, configRepo *repository.ConfigRepo, fallback config.WebAuthnConfig) bool {
	effective := fallback
	if configRepo != nil {
		if resolved, err := configRepo.ResolveWebAuthnConfig(fallback); err == nil {
			effective = resolved
		}
	}

	for _, allowedOrigin := range effective.Origins() {
		if strings.EqualFold(origin, allowedOrigin) {
			return true
		}
	}
	return false
}

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	if err := config.EnsureDBDir(cfg.Database.Path); err != nil {
		log.Fatalf("Failed to create database directory: %v", err)
	}

	db, err := gorm.Open(sqlite.Dialector{DriverName: "sqlite", DSN: cfg.Database.Path}, &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	if err := db.AutoMigrate(
		&models.User{},
		&models.Image{},
		&models.Token{},
		&models.APIToken{},
		&models.ConfigEntry{},
		&models.JWTBlacklist{},
		&models.APIKey{},
	); err != nil {
		log.Fatalf("Failed to auto-migrate: %v", err)
	}

	userRepo := repository.NewUserRepo(db)
	imageRepo := repository.NewImageRepo(db)
	apiTokenRepo := repository.NewAPITokenRepo(db)
	apiKeyRepo := repository.NewAPIKeyRepo(db)
	configRepo := repository.NewConfigRepo(db)
	configRepo.SeedDefaults(cfg)
	if err := configRepo.ApplyRuntimeOverrides(cfg); err != nil {
		log.Fatalf("Failed to apply runtime config overrides: %v", err)
	}

	authService := service.NewAuthService(&cfg.JWT, userRepo, db)
	imageService := service.NewImageService(imageRepo)
	mediaProcessor := service.NewMediaProcessor("ffmpeg")
	mediaDependencyStatus := mediaProcessor.DependencyStatus()
	logMediaDependencyStatus(mediaDependencyStatus)
	statsService := service.NewStatsService(imageRepo, userRepo)

	store, err := buildStorage(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize storage: %v", err)
	}

	webauthnService, webauthnErr := service.NewWebAuthnService(&cfg.WebAuthn, configRepo, userRepo, authService)
	if webauthnErr != nil {
		log.Fatalf("Failed to initialize WebAuthn service: %v", webauthnErr)
	}
	webauthnService.StartCleanup(5 * time.Minute)

	adminHandler := handler.NewAdminHandler(userRepo, imageRepo, apiTokenRepo, apiKeyRepo, configRepo)
	authHandler := handler.NewAuthHandler(authService, webauthnService)
	imageHandler := handler.NewImageHandler(imageService)
	fileHandler := handler.NewFileHandler(imageService, mediaProcessor, statsService, configRepo, store, cfg, authService, apiTokenRepo, apiKeyRepo, userRepo)
	assetFS, err := stdfs.Sub(web.FS(), "assets")
	if err != nil {
		log.Fatalf("Failed to open embedded assets: %v", err)
	}

	r := gin.Default()
	r.MaxMultipartMemory = 100 << 20 // 100 MB

	r.Use(middleware.SecurityHeaders())

	r.Use(cors.New(cors.Config{
		AllowOriginFunc: func(origin string) bool {
			// Always allow the configured WebAuthn RP origins from admin config.
			if isConfiguredWebAuthnOrigin(origin, configRepo, cfg.WebAuthn) {
				return true
			}
			// Dev origins only when Gin is not in release mode (local development).
			if gin.Mode() != gin.ReleaseMode && isDevOrigin(origin) {
				return true
			}
			return false
		},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-CSRF-Token", "X-API-Token"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Global soft limit. Login/register get a stricter dedicated limiter below.
	// IMPORTANT: window is a time.Duration — always use time.Second (not bare int).
	rateLimiter := middleware.NewRateLimiter(120, 60*time.Second)
	r.Use(rateLimiter.Middleware())
	authRateLimiter := middleware.NewRateLimiter(20, 60*time.Second)

	r.GET("/api/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":             "ok",
			"service":            "hill-images",
			"media_dependencies": mediaDependencyStatus,
		})
	})
	r.StaticFS("/assets", http.FS(assetFS))

	spaHandler := gin.WrapH(web.Handler())
	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path
		// Only let ServeLocalPretty try paths that look like image direct
		// links: a single segment of alphanumerics (API-key uploads) or
		// a 4-digit year segment followed by a name. Everything else
		// (/, /login, /admin, /files, …) is handed to the SPA.
		if store.Driver() == storage.DriverLocal && looksLikeImagePath(path) {
			fileHandler.ServeLocalPretty(c)
			if c.Writer.Written() {
				return
			}
		}
		spaHandler(c)
	})

	api := r.Group("/api")
	{
		// All /api/auth routes consolidated into a single group.
		// Previously, three separate groups shared the /api/auth prefix
		// (auth, authProtected, authWebAuthnLogin), which caused Gin's
		// radix-tree router to create conflicting nodes. When a POST
		// hit /api/auth/login, Gin matched the path against the
		// authProtected group first (registered second, same prefix),
		// found no POST /login handler there, and returned 405.
		// Consolidating into one group with per-route middleware fixes
		// the conflict.
		auth := api.Group("/auth")
		{
			// Public auth routes (no JWT required). Stricter rate limit for brute-force resistance.
			auth.POST("/register", authRateLimiter.Middleware(), authHandler.Register)
			auth.POST("/login", authRateLimiter.Middleware(), authHandler.Login)
			auth.POST("/refresh", authRateLimiter.Middleware(), authHandler.Refresh)

			// Protected auth routes (JWT required — middleware applied per-route)
			auth.POST("/logout", middleware.JWTAuth(authService), authHandler.Logout)
			auth.GET("/profile", middleware.JWTAuth(authService), authHandler.GetProfile)
			auth.PATCH("/profile", middleware.JWTAuth(authService), authHandler.UpdateProfile)
			auth.PUT("/password", middleware.JWTAuth(authService), authHandler.ChangePassword)
			auth.GET("/webauthn/register/challenge", middleware.JWTAuth(authService), authHandler.WebAuthnRegisterChallenge)
			auth.POST("/webauthn/register/verify", middleware.JWTAuth(authService), authHandler.WebAuthnRegisterVerify)
			auth.GET("/webauthn/credentials", middleware.JWTAuth(authService), authHandler.ListPasskeyCredentials)
			auth.DELETE("/webauthn/credentials/:id", middleware.JWTAuth(authService), authHandler.DeletePasskeyCredential)

			// WebAuthn login (public — no JWT required)
			auth.GET("/webauthn/login/challenge", authRateLimiter.Middleware(), authHandler.WebAuthnLoginChallenge)
			auth.POST("/webauthn/login/verify", authRateLimiter.Middleware(), authHandler.WebAuthnLoginVerify)
		}

		images := api.Group("/images")
		images.Use(middleware.JWTAuth(authService))
		{
			images.GET("", imageHandler.List)
			images.GET("/:id", imageHandler.Get)
			images.POST("/upload", imageHandler.Upload)
			images.DELETE("/:id", imageHandler.Delete)
		}

		files := api.Group("/files")
		{
			files.GET("/:hash/thumb", fileHandler.OptionalAuth(), fileHandler.ServeThumb)

			filesProtected := files.Group("")
			filesProtected.Use(middleware.JWTOrAPIToken(authService, apiTokenRepo, apiKeyRepo, userRepo))
			{
				filesProtected.GET("", fileHandler.List)
				filesProtected.GET("/:hash", fileHandler.Get)
				filesProtected.PATCH("/:hash", fileHandler.Rename)
				filesProtected.DELETE("/:hash", fileHandler.Delete)
				filesProtected.POST("/batch_delete", fileHandler.BatchDelete)
			}
		}

		api.POST("/upload", middleware.JWTOrAPIToken(authService, apiTokenRepo, apiKeyRepo, userRepo), fileHandler.Upload)
		api.GET("/upload/options", fileHandler.UploadOptions)

		api.GET("/stats", fileHandler.Stats)

		admin := api.Group("/admin")
		admin.Use(middleware.JWTAuth(authService), middleware.AdminOnly())
		{
			admin.GET("/users", adminHandler.ListUsers)
			admin.POST("/users", adminHandler.CreateUser)
			admin.PATCH("/users/:id", adminHandler.UpdateUser)
			admin.DELETE("/users/:id", adminHandler.DeleteUser)
			admin.GET("/tokens", adminHandler.ListTokens)
			admin.POST("/tokens", adminHandler.CreateToken)
			admin.DELETE("/tokens/:id", adminHandler.DeleteToken)
			admin.GET("/api-keys", adminHandler.ListAPIKeys)
			admin.POST("/api-keys", adminHandler.CreateAPIKey)
			admin.DELETE("/api-keys/:id", adminHandler.DeleteAPIKey)
			admin.GET("/config", adminHandler.GetConfig)
			admin.PUT("/config", adminHandler.UpdateConfig)
		}
	}

	// PHP-compatible file manager routes
	phpApp := r.Group("/app")
	{
		phpApp.GET("/file_manager_api.php", fileHandler.PHPList)
		phpApp.POST("/file_manager_api.php", fileHandler.PHPFileManagerAction)

		// PHP-compatible WebAuthn routes
		phpApp.GET("/passkey_challenge.php", authHandler.PHPChallenge)
		phpApp.POST("/passkey_verify.php", authHandler.PHPVerify)
		phpApp.GET("/passkey_creation_challenge.php", authHandler.PHPRegChallenge)
		phpApp.POST("/passkey_register.php", authHandler.PHPRegister)
	}

	addr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)
	fmt.Printf("Hill Images API running on %s (storage=%s)\n", addr, store.Driver())
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func logMediaDependencyStatus(statuses []service.MediaDependencyStatus) {
	for _, status := range statuses {
		if status.Installed {
			log.Printf("media dependency: %s found at %s", status.Name, status.Path)
			continue
		}
		level := "optional"
		if status.Required {
			level = "required"
		}
		log.Printf("media dependency: %s missing (%s, package=%s). Install with: %s", status.Name, level, status.DebianPackage, status.InstallCommand)
	}
}

// buildStorage constructs the storage driver selected by config. The local
// driver is the default; when storage.driver == "r2" we build an R2-backed
// driver that talks to Cloudflare's S3-compatible endpoint. When
// storage.driver == "s3" we build a generic S3-compatible driver that works
// with any S3-compatible service. The Upyun driver is intentionally a no-op
// stub: it is accepted in the config file for backwards compatibility but
// main.go refuses to start with it.
func buildStorage(cfg *config.Config) (storage.Storage, error) {
	switch cfg.Storage.Driver {
	case storage.DriverR2:
		log.Printf("storage: using R2 (bucket=%s, account=%s)", cfg.Storage.R2.Bucket, cfg.Storage.R2.AccountID)
		return storage.NewR2Storage(context.Background(), storage.R2Config{
			AccountID:       cfg.Storage.R2.AccountID,
			Bucket:          cfg.Storage.R2.Bucket,
			AccessKeyID:     cfg.Storage.R2.AccessKeyID,
			SecretAccessKey: cfg.Storage.R2.SecretAccessKey,
			PublicBaseURL:   cfg.Storage.R2.PublicBaseURL,
			Region:          cfg.Storage.R2.Region,
		})
	case storage.DriverS3:
		log.Printf("storage: using generic S3 (endpoint=%s, bucket=%s)", cfg.Storage.S3.Endpoint, cfg.Storage.S3.Bucket)
		return storage.NewS3Storage(context.Background(), storage.S3Config{
			Endpoint:        cfg.Storage.S3.Endpoint,
			Region:          cfg.Storage.S3.Region,
			Bucket:          cfg.Storage.S3.Bucket,
			AccessKeyID:     cfg.Storage.S3.AccessKeyID,
			SecretAccessKey: cfg.Storage.S3.SecretAccessKey,
			PublicBaseURL:   cfg.Storage.S3.PublicBaseURL,
			KeyPrefix:       cfg.Storage.S3.KeyPrefix,
			ThumbPrefix:     cfg.Storage.S3.ThumbPrefix,
			UsePathStyle:    cfg.Storage.S3.UsePathStyle,
		})
	case storage.DriverLocal, "":
		log.Printf("storage: using local disk (%s, template=%q)", cfg.Server.StaticPath, cfg.Storage.Local.PathTemplate)
		return storage.NewLocalStorageWithConfig(storage.LocalConfig{
			BasePath:      cfg.Server.StaticPath,
			ThumbPath:     cfg.Server.ThumbPath,
			PathTemplate:  cfg.Storage.Local.PathTemplate,
			PublicBaseURL: cfg.Storage.Local.PublicBaseURL,
		})
	default:
		return nil, fmt.Errorf("unsupported storage driver %q (supported: local, r2, s3)", cfg.Storage.Driver)
	}
}

// looksLikeImagePath reports whether a URL path should be dispatched to the
// local pretty-name image handler rather than the SPA. Two shapes qualify:
//
//   - "/2026/<name>"        — 4-digit year segment followed by a name
//   - "/<single-segment>"   — a bare hash-style name (API-key uploads)
//
// Everything else (/, /login, /admin, /favicon.ico, /files, …) is left for
// the SPA so client-side routing keeps working.
func looksLikeImagePath(path string) bool {
	if len(path) < 2 || path[0] != '/' {
		return false
	}
	trimmed := path[1:]
	// Reject anything with a file extension — those are static assets, not
	// image direct links (image links are extensionless by design).
	if strings.Contains(trimmed, ".") {
		return false
	}
	segments := strings.Split(trimmed, "/")
	switch len(segments) {
	case 1:
		// Bare single segment: must look like a hash-style name (alnum only,
		// length in the 16–40 range to avoid matching short SPA routes like
		// /login or /files).
		return len(segments[0]) >= 16 && isAlphaNum(segments[0])
	case 2:
		// Year + name: first segment must be a 4-digit year, second must be
		// a non-empty hash-style name.
		return len(segments[0]) == 4 && isAllDigits(segments[0]) && len(segments[1]) >= 12
	default:
		return false
	}
}

func isAlphaNum(s string) bool {
	for _, ch := range s {
		if !((ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) {
			return false
		}
	}
	return true
}

func isAllDigits(s string) bool {
	for _, ch := range s {
		if ch < '0' || ch > '9' {
			return false
		}
	}
	return true
}
