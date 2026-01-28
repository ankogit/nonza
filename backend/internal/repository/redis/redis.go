package redis

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type Client struct {
	rdb *redis.Client
	ctx context.Context
}

type Config struct {
	Host     string
	Port     string
	Password string
	DB       int
	UseSSL   bool
}

func NewClient(cfg Config) (*Client, error) {
	addr := fmt.Sprintf("%s:%s", cfg.Host, cfg.Port)
	
	opts := &redis.Options{
		Addr:     addr,
		Password: cfg.Password,
		DB:       cfg.DB,
	}
	
	// Note: TLS support would require additional configuration
	// For now, UseSSL is ignored as it requires tls.Config setup

	rdb := redis.NewClient(opts)
	ctx := context.Background()

	// Test connection
	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return &Client{
		rdb: rdb,
		ctx: ctx,
	}, nil
}

func (c *Client) Close() error {
	return c.rdb.Close()
}

// SetDocumentState stores Y.js document state with TTL
func (c *Client) SetDocumentState(roomID string, data []byte, ttl time.Duration) error {
	key := fmt.Sprintf("yjs:document:%s", roomID)
	return c.rdb.Set(c.ctx, key, data, ttl).Err()
}

// GetDocumentState retrieves Y.js document state
func (c *Client) GetDocumentState(roomID string) ([]byte, error) {
	key := fmt.Sprintf("yjs:document:%s", roomID)
	data, err := c.rdb.Get(c.ctx, key).Bytes()
	if err == redis.Nil {
		return nil, nil // Document not found
	}
	if err != nil {
		return nil, err
	}
	return data, nil
}

// DeleteDocumentState removes document state
func (c *Client) DeleteDocumentState(roomID string) error {
	key := fmt.Sprintf("yjs:document:%s", roomID)
	return c.rdb.Del(c.ctx, key).Err()
}

// ExtendTTL extends the TTL of a document
func (c *Client) ExtendTTL(roomID string, ttl time.Duration) error {
	key := fmt.Sprintf("yjs:document:%s", roomID)
	return c.rdb.Expire(c.ctx, key, ttl).Err()
}
