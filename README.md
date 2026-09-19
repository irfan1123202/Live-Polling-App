# PulsePoll - Real-Time Live Polling Application

> **GUVI / HCL Developer Internship Project Submission**

PulsePoll is a high-performance, real-time live polling platform built with **React**, **Go + Gin**, **MongoDB**, and **Redis (Pub/Sub & Atomic Caching)**. It allows creators to register, create polls with custom duration rules, and distribute shareable links. Audiences can vote instantly without logging in, and all connected clients see live vote counts update **in real-time without refreshing the page**.

---

## Technical Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React 18 + Vite | SPA with Glassmorphic CSS design system, Lucide icons, and Canvas Confetti |
| **Backend** | Go 1.24 + Gin Framework | High-concurrency RESTful API & Gorilla WebSocket server |
| **Database** | MongoDB | Persistent document storage for users, polls, and raw audit vote records |
| **Caching & Pub/Sub** | Redis 7 | Atomic vote count updates (`HINCRBY`), IP deduplication sets (`SADD`), and live Pub/Sub (`PUBLISH`) |
| **Containerization** | Docker & Docker Compose | Multi-container orchestration for seamless deployment |

---

## Key Features

1. **Authentication & Authorization**: Secure signup/login with bcrypt password hashing and JWT token authentication.
2. **Poll Management**: Create polls with 2–10 options, customize expiration times (1h, 24h, 7d, or Never), and toggle open/closed state.
3. **Shareable Short Links**: Unique share code generated per poll (`/poll/ABC123`) for quick audience access.
4. **Instant Voting**: Clean radio-button interface with duplicate vote prevention (IP + Redis set filtering).
5. **Zero-Refresh Live Results**: Redis Pub/Sub events routed through Go WebSocket Hub to update progress bars and vote tallies instantly across all connected browsers.

---

## Real-Time Architecture & Event Flow

```
                  USER VOTES
                      │
                      ▼
               React Client App
                      │
                      ▼ HTTP POST /api/polls/:id/vote
               Go / Gin Backend
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
   MongoDB Storage           Redis Cache
(Users, Polls, Votes)     (Atomic HINCRBY)
                                  │
                                  ▼ Redis Pub/Sub
                         Channel: poll:<id>:events
                                  │
                                  ▼
                        Go WebSocket Hub
                                  │
                      ┌───────────┼───────────┐
                      ▼           ▼           ▼
                  Browser A   Browser B   Browser C
                    (Live updates without refresh)
```

### Redis Usage Details
- **Live Counts Hash**: Stores atomic counts per option under key `poll:<poll_id>:votes` using `HINCRBY`.
- **IP Deduplication Set**: Fast lookup set `poll:<poll_id>:voted_ips` using `SIsMember` to prevent spam votes.
- **Pub/Sub Channel**: Publishes `VOTE_UPDATED` event to `poll:<poll_id>:events`, which Go goroutines listen to and broadcast over WebSockets.

---

## Project Structure

```
live-polling/
├── frontend/
│   ├── src/
│   │   ├── components/         # Navbar, Footer, PollCard, LiveResultsChart, Toast
│   │   ├── context/            # AuthContext (JWT & state management)
│   │   ├── pages/              # Login, Signup, Dashboard, CreatePoll, PublicPoll, PollResults
│   │   ├── services/           # REST API client & WebSocket client
│   │   ├── App.jsx             # React Router setup
│   │   ├── index.css           # Glassmorphism dark CSS design system
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile
├── backend/
│   ├── cmd/server/main.go      # Go entrypoint
│   ├── config/                 # Env configuration
│   ├── controllers/            # Gin handlers (Auth, Poll, Vote)
│   ├── middleware/             # JWT & CORS middleware
│   ├── models/                 # BSON & JSON structs (User, Poll, Vote)
│   ├── repository/             # Mongo & Redis persistence layers
│   ├── routes/                 # Gin router setup
│   ├── services/               # Core business logic
│   ├── websocket/              # Gorilla WS Hub & Redis PubSub listener
│   ├── go.mod
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## Environment Variables

Copy `.env.example` to `.env`:

```env
# Backend Environment Variables
PORT=8080
MONGO_URI=mongodb://localhost:27017
MONGO_DB=livepolling
REDIS_URL=redis://localhost:6379
JWT_SECRET=super-secret-jwt-key-hcl-guvi-2026
FRONTEND_URL=http://localhost:5173

