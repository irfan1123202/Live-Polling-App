package services

import (
	"context"
	"errors"
	"log"
	"time"

	"live-polling-backend/models"
	"live-polling-backend/repository"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type VoteService struct {
	mongoRepo   *repository.MongoRepository
	redisRepo   *repository.RedisRepository
	pollService *PollService
}

func NewVoteService(mongoRepo *repository.MongoRepository, redisRepo *repository.RedisRepository, pollService *PollService) *VoteService {
	return &VoteService{
		mongoRepo:   mongoRepo,
		redisRepo:   redisRepo,
		pollService: pollService,
	}
}

func (s *VoteService) CastVote(ctx context.Context, pollIDStr string, optionID int, voterToken string, userAgent string) (*models.PollResults, error) {
	objID, err := primitive.ObjectIDFromHex(pollIDStr)
	if err != nil {
		return nil, errors.New("invalid poll ID format")
	}

	poll, err := s.mongoRepo.GetPollByID(ctx, objID)
	if err != nil {
		return nil, errors.New("poll not found")
	}

	// 1. Validation
	if poll.Status == "frozen" {
		return nil, errors.New("this voting is temporary freeze try again some time later")
	}

	if poll.Status != "active" {
		return nil, errors.New("this poll is closed and no longer accepting votes")
	}

	if poll.ExpiresAt != nil && time.Now().After(*poll.ExpiresAt) {
		return nil, errors.New("this poll has expired")
	}

	validOption := false
	for _, opt := range poll.Options {
		if opt.ID == optionID {
			validOption = true
			break
		}
	}
	if !validOption {
		return nil, errors.New("invalid option selected for this poll")
	}

	// Check if voter has already voted on this poll
	if voterToken != "" {
		if votedRedis, err := s.redisRepo.HasVoted(ctx, poll.ID.Hex(), voterToken); err == nil && votedRedis {
			return nil, errors.New("You have already voted on this poll")
		}
		if votedMongo, err := s.mongoRepo.HasVotedInMongo(ctx, poll.ID, voterToken); err == nil && votedMongo {
			return nil, errors.New("You have already voted on this poll")
		}
	}

	// 2. Persistent Storage in Mongo
	vote := &models.Vote{
		PollID:    poll.ID,
		OptionID:  optionID,
		VoterIP:   voterToken,
		UserAgent: userAgent,
	}
	if err := s.mongoRepo.RecordVote(ctx, vote); err != nil {
		log.Printf("Failed to record vote in Mongo: %v", err)
	}
	_ = s.mongoRepo.IncrementMongoOptionVote(ctx, poll.ID, optionID)

	// 3. Redis Atomic Count Update
	_, err = s.redisRepo.IncrementVote(ctx, poll.ID.Hex(), optionID)
	if err != nil {
		log.Printf("Failed to increment vote in Redis: %v", err)
	}

	// Record Voter Token in Redis set
	_ = s.redisRepo.RecordVotedIP(ctx, poll.ID.Hex(), voterToken)

	// 4. Fetch Updated Poll Results
	updatedResults, err := s.pollService.GetPollByID(ctx, poll.ID.Hex())
	if err != nil {
		return nil, err
	}

	// 5. Redis Pub/Sub Publish Event
	event := models.VoteEvent{
		Event:      "VOTE_UPDATED",
		PollID:     updatedResults.PollID,
		ShareCode:  updatedResults.ShareCode,
		Options:    updatedResults.Options,
		TotalVotes: updatedResults.TotalVotes,
	}
	_ = s.redisRepo.PublishVoteUpdate(ctx, poll.ID.Hex(), event)

	return updatedResults, nil
}
