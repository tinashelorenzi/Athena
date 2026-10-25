// Package client talks to Athena's agent API (/api/agent/*), signing every
// request after enrolment with the machine key (docs/labs/spec.md 7.2).
package client

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"zaio/agent/internal/sign"
)

type Client struct {
	BaseURL   string // e.g. https://athena.example.com
	MachineID string
	Key       ed25519.PrivateKey
	Version   string
	// Capabilities are reported on every signed request (X-Zaio-Capabilities).
	Capabilities []string
	HTTP         *http.Client
	Now          func() time.Time
}

func New(baseURL, version string) *Client {
	return &Client{
		BaseURL: strings.TrimRight(baseURL, "/"),
		Version: version,
		HTTP:    &http.Client{Timeout: 60 * time.Second},
		Now:     time.Now,
	}
}

// APIError is Athena's error body (protocol/schema/error.schema.json).
type APIError struct {
	Status     int    `json:"-"`
	Code       string `json:"error"`
	Message    string `json:"message"`
	RetryAfter int    `json:"retryAfter,omitempty"`
}

func (e *APIError) Error() string {
	if e.Message != "" {
		return e.Message
	}
	return fmt.Sprintf("Athena returned HTTP %d (%s)", e.Status, e.Code)
}

// IsCode reports whether err is an APIError with one of the given codes.
func IsCode(err error, codes ...string) bool {
	var ae *APIError
	if !errors.As(err, &ae) {
		return false
	}
	for _, c := range codes {
		if ae.Code == c {
			return true
		}
	}
	return false
}

func (c *Client) Enroll(ctx context.Context, req EnrollRequest) (*EnrollResponse, error) {
	var out EnrollResponse
	return &out, c.do(ctx, http.MethodPost, "/api/agent/enroll", req, false, &out)
}

func (c *Client) Me(ctx context.Context) (*MeResponse, error) {
	var out MeResponse
	return &out, c.do(ctx, http.MethodGet, "/api/agent/me", nil, true, &out)
}

func (c *Client) Tasks(ctx context.Context, wait int) (*TasksResponse, error) {
	var out TasksResponse
	return &out, c.do(ctx, http.MethodGet, "/api/agent/tasks?wait="+strconv.Itoa(wait), nil, true, &out)
}

// Result reports a task's outcome.
func (c *Client) Result(ctx context.Context, taskID string, body any) error {
	return c.do(ctx, http.MethodPost, "/api/agent/tasks/"+url.PathEscape(taskID)+"/result", body, true, nil)
}

func (c *Client) Labs(ctx context.Context) (*LabsResponse, error) {
	var out LabsResponse
	return &out, c.do(ctx, http.MethodGet, "/api/agent/labs", nil, true, &out)
}

func (c *Client) StartSession(ctx context.Context, slug, role string) (*SessionResponse, error) {
	body := map[string]string{"lab": slug}
	if role != "" {
		body["role"] = role
	}
	var out SessionResponse
	return &out, c.do(ctx, http.MethodPost, "/api/agent/sessions", body, true, &out)
}

func (c *Client) Session(ctx context.Context, id string) (*SessionResponse, error) {
	var out SessionResponse
	return &out, c.do(ctx, http.MethodGet, "/api/agent/sessions/"+url.PathEscape(id), nil, true, &out)
}

// SessionAction posts "check" or "end" for a session.
func (c *Client) SessionAction(ctx context.Context, id, action string) (*SessionResponse, error) {
	var out SessionResponse
	return &out, c.do(ctx, http.MethodPost, "/api/agent/sessions/"+url.PathEscape(id)+"/"+action, struct{}{}, true, &out)
}

// Download streams a signed GET (lab assets) into w.
func (c *Client) Download(ctx context.Context, path string, w io.Writer) error {
	u, err := url.Parse(c.BaseURL + path)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return err
	}
	c.signRequest(req, u, nil)
	res, err := c.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("could not reach Athena at %s: %w", c.BaseURL, err)
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		ae := &APIError{Status: res.StatusCode}
		raw, _ := io.ReadAll(io.LimitReader(res.Body, 1<<16))
		if json.Unmarshal(raw, ae) != nil || ae.Code == "" {
			ae.Code = "http_" + strconv.Itoa(res.StatusCode)
		}
		return ae
	}
	_, err = io.Copy(w, res.Body)
	return err
}

func (c *Client) signRequest(req *http.Request, u *url.URL, body []byte) {
	ts := c.Now().Unix()
	msg := sign.StringToSign(req.Method, u.RequestURI(), ts, body)
	req.Header.Set("User-Agent", "zaio/"+c.Version)
	req.Header.Set("X-Zaio-Agent", c.Version)
	req.Header.Set("X-Zaio-Capabilities", strings.Join(c.Capabilities, ","))
	req.Header.Set("X-Zaio-Machine", c.MachineID)
	req.Header.Set("X-Zaio-Ts", strconv.FormatInt(ts, 10))
	req.Header.Set("X-Zaio-Sig", sign.Sign(c.Key, msg))
}

func (c *Client) do(ctx context.Context, method, path string, in any, signed bool, out any) error {
	var body []byte
	if in != nil {
		b, err := json.Marshal(in)
		if err != nil {
			return err
		}
		body = b
	}
	u, err := url.Parse(c.BaseURL + path)
	if err != nil {
		return fmt.Errorf("bad Athena URL: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, method, u.String(), bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "zaio/"+c.Version)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-Zaio-Agent", c.Version)
	if signed {
		req.Header.Set("X-Zaio-Capabilities", strings.Join(c.Capabilities, ","))
	}
	if in != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if signed {
		if c.Key == nil || c.MachineID == "" {
			return errors.New("client has no machine key — run `sudo zaio setup`")
		}
		ts := c.Now().Unix()
		// Sign exactly what the server sees: the escaped path plus the query.
		msg := sign.StringToSign(method, u.RequestURI(), ts, body)
		req.Header.Set("X-Zaio-Machine", c.MachineID)
		req.Header.Set("X-Zaio-Ts", strconv.FormatInt(ts, 10))
		req.Header.Set("X-Zaio-Sig", sign.Sign(c.Key, msg))
	}

	res, err := c.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("could not reach Athena at %s: %w", c.BaseURL, err)
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(res.Body, 8<<20))
	if err != nil {
		return err
	}
	if res.StatusCode >= 300 {
		ae := &APIError{Status: res.StatusCode}
		if json.Unmarshal(raw, ae) != nil || ae.Code == "" {
			ae.Code = "http_" + strconv.Itoa(res.StatusCode)
		}
		return ae
	}
	if out != nil {
		if err := json.Unmarshal(raw, out); err != nil {
			return fmt.Errorf("unexpected response from Athena (%s %s): %w", method, path, err)
		}
	}
	return nil
}
