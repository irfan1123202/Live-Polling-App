package controllers

import (
	"net/http"

	"live-polling-backend/models"
	"live-polling-backend/services"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type PollController struct {
	pollService *services.PollService
}

func NewPollController(pollService *services.PollService) *PollController {
	return &PollController{pollService: pollService}
}

func (ctrl *PollController) CreatePoll(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID := userIDVal.(primitive.ObjectID)

	var req models.CreatePollRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	poll, err := ctrl.pollService.CreatePoll(c.Request.Context(), userID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, poll)
}

func (ctrl *PollController) GetUserPolls(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID := userIDVal.(primitive.ObjectID)

	polls, err := ctrl.pollService.GetUserPolls(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, polls)
}

func (ctrl *PollController) GetPollByID(c *gin.Context) {
	id := c.Param("id")
	voterToken := c.GetHeader("X-Voter-Token")
	if voterToken == "" {
		voterToken = c.ClientIP()
	}
	results, err := ctrl.pollService.GetPollByID(c.Request.Context(), id, voterToken)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, results)
}

func (ctrl *PollController) GetPollByShareCode(c *gin.Context) {
	shareCode := c.Param("shareCode")
	voterToken := c.GetHeader("X-Voter-Token")
	if voterToken == "" {
		voterToken = c.ClientIP()
	}
	results, err := ctrl.pollService.GetPollByShareCode(c.Request.Context(), shareCode, voterToken)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, results)
}

func (ctrl *PollController) DeletePoll(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID := userIDVal.(primitive.ObjectID)
	id := c.Param("id")

	err := ctrl.pollService.DeletePoll(c.Request.Context(), id, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Poll deleted successfully"})
}

func (ctrl *PollController) TogglePollStatus(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID := userIDVal.(primitive.ObjectID)
	id := c.Param("id")

	var body struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := ctrl.pollService.TogglePollStatus(c.Request.Context(), id, userID, body.Status)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Poll status updated successfully"})
}
