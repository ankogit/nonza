package rest

import (
	"strings"

	"github.com/gin-gonic/gin"
	"nonza/backend/internal/service"
)

const UserIDContextKey = "user_id"

func AuthMiddleware(services *service.Services) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			c.Next()
			return
		}

		userID, err := services.Auth.ParseToken(parts[1])
		if err != nil {
			c.Next()
			return
		}

		c.Set(UserIDContextKey, userID)
		c.Next()
	}
}
