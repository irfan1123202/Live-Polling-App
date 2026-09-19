package routes

import (
	"live-polling-backend/controllers"
	"live-polling-backend/middleware"
	"live-polling-backend/websocket"

	"github.com/gin-gonic/gin"
)

func SetupRouter(
	jwtSecret string,
	frontendURL string,
	authCtrl *controllers.AuthController,
	pollCtrl *controllers.PollController,
	voteCtrl *controllers.VoteController,
	hub *websocket.Hub,
) *gin.Engine {
	r := gin.Default()

	// Use CORS middleware
	r.Use(middleware.CORSMiddleware(frontendURL))

	api := r.Group("/api")
	{
		// Health check
		api.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{"status": "ok", "message": "Live Polling Engine operational"})
		})

		// Authentication routes
		auth := api.Group("/auth")
		{
			auth.POST("/signup", authCtrl.Signup)
			auth.POST("/login", authCtrl.Login)
			auth.POST("/reset-password", authCtrl.ResetPassword)
			auth.GET("/me", middleware.AuthMiddleware(jwtSecret), authCtrl.Me)
		}

		// Polls routes
		polls := api.Group("/polls")
		{
			// Public poll lookup & voting
			polls.GET("/share/:shareCode", pollCtrl.GetPollByShareCode)
			polls.GET("/:id", pollCtrl.GetPollByID)
			polls.POST("/:id/vote", voteCtrl.CastVote)
			polls.GET("/:id/results", voteCtrl.GetResults)

			// Real-time WebSocket endpoint
			polls.GET("/:id/live", func(c *gin.Context) {
				websocket.ServeWS(hub, c)
			})

			// Protected routes (requires auth token)
			protected := polls.Group("")
			protected.Use(middleware.AuthMiddleware(jwtSecret))
			{
				protected.POST("", pollCtrl.CreatePoll)
				protected.GET("", pollCtrl.GetUserPolls)
				protected.DELETE("/:id", pollCtrl.DeletePoll)
				protected.PATCH("/:id/status", pollCtrl.TogglePollStatus)
			}
		}
	}

	return r
}
