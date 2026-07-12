package service

import (
	"errors"
	"time"

	"hill-images/internal/config"
	"hill-images/internal/models"
	"hill-images/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const bcryptCost = 12

type AuthService struct {
	cfg      *config.JWTConfig
	userRepo *repository.UserRepo
	db       *gorm.DB
}

func NewAuthService(cfg *config.JWTConfig, userRepo *repository.UserRepo, db *gorm.DB) *AuthService {
	return &AuthService{cfg: cfg, userRepo: userRepo, db: db}
}

type Claims struct {
	UserID   uuid.UUID `json:"user_id"`
	Username string    `json:"username"`
	Role     string    `json:"role"`
	jwt.RegisteredClaims
}

type RegisterResult struct {
	Token string       `json:"token"`
	User  UserResponse `json:"user"`
}

type UserResponse struct {
	ID       uuid.UUID `json:"id"`
	Username string    `json:"username"`
	Role     string    `json:"role"`
}

// ErrRegistrationClosed is returned when public self-registration is no longer
// allowed (any user already exists). The first account remains open so a fresh
// install can bootstrap an admin.
var ErrRegistrationClosed = errors.New("registration is closed; ask an administrator to create an account")

// ErrWeakPassword is returned when a password fails the shared policy.
var ErrWeakPassword = errors.New("password must be at least 8 characters")

// MinPasswordLength is the shared minimum for register / change-password /
// admin create-user paths.
const MinPasswordLength = 8

func ValidatePassword(password string) error {
	if len(password) < MinPasswordLength {
		return ErrWeakPassword
	}
	return nil
}

func (s *AuthService) Register(username, password string) (*RegisterResult, error) {
	if err := ValidatePassword(password); err != nil {
		return nil, err
	}

	// Serialize first-user bootstrap so concurrent POSTs cannot both observe
	// count==0 and both become admin. After the first user exists, reject
	// further public registration — admins create accounts via /api/admin/users.
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			panic(r)
		}
	}()

	var count int64
	if err := tx.Model(&models.User{}).Count(&count).Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	if count > 0 {
		tx.Rollback()
		return nil, ErrRegistrationClosed
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	if err != nil {
		tx.Rollback()
		return nil, err
	}

	user := &models.User{
		Username:     username,
		PasswordHash: string(hash),
		Role:         "admin", // first (and only public) registration
	}
	if err := tx.Create(user).Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	token, err := s.GenerateToken(user)
	if err != nil {
		return nil, err
	}

	return &RegisterResult{
		Token: token,
		User: UserResponse{
			ID:       user.ID,
			Username: user.Username,
			Role:     user.Role,
		},
	}, nil
}

func (s *AuthService) Login(username, password string) (*RegisterResult, error) {
	user, err := s.userRepo.FindByUsername(username)
	if err != nil {
		return nil, errors.New("invalid credentials")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, errors.New("invalid credentials")
	}

	now := time.Now()
	user.LastLoginAt = &now
	_ = s.userRepo.Update(user)

	token, err := s.GenerateToken(user)
	if err != nil {
		return nil, err
	}

	return &RegisterResult{
		Token: token,
		User: UserResponse{
			ID:       user.ID,
			Username: user.Username,
			Role:     user.Role,
		},
	}, nil
}

func (s *AuthService) GenerateToken(user *models.User) (string, error) {
	now := time.Now()
	expiry := time.Duration(s.cfg.ExpiryHours) * time.Hour
	claims := &Claims{
		UserID:   user.ID,
		Username: user.Username,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.New().String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(expiry)),
			Subject:   user.ID.String(),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.cfg.Secret))
}

func (s *AuthService) ParseToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(s.cfg.Secret), nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}

	var count int64
	s.db.Model(&models.JWTBlacklist{}).Where("token_jti = ?", claims.ID).Count(&count)
	if count > 0 {
		return nil, errors.New("token revoked")
	}

	return claims, nil
}

func (s *AuthService) ParseTokenUnverified(tokenStr string) (*Claims, error) {
	parser := jwt.NewParser(jwt.WithoutClaimsValidation())
	token, _, err := parser.ParseUnverified(tokenStr, &Claims{})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok {
		return nil, errors.New("invalid token claims")
	}
	return claims, nil
}

func (s *AuthService) BlacklistToken(jti string, expiresAt time.Time) error {
	entry := &models.JWTBlacklist{
		TokenJTI:  jti,
		ExpiresAt: expiresAt,
	}
	return s.db.Create(entry).Error
}

func (s *AuthService) FindUserByID(id uuid.UUID) (*models.User, error) {
	return s.userRepo.FindByID(id)
}

func (s *AuthService) FindUserByUsername(username string) (*models.User, error) {
	return s.userRepo.FindByUsername(username)
}

func (s *AuthService) UpdateUser(user *models.User) error {
	return s.userRepo.Update(user)
}

func (s *AuthService) ListAllUsers() ([]models.User, error) {
	return s.userRepo.ListAll()
}
