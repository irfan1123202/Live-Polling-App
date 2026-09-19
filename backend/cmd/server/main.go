package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"

	"live-polling-backend/config"
	"live-polling-backend/controllers"
	"live-polling-backend/repository"
	"live-polling-backend/routes"
	"live-polling-backend/services"
	"live-polling-backend/websocket"

	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func main() {
	cfg := config.LoadConfig()

	log.Println("🚀 Starting Real-Time Live Polling Engine (Go + Gin + MongoDB + Redis)...")

	// MongoDB
	log.Printf("Connecting to MongoDB at %s...", cfg.MongoURI)

	clientOpts := options.Client().
		ApplyURI(cfg.MongoURI).
		SetServerSelectionTimeout(20 * time.Second).
		SetConnectTimeout(15 * time.Second)

	ctx, cancel := context.WithTimeout(
		context.Background(),
		25*time.Second,
	)
	defer cancel()

	mongoClient, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		log.Printf("⚠️ MongoDB connect error: %v", err)
	} else {
		pingCtx, pingCancel := context.WithTimeout(
			context.Background(),
			20*time.Second,
		)
		defer pingCancel()

		if pingErr := mongoClient.Ping(pingCtx, nil); pingErr != nil {
			log.Printf("⚠️ MongoDB ping failed: %v", pingErr)
			log.Println("→ Check MongoDB Atlas Network Access and Database User")
		} else {
			log.Println("🎉 Successfully connected to MongoDB Atlas!")
		}
	}

	defer func() {
		if mongoClient != nil {
			_ = mongoClient.Disconnect(context.Background())
		}
	}()

	// Redis
	log.Println("Connecting to Redis...")

	var redisClient *redis.Client
	opt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Printf("⚠️ Invalid Redis URL: %v", err)

		redisClient = redis.NewClient(&redis.Options{
			Addr: cfg.RedisURL,
		})
	} else {
		redisClient = redis.NewClient(opt)
	}

	redisCtx, redisCancel := context.WithTimeout(
		context.Background(),
		5*time.Second,
	)
	defer redisCancel()

	if pingErr := redisClient.Ping(redisCtx).Err(); pingErr != nil {
		log.Printf("⚠️ Redis ping failed: %v", pingErr)
	} else {
		log.Println("✅ Connected to Redis!")
	}

	defer redisClient.Close()

	// Repositories
	mongoRepo := repository.NewMongoRepository(
		mongoClient,
		cfg.MongoDBName,
	)

	redisRepo := repository.NewRedisRepository(redisClient)

	// Services
	authService := services.NewAuthService(
		mongoRepo,
		cfg.JWTSecret,
	)

	pollService := services.NewPollService(
		mongoRepo,
		redisRepo,
	)

	voteService := services.NewVoteService(
		mongoRepo,
		redisRepo,
		pollService,
	)

	// Controllers
	authCtrl := controllers.NewAuthController(authService)

	pollCtrl := controllers.NewPollController(pollService)

	voteCtrl := controllers.NewVoteController(
		voteService,
		pollService,
	)

	// WebSocket
	hub := websocket.NewHub(redisRepo)
	go hub.Run()

	// Router
	router := routes.SetupRouter(
		cfg.JWTSecret,
		cfg.FrontendURL,
		authCtrl,
		pollCtrl,
		voteCtrl,
		hub,
	)

	// HTTP Server
	srv := &http.Server{
		Addr:    fmt.Sprintf(":%s", cfg.Port),
		Handler: router,
	}

	go func() {
		log.Printf(
			"✅ Server listening on http://localhost:%s",
			cfg.Port,
		)

		log.Printf(
			"API: http://localhost:%s/api/health",
			cfg.Port,
		)

		log.Printf(
			"WS: ws://localhost:%s/api/polls/:id/live",
			cfg.Port,
		)

		if err := srv.ListenAndServe(); err != nil &&
			err != http.ErrServerClosed {
			log.Printf("Server error: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)

	signal.Notify(
		quit,
		os.Interrupt,
	)

	<-quit

	log.Println("Shutting down server gracefully...")

	shutdownCtx, shutdownCancel := context.WithTimeout(
		context.Background(),
		5*time.Second,
	)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf(
			"Server forced to shutdown: %v",
			err,
		)
	}

	log.Println("Server exited.")
}
