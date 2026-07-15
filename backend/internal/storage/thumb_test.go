package storage

import (
	"bytes"
	"context"
	"io"
	"testing"
)

func TestLocalStorage_OpenThumb_ReadsVersionedThumb(t *testing.T) {
	store, err := NewLocalStorageWithConfig(LocalConfig{
		BasePath:      t.TempDir(),
		ThumbPath:     t.TempDir(),
		PathTemplate:  DefaultLocalPathTemplate,
		PublicBaseURL: "",
	})
	if err != nil {
		t.Fatalf("new local storage: %v", err)
	}

	key := ThumbKeyForHash("deadbeefcafebabe")
	want := []byte("thumb-bytes")
	if err := store.SaveThumb(context.Background(), key, bytes.NewReader(want)); err != nil {
		t.Fatalf("save thumb: %v", err)
	}

	rc, err := store.OpenThumb(context.Background(), key)
	if err != nil {
		t.Fatalf("open thumb: %v", err)
	}
	defer rc.Close()

	got, err := io.ReadAll(rc)
	if err != nil {
		t.Fatalf("read thumb: %v", err)
	}
	if !bytes.Equal(got, want) {
		t.Fatalf("unexpected thumb bytes %q", string(got))
	}
}
