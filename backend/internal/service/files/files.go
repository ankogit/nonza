package files

import (
	"context"
	"fmt"
	"mime"
	"os"
	"os/exec"
	"path/filepath"

	"nonza/backend/internal/models"
	"nonza/backend/internal/repository"
	"nonza/backend/internal/storage"

	"github.com/google/uuid"
)

type filesService struct {
	repo    repository.Files
	storage storage.ObjectStorage
}

func NewFilesService(repo repository.Files, objectStorage storage.ObjectStorage) *filesService {
	return &filesService{
		repo:    repo,
		storage: objectStorage,
	}
}

func (s *filesService) CreateProcessedSoundFile(ctx context.Context, params CreateProcessedSoundFileParams) (*models.StoredFile, error) {
	tmpOut, err := os.CreateTemp("", "soundbar-trimmed-*.ogg")
	if err != nil {
		return nil, err
	}
	tmpOutPath := tmpOut.Name()
	_ = tmpOut.Close()
	defer func() {
		_ = os.Remove(tmpOutPath)
	}()

	if params.ClientProcessed {
		if err := transcodeToOgg(params.InputPath, tmpOutPath); err != nil {
			return nil, fmt.Errorf("transcode audio to ogg: %w", err)
		}
	} else {
		if err := trimToOgg(
			params.InputPath,
			tmpOutPath,
			params.StartMs,
			params.EndMs,
			params.Volume,
			params.Speed,
		); err != nil {
			return nil, fmt.Errorf("trim audio (ffmpeg): %w", err)
		}
	}

	objectKey := fmt.Sprintf(
		"org/%s/sounds/%s/v%d.ogg",
		params.OrganizationID.String(),
		params.SoundID.String(),
		params.Version,
	)

	sizeBytes, err := s.storage.PutFile(ctx, objectKey, tmpOutPath, "audio/ogg")
	if err != nil {
		return nil, fmt.Errorf("upload to storage: %w", err)
	}

	file := &models.StoredFile{
		ID:             uuid.New(),
		Provider:       "s3",
		Bucket:         s.storage.Bucket(),
		ObjectKey:      objectKey,
		MimeType:       mime.TypeByExtension(".ogg"),
		SizeBytes:      sizeBytes,
		CreatedByUserID: params.CreatedByUserID,
	}

	if file.MimeType == "" {
		file.MimeType = "audio/ogg"
	}

	if err := s.repo.Create(file); err != nil {
		return nil, fmt.Errorf("save file record: %w", err)
	}

	return file, nil
}

func (s *filesService) GetByID(id uuid.UUID) (*models.StoredFile, error) {
	return s.repo.GetByID(id)
}

func (s *filesService) GetPublicURL(file *models.StoredFile) string {
	if file == nil {
		return ""
	}
	return s.storage.PublicURL(file.ObjectKey)
}

func (s *filesService) Delete(ctx context.Context, id uuid.UUID) error {
	f, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}
	if err := s.storage.RemoveObject(ctx, f.ObjectKey); err != nil {
		return err
	}
	return s.repo.Delete(id)
}

func trimToOgg(
	inputPath string,
	outputPath string,
	startMs int,
	endMs int,
	volume int,
	speed int,
) error {
	startSec := float64(startMs) / 1000.0
	durationSec := float64(endMs-startMs) / 1000.0
	volumeMul := float64(volume) / 100.0
	speedMul := float64(speed) / 100.0
	if speedMul <= 0 {
		speedMul = 1
	}

	filter := fmt.Sprintf("volume=%.3f", volumeMul)
	if speedMul != 1 {
		filter = fmt.Sprintf("%s,atempo=%.6f", filter, speedMul)
	}

	// #nosec G204 -- ffmpeg args are passed as a fixed argv slice; user input is sanitized/treated as plain filenames.
	cmd := exec.Command(
		"ffmpeg",
		"-y",
		"-hide_banner",
		"-loglevel",
		"error",
		"-i",
		inputPath,
		"-ss",
		fmt.Sprintf("%.3f", startSec),
		"-t",
		fmt.Sprintf("%.3f", durationSec),
		"-vn",
		"-af",
		filter,
		"-c:a",
		"libopus",
		"-b:a",
		"96k",
		filepath.Clean(outputPath),
	)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("ffmpeg: %w", err)
	}
	return nil
}

func transcodeToOgg(inputPath string, outputPath string) error {
	// #nosec G204 -- ffmpeg args are passed as a fixed argv slice; user input is treated as plain filenames.
	cmd := exec.Command(
		"ffmpeg",
		"-y",
		"-hide_banner",
		"-loglevel",
		"error",
		"-i",
		inputPath,
		"-vn",
		"-c:a",
		"libopus",
		"-b:a",
		"96k",
		filepath.Clean(outputPath),
	)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("ffmpeg: %w", err)
	}
	return nil
}

