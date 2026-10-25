package client

import "time"

// Wire types mirror protocol/schema/*.schema.json.

type EnrollRequest struct {
	Email        string   `json:"email"`
	Code         string   `json:"code"`
	Label        string   `json:"label,omitempty"`
	PublicKey    string   `json:"publicKey"`
	MachineID    string   `json:"machineId"`
	ProductUUID  string   `json:"productUuid,omitempty"`
	OS           string   `json:"os"`
	OSVersion    string   `json:"osVersion"`
	OSPretty     string   `json:"osPretty,omitempty"`
	Arch         string   `json:"arch"`
	Hostname     string   `json:"hostname,omitempty"`
	AgentVersion string   `json:"agentVersion"`
	Capabilities []string `json:"capabilities"`
}

type Owner struct {
	Name   string  `json:"name"`
	Email  string  `json:"email"`
	Cohort *string `json:"cohort,omitempty"`
}

type EnrollResponse struct {
	MachineID       string  `json:"machineId"`
	Hostname        string  `json:"hostname"`
	Label           string  `json:"label"`
	KeyFingerprint  string  `json:"keyFingerprint"`
	Owner           Owner   `json:"owner"`
	AthenaKeyID     *string `json:"athenaKeyId"`
	AthenaPublicKey *string `json:"athenaPublicKey"`
}

type MeResponse struct {
	Machine struct {
		ID             string    `json:"id"`
		Label          string    `json:"label"`
		Hostname       string    `json:"hostname"`
		Status         string    `json:"status"`
		EnrolledAt     time.Time `json:"enrolledAt"`
		KeyFingerprint string    `json:"keyFingerprint"`
	} `json:"machine"`
	Owner      Owner     `json:"owner"`
	Athena     AthenaKey `json:"athena"`
	ServerTime time.Time `json:"serverTime"`
}

type Task struct {
	TaskID string `json:"taskId"`
	Bundle string `json:"bundle"`
	Sig    string `json:"sig"`
	KeyID  string `json:"keyId"`
}

type TasksResponse struct {
	Tasks      []Task    `json:"tasks"`
	PollAfter  int       `json:"pollAfter"`
	ServerTime time.Time `json:"serverTime"`
}

// AthenaKey is the bundle-signing key the agent pins (from enrolment or /me).
type AthenaKey struct {
	KeyID     string `json:"keyId"`
	PublicKey string `json:"publicKey"`
}

type LabListing struct {
	ScenarioID      string   `json:"scenarioId"`
	Slug            string   `json:"slug"`
	Title           string   `json:"title"`
	Type            string   `json:"type"`
	Roles           []string `json:"roles"`
	ActiveSessionID *string  `json:"activeSessionId"`
	ActiveStatus    *string  `json:"activeStatus"`
}

type LabsResponse struct {
	Labs []LabListing `json:"labs"`
}

type CheckView struct {
	ID         string  `json:"id"`
	Title      string  `json:"title"`
	Passed     bool    `json:"passed"`
	Skipped    bool    `json:"skipped"`
	Points     int     `json:"points"`
	Max        int     `json:"max"`
	Hint       *string `json:"hint"`
	Reason     *string `json:"reason"`
	Assertions []struct {
		Label  string `json:"label"`
		Passed bool   `json:"passed"`
		Points int    `json:"points"`
		Max    int    `json:"max"`
	} `json:"assertions"`
}

type RunView struct {
	ID          string      `json:"id"`
	Final       bool        `json:"final"`
	Status      string      `json:"status"`
	RequestedAt time.Time   `json:"requestedAt"`
	Visible     bool        `json:"visible"`
	Score       *int        `json:"score"`
	MaxScore    *int        `json:"maxScore"`
	Checks      []CheckView `json:"checks"`
}

// SessionView mirrors src/lib/labs/views.ts SessionView.
type SessionView struct {
	ID         string     `json:"id"`
	Status     string     `json:"status"`
	Note       *string    `json:"note"`
	DeadlineAt *time.Time `json:"deadlineAt"`
	Score      *int       `json:"score"`
	MaxScore   *int       `json:"maxScore"`
	Machines   []struct {
		Role          string `json:"role"`
		Label         string `json:"label"`
		BaselineReady bool   `json:"baselineReady"`
	} `json:"machines"`
	Runs      []RunView `json:"runs"`
	Problems  []string  `json:"problems"`
	WaitingOn []string  `json:"waitingOn"`
	Practice  struct {
		Allowed bool `json:"allowed"`
		Used    int  `json:"used"`
		Max     int  `json:"max"`
	} `json:"practice"`
}

type SessionResponse struct {
	Session SessionView `json:"session"`
	Tasks   []Task      `json:"tasks"`
}
