package auth

import (
	"testing"
	"time"
)

func TestParseFlexibleDuration(t *testing.T) {
	cases := []struct {
		in   string
		want time.Duration
	}{
		{"30m", 30 * time.Minute},
		{"1h", time.Hour},
		{"7d", 7 * 24 * time.Hour},
		{"90d", 90 * 24 * time.Hour},
		{" 90d ", 90 * 24 * time.Hour},
	}
	for _, tc := range cases {
		got, err := parseFlexibleDuration(tc.in)
		if err != nil {
			t.Fatalf("%q: unexpected error: %v", tc.in, err)
		}
		if got != tc.want {
			t.Fatalf("%q: got %v, want %v", tc.in, got, tc.want)
		}
	}
}
