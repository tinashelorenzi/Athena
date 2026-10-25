package client

import (
	"context"
	"crypto/ed25519"
	"encoding/base64"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"zaio/agent/internal/sign"
)

// A fake Athena that verifies signatures exactly as src/lib/labs/agent-auth.ts does.
func TestSignedRequestVerifies(t *testing.T) {
	pub, key, _ := ed25519.GenerateKey(nil)
	var seenPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		ts, _ := strconv.ParseInt(r.Header.Get("X-Zaio-Ts"), 10, 64)
		sig, _ := base64.StdEncoding.DecodeString(r.Header.Get("X-Zaio-Sig"))
		seenPath = r.URL.RequestURI()
		if r.Header.Get("X-Zaio-Machine") != "m_1" || !ed25519.Verify(pub, []byte(sign.StringToSign(r.Method, seenPath, ts, body)), sig) {
			w.WriteHeader(401)
			_, _ = w.Write([]byte(`{"error":"bad_signature","message":"Request signature is invalid."}`))
			return
		}
		_, _ = w.Write([]byte(`{"tasks":[],"pollAfter":20,"serverTime":"2026-10-25T10:00:00Z"}`))
	}))
	defer srv.Close()

	c := New(srv.URL+"/", "test")
	c.MachineID, c.Key = "m_1", key
	c.Now = func() time.Time { return time.Unix(1793000000, 0) }
	res, err := c.Tasks(context.Background(), 25)
	if err != nil {
		t.Fatalf("tasks: %v", err)
	}
	if res.PollAfter != 20 || seenPath != "/api/agent/tasks?wait=25" {
		t.Fatalf("pollAfter=%d path=%s", res.PollAfter, seenPath)
	}

	// A different key must be rejected, and surface as an APIError.
	_, other, _ := ed25519.GenerateKey(nil)
	c.Key = other
	_, err = c.Tasks(context.Background(), 25)
	if !IsCode(err, "bad_signature") {
		t.Fatalf("want bad_signature, got %v", err)
	}
}
