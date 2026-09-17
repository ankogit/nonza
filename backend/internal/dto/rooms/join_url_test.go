package dto

import "testing"

func TestBuildJoinURL(t *testing.T) {
	got := BuildJoinURL("https://meet.nonza.ru/", "abc-defg-hij")
	want := "https://meet.nonza.ru/?code=abc-defg-hij"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
	if BuildJoinURL("", "abc") != "" {
		t.Fatal("empty base should yield empty url")
	}
	if BuildJoinURL("https://meet.nonza.ru", "") != "" {
		t.Fatal("empty code should yield empty url")
	}
}
