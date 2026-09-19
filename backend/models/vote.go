package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Vote struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	PollID    primitive.ObjectID `bson:"poll_id" json:"pollId"`
	OptionID  int                `bson:"option_id" json:"optionId"`
	VoterIP   string             `bson:"voter_ip" json:"voterIp"`
	UserAgent string             `bson:"user_agent" json:"userAgent"`
	CreatedAt time.Time          `bson:"created_at" json:"createdAt"`
}
