.PHONY: up down restart logs build clean dev-up dev-down dev-logs backend-logs livekit-logs postgres-logs redis-logs go-lint go-fmt go-test

up:
	docker-compose up -d

down:
	docker-compose down

restart:
	docker-compose restart

logs:
	docker-compose logs -f

build:
	docker-compose build

clean:
	docker-compose down -v
	docker system prune -f

dev-up:
	docker-compose -f docker-compose.dev.yml up -d

dev-down:
	docker-compose -f docker-compose.dev.yml down

dev-logs:
	docker-compose -f docker-compose.dev.yml logs -f

backend-logs:
	docker-compose logs -f backend

livekit-logs:
	docker-compose logs -f livekit

postgres-logs:
	docker-compose logs -f postgres

redis-logs:
	docker-compose logs -f redis

go-fmt:
	cd backend && gofmt -w .

go-test:
	cd backend && go test ./...

go-lint:
	cd backend && golangci-lint run ./...
