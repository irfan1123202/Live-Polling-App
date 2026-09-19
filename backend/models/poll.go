package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Option struct {
	ID         int    `bson:"id" json:"id"`
	Text       string `bson:"text" json:"text"`
	VotesCount int64  `bson:"votes_count" json:"votesCount"`
}

type Poll struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Question   string             `bson:"question" json:"question"`
	Options    []Option           `bson:"options" json:"options"`
	CreatorID  primitive.ObjectID `bson:"creator_id" json:"creatorId"`
	ShareCode  string             `bson:"share_code" json:"shareCode"`
	Status     string             `bson:"status" json:"status"` // "active" or "closed"
	ExpiresAt  *time.Time         `bson:"expires_at,omitempty" json:"expiresAt,omitempty"`
	TotalVotes int64              `bson:"total_votes" json:"totalVotes"`
	CreatedAt  time.Time          `bson:"created_at" json:"createdAt"`
}

type CreatePollRequest struct {
	Question        string   `json:"question" binding:"required,min=5,max=250"`
	Options         []string `json:"options" binding:"required,min=2,max=10,dive,required,min=1"`
	ExpirationHours int      `json:"expirationHours"` // 0 for never, or 1, 24, 168 (7 days)
}

type VoteRequest struct {
	OptionID int `json:"optionId" binding:"required"`
}

type PollResults struct {
	PollID     string   `json:"pollId"`
	ShareCode  string   `json:"shareCode"`
	Question   string   `json:"question"`
	Status     string   `json:"status"`
	Options    []Option `json:"options"`
	TotalVotes int64    `json:"totalVotes"`
	IsExpired  bool     `json:"isExpired"`
	HasVoted   bool     `json:"hasVoted"`
}

type VoteEvent struct {
	Event      string   `json:"event"` // "VOTE_UPDATED"
	PollID     string   `json:"pollId"`
	ShareCode  string   `json:"shareCode"`
	Options    []Option `json:"options"`
	TotalVotes int64    `json:"totalVotes"`
}
