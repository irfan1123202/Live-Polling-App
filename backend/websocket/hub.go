package websocket

import (
	"context"
	"log"
	"net/http"
	"sync"

	"live-polling-backend/repository"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for WebSocket connections
	},
}

type Client struct {
	Hub    *Hub
	Conn   *websocket.Conn
	Send   chan []byte
	PollID string
}

type Hub struct {
	redisRepo   *repository.RedisRepository
	clients     map[string]map[*Client]bool // map[pollID]map[*Client]bool
	subscribers map[string]context.CancelFunc
	register    chan *Client
	unregister  chan *Client
	mu          sync.RWMutex
}

func NewHub(redisRepo *repository.RedisRepository) *Hub {
	return &Hub{
		redisRepo:   redisRepo,
		clients:     make(map[string]map[*Client]bool),
		subscribers: make(map[string]context.CancelFunc),
		register:    make(chan *Client),
		unregister:  make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			if _, ok := h.clients[client.PollID]; !ok {
				h.clients[client.PollID] = make(map[*Client]bool)
				// Start listening to Redis Pub/Sub for this poll if not already listening
				h.startRedisSubscriber(client.PollID)
			}
			h.clients[client.PollID][client] = true
			h.mu.Unlock()
			log.Printf("Client registered for poll WS: %s (Total: %d)", client.PollID, len(h.clients[client.PollID]))

		case client := <-h.unregister:
			h.mu.Lock()
			if clients, ok := h.clients[client.PollID]; ok {
				if _, ok := clients[client]; ok {
					delete(clients, client)
					close(client.Send)
					if len(clients) == 0 {
						delete(h.clients, client.PollID)
						// Stop Redis subscriber goroutine if no clients are listening
						h.stopRedisSubscriber(client.PollID)
					}
				}
			}
			h.mu.Unlock()
			log.Printf("Client unregistered from poll WS: %s", client.PollID)
		}
	}
}

func (h *Hub) startRedisSubscriber(pollID string) {
	if _, exists := h.subscribers[pollID]; exists {
		return
	}

	ctx, cancel := context.WithCancel(context.Background())
	h.subscribers[pollID] = cancel

	go func() {
		pubsub := h.redisRepo.Subscribe(ctx, pollID)
		defer pubsub.Close()

		ch := pubsub.Channel()
		log.Printf("Started Redis Pub/Sub listener goroutine for poll: %s", pollID)

		for {
			select {
			case <-ctx.Done():
				log.Printf("Stopped Redis Pub/Sub listener goroutine for poll: %s", pollID)
				return
			case msg, ok := <-ch:
				if !ok {
					return
				}
				h.broadcastToPoll(pollID, []byte(msg.Payload))
			}
		}
	}()
}

func (h *Hub) stopRedisSubscriber(pollID string) {
	if cancel, ok := h.subscribers[pollID]; ok {
		cancel()
		delete(h.subscribers, pollID)
	}
}

func (h *Hub) broadcastToPoll(pollID string, payload []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if clients, ok := h.clients[pollID]; ok {
		for client := range clients {
			select {
			case client.Send <- payload:
			default:
				close(client.Send)
				delete(clients, client)
			}
		}
	}
}

func (c *Client) readPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	for {
		_, _, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WS read error: %v", err)
			}
			break
		}
	}
}

func (c *Client) writePump() {
	defer func() {
		c.Conn.Close()
	}()

	for {
		message, ok := <-c.Send
		if !ok {
			c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
			return
		}

		w, err := c.Conn.NextWriter(websocket.TextMessage)
		if err != nil {
			return
		}
		w.Write(message)

		if err := w.Close(); err != nil {
			return
		}
	}
}

func ServeWS(hub *Hub, c *gin.Context) {
	pollID := c.Param("id")
	if pollID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Poll ID required"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade WebSocket: %v", err)
		return
	}

	client := &Client{
		Hub:    hub,
		Conn:   conn,
		Send:   make(chan []byte, 256),
		PollID: pollID,
	}

	client.Hub.register <- client

	go client.writePump()
	go client.readPump()
}
