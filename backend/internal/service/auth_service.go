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

func (s *AuthService) Register(username, password string) (*RegisterResult, error) {
	count, err := s.userRepo.Count()
	if err != nil {
		return nil, err
	}

	role := "user"
	if count == 0 {
		role = "admin"
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	if err != nil {
		return nil, err
	}

	user := &models.User{
		Username:     username,
		PasswordHash: string(hash),
		Role:         role,
	}
	if err := s.userRepo.Create(user); err != nil {
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
		return []byte(s.cfg.Secret), nil
	})
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