# Frontend Environment Variables (in frontend/.env)
VITE_API_URL=http://localhost:8080/api
VITE_WS_HOST=localhost:8080
```

---

## How to Run Locally

### Option A: Using Docker Compose (Recommended)

```bash
# Clone repository
git clone https://github.com/your-username/live-polling.git
cd live-polling

# Start full stack (MongoDB, Redis, Go Backend, React Frontend)
docker-compose up --build
```

Access the application at:
- **Frontend UI**: `http://localhost:5173`
- **Backend API**: `http://localhost:8080/api`

---

### Option B: Manual Execution

#### 1. Start MongoDB & Redis
Ensure local instances of MongoDB (port `27017`) and Redis (port `6379`) are running.

#### 2. Start Go Backend
```bash
cd backend
go mod download
go run ./cmd/server
```

#### 3. Start React Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## API Documentation

### Authentication
- `POST /api/auth/signup` - Body: `{ name, email, password }`
- `POST /api/auth/login` - Body: `{ email, password }`
- `GET /api/auth/me` - Headers: `Authorization: Bearer <token>`

### Poll Management
- `POST /api/polls` - Create poll (Auth required)
- `GET /api/polls` - List user's created polls (Auth required)
- `GET /api/polls/:id` - Fetch poll details & counts by ID
- `GET /api/polls/share/:shareCode` - Public lookup by 6-character share code
- `DELETE /api/polls/:id` - Delete poll (Auth required)
- `PATCH /api/polls/:id/status` - Toggle active/closed status (Auth required)

### Voting & Real-Time
- `POST /api/polls/:id/vote` - Body: `{ optionId }` (Public, checks IP)
- `GET /api/polls/:id/results` - Fetch poll results breakdown
- `GET /api/polls/:id/live` - WebSocket connection upgrade endpoint

---

## MongoDB Schema Structure

### `users` Collection
```json
{
  "_id": "ObjectId",
  "name": "Alex Mercer",
  "email": "alex@example.com",
  "password_hash": "$2a$10$...",
  "created_at": "ISODate"
}
```

### `polls` Collection
```json
{
  "_id": "ObjectId",
  "question": "What is your favorite programming language?",
  "options": [
    { "id": 1, "text": "Python", "votes_count": 10 },
    { "id": 2, "text": "Go", "votes_count": 5 }
  ],
  "creator_id": "ObjectId",
  "share_code": "ABC123",
  "status": "active",
  "expires_at": "ISODate",
  "total_votes": 15,
  "created_at": "ISODate"
}
```

---

## Testing Procedure & Validation

1. **Authentication Test**:
   - Register a new user at `/signup`.
   - Log in at `/login` and confirm JWT token is saved.
2. **Poll Creation Test**:
   - Navigate to `/create-poll`.
   - Enter a question and 4 options.
   - Click Publish and note the generated share code.
3. **Multi-Browser Live Synchronization Test (Core Feature)**:
   - Open `/poll/:shareCode` or `/poll/:id/results` in **Browser A**.
   - Open `/poll/:shareCode` in an Incognito window (**Browser B**).
   - Click vote in Browser B.
   - **Observe Browser A update progress bars and counts immediately without refreshing!**

---

## Submission Checklist
- [x] React Frontend (Vite, Glassmorphism design, real-time UI)
- [x] Go + Gin Backend REST API
- [x] MongoDB Persistent Storage
- [x] Redis Atomic Vote Counts (`HINCRBY`) & Pub/Sub
- [x] WebSocket Hub Broadcasting (`Gorilla WS`)
- [x] Containerized `docker-compose.yml`
- [x] Complete README & Setup Guide
