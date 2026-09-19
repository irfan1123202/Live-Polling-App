package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"time"

	"live-polling-backend/models"

	"github.com/redis/go-redis/v9"
)

type RedisRepository struct {
	rdb *redis.Client
}

func NewRedisRepository(client *redis.Client) *RedisRepository {
	return &RedisRepository{rdb: client}
}

// IncrementVote executes atomic Redis HINCRBY for live vote counts
func (r *RedisRepository) IncrementVote(ctx context.Context, pollID string, optionID int) (int64, error) {
	key := fmt.Sprintf("poll:%s:votes", pollID)
	field := strconv.Itoa(optionID)

	val, err := r.rdb.HIncrBy(ctx, key, field, 1).Result()
	if err != nil {
		log.Printf("Redis HIncrBy error for key %s: %v", key, err)
		return 0, err
	}
	return val, nil
}

// GetVoteCounts retrieves all option vote counts from Redis Hash
func (r *RedisRepository) GetVoteCounts(ctx context.Context, pollID string) (map[int]int64, error) {
	key := fmt.Sprintf("poll:%s:votes", pollID)
	result, err := r.rdb.HGetAll(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	counts := make(map[int]int64)
	for k, v := range result {
		optID, err := strconv.Atoi(k)
		if err != nil {
			continue
		}
		cnt, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			continue
		}
		counts[optID] = cnt
	}
	return counts, nil
}

// SyncPollCountsToRedis initializes/syncs Redis Hash with options from MongoDB
func (r *RedisRepository) SyncPollCountsToRedis(ctx context.Context, pollID string, options []models.Option) error {
	key := fmt.Sprintf("poll:%s:votes", pollID)
	pipe := r.rdb.Pipeline()
	for _, opt := range options {
		pipe.HSet(ctx, key, strconv.Itoa(opt.ID), opt.VotesCount)
	}
	_, err := pipe.Exec(ctx)
	return err
}

// HasVoted checks if IP is registered in Redis Set
func (r *RedisRepository) HasVoted(ctx context.Context, pollID string, voterIP string) (bool, error) {
	key := fmt.Sprintf("poll:%s:voted_ips", pollID)
	return r.rdb.SIsMember(ctx, key, voterIP).Result()
}

// RecordVotedIP adds voter IP to Redis Set with 30-day expiration
func (r *RedisRepository) RecordVotedIP(ctx context.Context, pollID string, voterIP string) error {
	key := fmt.Sprintf("poll:%s:voted_ips", pollID)
	pipe := r.rdb.Pipeline()
	pipe.SAdd(ctx, key, voterIP)
	pipe.Expire(ctx, key, 30*24*time.Hour)
	_, err := pipe.Exec(ctx)
	return err
}

// PublishVoteUpdate publishes real-time vote updates to Redis Pub/Sub channel
func (r *RedisRepository) PublishVoteUpdate(ctx context.Context, pollID string, event models.VoteEvent) error {
	channel := fmt.Sprintf("poll:%s:events", pollID)
	data, err := json.Marshal(event)
	if err != nil {
		return err
	}

	err = r.rdb.Publish(ctx, channel, data).Err()
	if err != nil {
		log.Printf("Failed to publish Redis Pub/Sub event on channel %s: %v", channel, err)
		return err
	}
	log.Printf("Successfully published Redis Pub/Sub event to %s", channel)
	return nil
}

// Subscribe returns a PubSub instance listening to poll channel
func (r *RedisRepository) Subscribe(ctx context.Context, pollID string) *redis.PubSub {
	channel := fmt.Sprintf("poll:%s:events", pollID)
	return r.rdb.Subscribe(ctx, channel)
}
