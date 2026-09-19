package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"live-polling-backend/models"
	"live-polling-backend/repository"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type PollService struct {
	mongoRepo *repository.MongoRepository
	redisRepo *repository.RedisRepository
}

func NewPollService(mongoRepo *repository.MongoRepository, redisRepo *repository.RedisRepository) *PollService {
	return &PollService{
		mongoRepo: mongoRepo,
		redisRepo: redisRepo,
	}
}

func generateShareCode() string {
	bytes := make([]byte, 3)
	if _, err := rand.Read(bytes); err != nil {
		return strings.ToUpper(primitive.NewObjectID().Hex()[:6])
	}
	return strings.ToUpper(hex.EncodeToString(bytes))
}

func (s *PollService) CreatePoll(ctx context.Context, creatorID primitive.ObjectID, req models.CreatePollRequest) (*models.Poll, error) {
	// Validate options
	if len(req.Options) < 2 {
		return nil, errors.New("poll must have at least 2 options")
	}
	if len(req.Options) > 10 {
		return nil, errors.New("poll can have at most 10 options")
	}

	seenOptions := make(map[string]bool)
	optionsList := make([]models.Option, 0, len(req.Options))
	for i, optText := range req.Options {
		trimmed := strings.TrimSpace(optText)
		if trimmed == "" {
			return nil, errors.New("option text cannot be empty")
		}
		lower := strings.ToLower(trimmed)
		if seenOptions[lower] {
			return nil, errors.New("duplicate option texts are not allowed")
		}
		seenOptions[lower] = true

		optionsList = append(optionsList, models.Option{
			ID:         i + 1,
			Text:       trimmed,
			VotesCount: 0,
		})
	}

	var expiresAt *time.Time
	if req.ExpirationHours > 0 {
		t := time.Now().Add(time.Duration(req.ExpirationHours) * time.Hour)
		expiresAt = &t
	}

	poll := &models.Poll{
		Question:   strings.TrimSpace(req.Question),
		Options:    optionsList,
		CreatorID:  creatorID,
		ShareCode:  generateShareCode(),
		Status:     "active",
		ExpiresAt:  expiresAt,
		TotalVotes: 0,
	}

	err := s.mongoRepo.CreatePoll(ctx, poll)
	if err != nil {
		return nil, err
	}

	// Sync initial counts to Redis
	_ = s.redisRepo.SyncPollCountsToRedis(ctx, poll.ID.Hex(), poll.Options)

	return poll, nil
}

func (s *PollService) GetPollByID(ctx context.Context, id string, voterToken ...string) (*models.PollResults, error) {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, errors.New("invalid poll ID format")
	}

	poll, err := s.mongoRepo.GetPollByID(ctx, objID)
	if err != nil {
		return nil, err
	}

	token := ""
	if len(voterToken) > 0 {
		token = voterToken[0]
	}
	return s.enrichPollResults(ctx, poll, token)
}

func (s *PollService) GetPollByShareCode(ctx context.Context, shareCode string, voterToken ...string) (*models.PollResults, error) {
	poll, err := s.mongoRepo.GetPollByShareCode(ctx, strings.ToUpper(shareCode))
	if err != nil {
		return nil, err
	}

	token := ""
	if len(voterToken) > 0 {
		token = voterToken[0]
	}
	return s.enrichPollResults(ctx, poll, token)
}

func (s *PollService) GetUserPolls(ctx context.Context, creatorID primitive.ObjectID) ([]models.PollResults, error) {
	polls, err := s.mongoRepo.GetPollsByCreatorID(ctx, creatorID)
	if err != nil {
		return nil, err
	}

	results := make([]models.PollResults, 0, len(polls))
	for i := range polls {
		res, err := s.enrichPollResults(ctx, &polls[i], "")
		if err == nil {
			results = append(results, *res)
		}
	}
	return results, nil
}

func (s *PollService) DeletePoll(ctx context.Context, id string, creatorID primitive.ObjectID) error {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return errors.New("invalid poll ID format")
	}
	return s.mongoRepo.DeletePoll(ctx, objID, creatorID)
}

func (s *PollService) TogglePollStatus(ctx context.Context, id string, creatorID primitive.ObjectID, status string) error {
	if status != "active" && status != "closed" && status != "frozen" {
		return errors.New("invalid status, must be 'active', 'frozen', or 'closed'")
	}

	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return errors.New("invalid poll ID format")
	}
	return s.mongoRepo.UpdatePollStatus(ctx, objID, creatorID, status)
}

func (s *PollService) enrichPollResults(ctx context.Context, poll *models.Poll, voterToken string) (*models.PollResults, error) {
	// Check if expired
	isExpired := false
	if poll.ExpiresAt != nil && time.Now().After(*poll.ExpiresAt) {
		isExpired = true
	}

	// Check if voter has already voted
	hasVoted := false
	if voterToken != "" {
		if votedRedis, err := s.redisRepo.HasVoted(ctx, poll.ID.Hex(), voterToken); err == nil && votedRedis {
			hasVoted = true
		} else if votedMongo, err := s.mongoRepo.HasVotedInMongo(ctx, poll.ID, voterToken); err == nil && votedMongo {
			hasVoted = true
		}
	}

	// Fetch live counts from Redis
	redisCounts, err := s.redisRepo.GetVoteCounts(ctx, poll.ID.Hex())
	if err != nil || len(redisCounts) == 0 {
		// Fallback to MongoDB options
		var total int64 = 0
		for _, opt := range poll.Options {
			total += opt.VotesCount
		}
		return &models.PollResults{
			PollID:     poll.ID.Hex(),
			ShareCode:  poll.ShareCode,
			Question:   poll.Question,
			Status:     poll.Status,
			Options:    poll.Options,
			TotalVotes: total,
			IsExpired:  isExpired,
			HasVoted:   hasVoted,
		}, nil
	}

	// Merge Redis counts into options
	var totalVotes int64 = 0
	enrichedOptions := make([]models.Option, len(poll.Options))
	for i, opt := range poll.Options {
		count := redisCounts[opt.ID]
		enrichedOptions[i] = models.Option{
			ID:         opt.ID,
			Text:       opt.Text,
			VotesCount: count,
		}
		totalVotes += count
	}

	return &models.PollResults{
		PollID:     poll.ID.Hex(),
		ShareCode:  poll.ShareCode,
		Question:   poll.Question,
		Status:     poll.Status,
		Options:    enrichedOptions,
		TotalVotes: totalVotes,
		IsExpired:  isExpired,
		HasVoted:   hasVoted,
	}, nil
}
