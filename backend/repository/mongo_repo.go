package repository

import (
	"context"
	"errors"
	"time"

	"live-polling-backend/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type MongoRepository struct {
	db *mongo.Database
}

func NewMongoRepository(client *mongo.Client, dbName string) *MongoRepository {
	db := client.Database(dbName)
	repo := &MongoRepository{db: db}
	repo.initIndexes()
	return repo
}

func (r *MongoRepository) initIndexes() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Unique index on user email
	usersColl := r.db.Collection("users")
	_, _ = usersColl.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "email", Value: 1}},
		Options: options.Index().SetUnique(true),
	})

	// Unique index on poll share_code
	pollsColl := r.db.Collection("polls")
	_, _ = pollsColl.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "share_code", Value: 1}},
		Options: options.Index().SetUnique(true),
	})

	// Index on votes poll_id and voter_ip
	votesColl := r.db.Collection("votes")
	_, _ = votesColl.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{
			{Key: "poll_id", Value: 1},
			{Key: "voter_ip", Value: 1},
		},
	})
}

// User repository methods
func (r *MongoRepository) CreateUser(ctx context.Context, user *models.User) error {
	user.ID = primitive.NewObjectID()
	user.CreatedAt = time.Now()
	_, err := r.db.Collection("users").InsertOne(ctx, user)
	return err
}

func (r *MongoRepository) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	var user models.User
	err := r.db.Collection("users").FindOne(ctx, bson.M{"email": email}).Decode(&user)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	return &user, nil
}

func (r *MongoRepository) GetUserByID(ctx context.Context, id primitive.ObjectID) (*models.User, error) {
	var user models.User
	err := r.db.Collection("users").FindOne(ctx, bson.M{"_id": id}).Decode(&user)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	return &user, nil
}

func (r *MongoRepository) UpdateUserPassword(ctx context.Context, email string, newHashedPassword string) error {
	res, err := r.db.Collection("users").UpdateOne(
		ctx,
		bson.M{"email": email},
		bson.M{"$set": bson.M{"password_hash": newHashedPassword}},
	)
	if err != nil {
		return err
	}
	if res.MatchedCount == 0 {
		return errors.New("registered email address not found")
	}
	return nil
}

// Poll repository methods
func (r *MongoRepository) CreatePoll(ctx context.Context, poll *models.Poll) error {
	poll.ID = primitive.NewObjectID()
	poll.CreatedAt = time.Now()
	poll.TotalVotes = 0
	poll.Status = "active"

	_, err := r.db.Collection("polls").InsertOne(ctx, poll)
	return err
}

func (r *MongoRepository) GetPollByID(ctx context.Context, id primitive.ObjectID) (*models.Poll, error) {
	var poll models.Poll
	err := r.db.Collection("polls").FindOne(ctx, bson.M{"_id": id}).Decode(&poll)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("poll not found")
		}
		return nil, err
	}
	return &poll, nil
}

func (r *MongoRepository) GetPollByShareCode(ctx context.Context, shareCode string) (*models.Poll, error) {
	var poll models.Poll
	err := r.db.Collection("polls").FindOne(ctx, bson.M{"share_code": shareCode}).Decode(&poll)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("poll not found")
		}
		return nil, err
	}
	return &poll, nil
}

func (r *MongoRepository) GetPollsByCreatorID(ctx context.Context, creatorID primitive.ObjectID) ([]models.Poll, error) {
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})
	cursor, err := r.db.Collection("polls").Find(ctx, bson.M{"creator_id": creatorID}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var polls []models.Poll
	if err = cursor.All(ctx, &polls); err != nil {
		return nil, err
	}
	if polls == nil {
		polls = []models.Poll{}
	}
	return polls, nil
}

func (r *MongoRepository) DeletePoll(ctx context.Context, id primitive.ObjectID, creatorID primitive.ObjectID) error {
	res, err := r.db.Collection("polls").DeleteOne(ctx, bson.M{"_id": id, "creator_id": creatorID})
	if err != nil {
		return err
	}
	if res.DeletedCount == 0 {
		return errors.New("poll not found or unauthorized")
	}
	return nil
}

func (r *MongoRepository) UpdatePollStatus(ctx context.Context, id primitive.ObjectID, creatorID primitive.ObjectID, status string) error {
	res, err := r.db.Collection("polls").UpdateOne(
		ctx,
		bson.M{"_id": id, "creator_id": creatorID},
		bson.M{"$set": bson.M{"status": status}},
	)
	if err != nil {
		return err
	}
	if res.MatchedCount == 0 {
		return errors.New("poll not found or unauthorized")
	}
	return nil
}

func (r *MongoRepository) IncrementMongoOptionVote(ctx context.Context, pollID primitive.ObjectID, optionID int) error {
	filter := bson.M{
		"_id":        pollID,
		"options.id": optionID,
	}
	update := bson.M{
		"$inc": bson.M{
			"options.$.votes_count": 1,
			"total_votes":          1,
		},
	}
	_, err := r.db.Collection("polls").UpdateOne(ctx, filter, update)
	return err
}

// Vote repository methods
func (r *MongoRepository) RecordVote(ctx context.Context, vote *models.Vote) error {
	vote.ID = primitive.NewObjectID()
	vote.CreatedAt = time.Now()
	_, err := r.db.Collection("votes").InsertOne(ctx, vote)
	return err
}

func (r *MongoRepository) HasVotedInMongo(ctx context.Context, pollID primitive.ObjectID, voterIP string) (bool, error) {
	count, err := r.db.Collection("votes").CountDocuments(ctx, bson.M{
		"poll_id":  pollID,
		"voter_ip": voterIP,
	})
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
