package repository

import (
	"context"

	"gorm.io/gorm"
)

type TransactionRunner interface {
	RunInTransaction(ctx context.Context, fn func(*Repositories) error) error
}

type transactionRunner struct {
	db *gorm.DB
}

func NewTransactionRunner(db *gorm.DB) TransactionRunner {
	return &transactionRunner{db: db}
}

func (r *transactionRunner) RunInTransaction(ctx context.Context, fn func(*Repositories) error) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return fn(NewRepositories(tx))
	})
}
