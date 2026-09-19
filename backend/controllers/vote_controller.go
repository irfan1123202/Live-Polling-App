package controllers

import (
	"net/http"

	"live-polling-backend/models"
	"live-polling-backend/services"

	"github.com/gin-gonic/gin"
)

type VoteController struct {
	voteService *services.VoteService
	pollService *services.PollService
}

func NewVoteController(voteService *services.VoteService, pollService *services.PollService) *VoteController {
	return &VoteController{
		voteService: voteService,
		pollService: pollService,
	}
}

func (ctrl *VoteController) CastVote(c *gin.Context) {
	pollID := c.Param("id")

	var req models.VoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid vote request parameters"})
		return
	}

	voterToken := c.GetHeader("X-Voter-Token")
	if voterToken == "" {
		voterToken = c.ClientIP()
	}
	userAgent := c.GetHeader("User-Agent")

	results, err := ctrl.voteService.CastVote(c.Request.Context(), pollID, req.OptionID, voterToken, userAgent)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Vote recorded successfully",
		"results": results,
	})
}

func (ctrl *VoteController) GetResults(c *gin.Context) {
	pollID := c.Param("id")
	results, err := ctrl.pollService.GetPollByID(c.Request.Context(), pollID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, results)
}
