package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"hill-images/internal/config"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	if err := config.EnsureDBDir(cfg.Database.Path); err != nil {
		log.Fatalf("Failed to create database directory: %v", err)
	}

	db, err := gorm.Open(sqlite.Open(cfg.Database.Path), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	migrationsDir := "migrations"
	if _, err := os.Stat(migrationsDir); os.IsNotExist(err) {
		// Try relative to binary location
		exePath, _ := os.Executable()
		migrationsDir = filepath.Join(filepath.Dir(exePath), "migrations")
	}

	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		log.Fatalf("Failed to read migrations directory: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("Failed to get underlying sql.DB: %v", err)
	}

	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".sql" {
			continue
		}
		migrationPath := filepath.Join(migrationsDir, entry.Name())
		content, err := os.ReadFile(migrationPath)
		if err != nil {
			log.Printf("Failed to read migration %s: %v", entry.Name(), err)
			continue
		}
		if _, err := sqlDB.Exec(string(content)); err != nil {
			log.Printf("Failed to execute migration %s: %v", entry.Name(), err)
			continue
		}
		fmt.Printf("Applied migration: %s\n", entry.Name())
	}

	fmt.Println("Migration completed successfully.")
}
