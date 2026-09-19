# Build stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Copy Go module files and download dependencies
COPY backend/go.mod backend/go.sum ./backend/
WORKDIR /app/backend
RUN go mod download

# Copy backend source code and build binary
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main ./cmd/server

# Final runtime stage
FROM alpine:3.21

RUN apk --no-cache add ca-certificates

WORKDIR /root/

COPY --from=builder /app/backend/main .

EXPOSE 8080

CMD ["./main"]
