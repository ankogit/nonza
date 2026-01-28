package room

import (
	"crypto/rand"
	"fmt"
	"math/big"
)

const (
	codeLength1 = 3
	codeLength2 = 4
	codeLength3 = 3
	letters     = "abcdefghijklmnopqrstuvwxyz"
)

func GenerateShortCode() string {
	part1 := generateRandomLetters(codeLength1)
	part2 := generateRandomLetters(codeLength2)
	part3 := generateRandomLetters(codeLength3)

	return fmt.Sprintf("%s-%s-%s", part1, part2, part3)
}

func generateRandomLetters(length int) string {
	result := make([]byte, length)
	max := big.NewInt(int64(len(letters)))

	for i := range result {
		n, _ := rand.Int(rand.Reader, max)
		result[i] = letters[n.Int64()]
	}

	return string(result)
}
