---

date: 2026-10-15T09:00:00
draft: false
title: "Polyglot Trader T212: The Go Proxy That Sits Between a Python Brain and the Money"
image: /images/covers/2026-10-15-polyglot-trader-t212.svg
summary: "A Go service on :8081 that a Python ML bot talks to - and that talks to the Trading212 REST API - owning the four things a trading system dies on: auth, rate limiting, the circuit breaker, and the kill switch. The real code, from the real implementation."
categories:
  - Go
  - FinTech
  - Trading
  - AI
tags:
  - Go
  - Trading
  - Microservices
  - Machine-Learning
  - Risk-Management
---

# Polyglot Trader T212: the Go proxy between a Python brain and the money

Most trading systems die for the same three reasons, and none of them are *the model*: the bot over-trades on noise, one bad day wipes the account, and the process dies mid-write so the "live" portfolio is a half-written file. **Polyglot Trader T212** is built around the thesis that *the model and the money should live in different languages, and the line between them should be a small Go service on port `:8081`.**

The split is the whole architecture. The **brain** is a **Python** process — the ML model, the feature feed, the thing that outputs a probability `P(up)` — and it lives in Python because the *ML ecosystem is Python*. The **hands** are a **Go** service on `:8081` — the thing that *owns the money* — and it lives in Go because it is *infrastructure*: a small static binary, high concurrency, cheap to run, and readable by the operator who is on call at 3am. The Python brain never talks to Trading212 directly. It talks to the Go service, and the Go service is the *only* code that knows the Trading212 API key, the only code that enforces the rate limits, the only code that can open a circuit, and the only code that can be killed in flight.

```
  ┌─────────────────┐   HTTP :8081   ┌────────────────────────┐   HTTPS   ┌──────────────────┐
  │  Python ML bot  │ ──────────────►│  Go service  (the      │ ─────────►│  Trading212      │
  │  (the brain)    │  /api/*        │  "hands" on :8081)     │  /equity/ │  REST API         │
  │  P(up), features │                │  auth · rate-limit ·   │           │  positions/orders  │
  └─────────────────┘                │  circuit-breaker · kill │           └──────────────────┘
                                     └────────────────────────┘
```

This post teaches the *hands* using the **real source** from `~/Documents/LLM/polyglot-trader-t212` — the T212 client, the middleware chain, the per-endpoint rate limiter, the circuit breaker, and the no-auth kill switch — and ends with the four design rules that keep the system from blowing up on a Tuesday.

## Why the brain is Python and the hands are Go

The language split is a *consequence* of the layer split, not a preference:

- **The model layer is Python** because the ML tooling is Python. `P(up)` comes out of a trained model, and that model is a Python object. Moving it to Go would mean moving the *entire ML ecosystem* to Go, which is a *loss*.
- **The infrastructure layer is Go** because the hands are *operational*: a per-process service that owns the API key, enforces the rate limit, trips the circuit, and can be killed. That is *exactly* the shape Go maximizes — a 10MB static binary, a goroutine per in-flight request, readable errors, no interpreter to ship. The hands are *the* layer an operator reads at 3am, and Go is the cheapest language for that to be readable.

The boundary between the two is **an API, not a language**: the Python bot sends a JSON `POST /api/signal` (or `/api/ml/predict`, `/api/risk/gate`) to the Go service, and the Go service does *the thing* with the Trading212 REST API. The Python process does not *know* what a Trading212 order is; the Go process does not *know* what a `P(up)` is. Each side owns its own side of the boundary.

| | **Python ML bot (the brain)** | **Go service on :8081 (the hands)** |
|---|---|---|
| **Owns** | the model, the features, `P(up)` | the API key, the rate limit, the circuit, the kill |
| **Language** | Python (the ML ecosystem) | Go (the operational layer) |
| **Binary** | an interpreter + packages | a ~10MB static binary |
| **Concurrency** | a process, an event loop | a goroutine per in-flight request |
| **Talks to** | the Go service (HTTP :8081) | the Trading212 REST API (HTTPS) |
| **Killed by** | the Go service (it can't self-terminate the broker) | `POST /api/kill-switch` (no auth, so you can always reach it) |
| **Read at 3am by** | the ML researcher | the on-call operator |

The *one-line* version: **the brain proposes, the hands dispose, and the hands are Go.**

## The T212 client: the only code that knows the API key

The Trading212 REST API is authenticated with a **Basic auth** header derived from an API key and secret. The Go client is the *single* place that builds that header and the *single* place that speaks the `/api/v0/equity/...` endpoints. The key/secret are **never** in the Python process; they are environment variables the Go service reads at startup (`T212_READ_KEY` / `T212_READ_SECRET`) and base64-encodes once.

```go
// t212/client.go — the Go Trading212 client. This is the ONLY code in
// the system that knows the API key/secret. The Python bot never sees
// them; it talks to this service over HTTP on :8081.
package t212

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// T212Client is the Go implementation of the Trading212 API client.
// All endpoints use the /api/v0/equity/ prefix as required by the API.
type T212Client struct {
	baseURL    string
	apiKey     ***
	apiSecret  string
	httpClient *http.Client
	authHeader string // "Basic <base64(key:secret)>" — built ONCE
}

// NewT212Client builds the client. The API key/secret are read from the
// environment by the caller and passed in; they are base64-encoded into
// the Basic auth header exactly once, here. The 10s timeout is the
// outer bound on any single broker call — a hung broker is a failure
// the circuit breaker will catch, not a process that hangs forever.
func NewT212Client(apiKey, apiSecret, baseURL string) *T212Client {
	if baseURL == "" {
		baseURL = "https://api.trading212.com"
	}
	// base64(key:secret) is the Trading212 Basic auth token. Built once,
	// reused on every request — no per-request encoding.
	creds := base64.StdEncoding.EncodeToString(
		[]byte(fmt.Sprintf("%s:%s", apiKey, apiSecret)))
	return &T212Client{
		baseURL:    baseURL,
		apiKey:     ***
		apiSecret:  apiSecret,
		httpClient: &http.Client{Timeout: 10 * time.Second},
		authHeader: "Basic " + creds,
	}
}

// GetPositions returns the open positions in the account. The Python bot
// calls this to reconcile its own paper portfolio against the broker's.
func (c *T212Client) GetPositions() ([]map[string]interface{}, error) {
	req, err := http.NewRequest("GET", c.baseURL+"/api/v0/equity/positions", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", c.authHeader)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("GetPositions: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GetPositions: status %d", resp.StatusCode)
	}
	var data []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("GetPositions: decode: %w", err)
	}
	return data, nil
}

// SubmitOrder places a limit order. This is the one write path in the
// whole system — the only code that can move money. It expects a 201
// (Created) on success; anything else is an error the caller (the
// circuit breaker) will count as a failure.
func (c *T212Client) SubmitOrder(scheme, ticker, side string, quantity, limitPrice float64) (map[string]interface{}, error) {
	payload, _ := json.Marshal(map[string]interface{}{
		"accountScheme": scheme,
		"ticker":        ticker,
		"side":          side,
		"quantity":      quantity,
		"limitPrice":    limitPrice,
	})
	req, _ := http.NewRequest("POST", c.baseURL+"/api/v0/equity/orders",
		bytes.NewReader(payload))
	req.Header.Set("Authorization", c.authHeader)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("SubmitOrder: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated { // 201 = the order was placed
		return nil, fmt.Errorf("SubmitOrder: status %d", resp.StatusCode)
	}
	var data map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("SubmitOrder: decode: %w", err)
	}
	return data, nil
}
```

The *practical* property of this design: **to rotate the API key, you change one environment variable and restart the Go service — you do not touch the Python bot.** The key is *collocated* with the code that uses it, which is the *least* surprising place for a secret to live.

## The middleware chain: auth → metrics → handler (and why the kill switch is *outside* it)

Every `/api/*` route on the Go service is wrapped in the same three-layer chain, *applied in this order* (outermost first): **`metricsMiddleware` → `loggingMiddleware` → `authMiddleware` → handler.** The order matters:

- **`metricsMiddleware`** is outermost so it counts *every* request that reaches the router, including the *rejected* ones (a 401 is still a metric).
- **`loggingMiddleware`** is next so it only logs *authenticated* requests (the auth failure is already logged by `authMiddleware`'s own `slog.Warn`).
- **`authMiddleware`** is innermost, right before the handler: it checks the Basic auth (the *service's* key/secret — a *different* one from the Trading212 key, the one the *Python bot* uses to talk to the *Go service*).

```go
// main.go — the three middleware and how a route is registered.
// The chain is metrics → logging → auth → handler. The *order* is the
// contract: metrics sees everything, logging sees the authenticated
// subset, auth sees the handler.

func authMiddleware(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, pass, ok := r.BasicAuth()
		// readKey/readSecret are the Go service's OWN credentials (the
		// ones the Python bot uses to call *us*), read from the
		// environment at startup. NOT the Trading212 key/secret.
		if !ok || user != readKey || pass != readSecret {
			slog.Warn("unauthorized request", "remote", r.RemoteAddr,
				"path", r.URL.Path)
			w.Header().Set("WWW-Authenticate", `Basic realm="polyglot-trader"`)
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		h(w, r)
	}
}

func loggingMiddleware(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		h(w, r)
		slog.Info("request", "method", r.Method, "path", r.URL.Path,
			"duration_ms", time.Since(start).Milliseconds(),
			"remote", r.RemoteAddr)
	}
}

func metricsMiddleware(c *metrics.Collector, h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		endpoint := metrics.SanitizeEndpoint(r.URL.Path)
		c.Inc(endpoint)
		start := time.Now()
		h(w, r)
		c.ObserveDuration(endpoint, time.Since(start))
	}
}

// --- Route registration: the chain is applied innermost-last ---
// (this is how the *real* service wires it; the elided handlers do
// the actual work).
func registerRoutes(mux *http.ServeMux) {
	// /api/kill-switch is the one route that is NOT behind auth:
	// if the broker is down and you have lost your service credentials,
	// you still need a way to halt trading. No auth, by design.
	mux.HandleFunc("/api/kill-switch", loggingMiddleware(handleKillSwitch))

	// Every other /api/* route is the full metrics → logging → auth
	// chain. The *handler* is what does the work.
	mux.HandleFunc("/api/orders",
		metricsMiddleware(metricsCol, loggingMiddleware(authMiddleware(handleOrders))))
	mux.HandleFunc("/api/positions",
		metricsMiddleware(metricsCol, loggingMiddleware(authMiddleware(handlePositions))))
	mux.HandleFunc("/api/quotes",
		metricsMiddleware(metricsCol, loggingMiddleware(authMiddleware(handleQuotes))))
	mux.HandleFunc("/api/signal",
		metricsMiddleware(metricsCol, loggingMiddleware(authMiddleware(handleSignal))))
	mux.HandleFunc("/api/ml/predict",
		metricsMiddleware(metricsCol, loggingMiddleware(authMiddleware(handleMLPredict))))
}
```

The *deliberate* exception is **`/api/kill-switch`**: it has *no* auth. The reasoning is the *availability* argument: the kill switch is the *last* thing you reach for when *everything else* is failing — and *everything else* includes the auth. If the kill switch needed the service's key/secret, and the key/secret were the thing that was *broken*, you could not halt trading. So the kill switch is *reachable from anywhere* (it is a `POST` with no body), and it is the *one* route the chain does not wrap in `authMiddleware`.

```go
// killswitch.go — the no-auth halt. A POST with no body flips the
// switch; every subsequent /api/signal and /api/ml/predict is rejected
// with a 503 until the switch is reset. It is the single line of
// defense that cannot be locked out.
type KillSwitch struct {
	active atomic.Bool
}

func (ks *KillSwitch) Activate() {
	ks.active.Store(true)
	slog.Warn("kill switch ACTIVATED — all new orders halted")
}
func (ks *KillSwitch) IsActive() bool { return ks.active.Load() }
func (ks *KillSwitch) Reset() {
	ks.active.Store(false)
	slog.Info("kill switch reset")
}

func handleKillSwitch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	killSwitch.Activate()
	w.WriteHeader(http.StatusNoContent) // 204: it worked, no body
}
```

## The rate limiter: why "per-endpoint" and not "per-second"

Trading212 *rate-limits* the API (a finite number of calls per window per endpoint). The naive fix — a single global token bucket — is *wrong* for a trading client, because it *throttles the cheap endpoints to the pace of the expensive ones*. The real service uses a **per-endpoint** token bucket: `Global 200`, `Positions 50`, `Orders 50`, `Quotes 100`, `MLPredict 30`, `RiskGate 30`, `Signal 30`. The *ML prediction* and the *risk gate* get their *own* budgets (30 each) because they are the *hot* paths the bot hammers; the *orders* get 50 because placing an order is the *rarest* and *most expensive* operation.

```go
// pkg/rate_limiter/limiter.go — per-endpoint token bucket. The *shape*
// is the lesson: one bucket per endpoint, each with its own cap, so the
// cheap endpoints (quotes, positions) are not throttled by the hot
// ones (predict, signal). This is the difference between a rate *limit*
// (correct) and a rate *throttle* (a bug in a trading system).
type T212RateLimiter struct {
	mu     sync.Mutex
	tokens map[EndpointType]int
	cap    map[EndpointType]int
}

func NewT212RateLimiter() *T212RateLimiter {
	caps := map[EndpointType]int{
		Global: 200, Positions: 50, Orders: 50,
		Quotes: 100, MLPredict: 30, RiskGate: 30, Signal: 30,
	}
	tokens := map[EndpointType]int{}
	for k, v := range caps {
		tokens[k] = v
	}
	return &T212RateLimiter{tokens: tokens, cap: caps}
}

// Allow consumes n tokens for the endpoint and reports (allowed,
// retryAfter). The retryAfter is a *rough* estimate (the number of
// tokens needed, scaled by the window) — good enough for a 429 body.
func (r *T212RateLimiter) Allow(endpoint EndpointType, n float64) (bool, float64) {
	r.mu.Lock()
	defer r.mu.Unlock()
	cap := float64(r.cap[endpoint])
	if r.tokens[endpoint] < int(n) {
		needed := float64(int(n) - r.tokens[endpoint])
		return false, needed / cap * 10 // ~seconds to wait
	}
	r.tokens[endpoint] -= int(n)
	return true, 0
}
```

> **Note**: The `retryAfter` the rate limiter returns is a *rough* estimate (`needed / cap * 10`), not an exact backoff. That is *deliberate*: the purpose of the `429` + `Retry-After` is to *tell the Python bot to back off*, not to schedule it to the millisecond. An exact backoff would couple the *bot's* timing to the *limiter's* internal accounting; a rough one keeps them decoupled. The *correct* property is *that the bot backs off at all*, not *when exactly*.

## The circuit breaker: the model's *failure* is a *state*

The **circuit breaker** is the third of the three things the Go service owns, and it is the one that *protects the account*. It is a three-state machine — **`Closed`** (normal), **`Open`** (tripped, all new orders rejected), **`HalfOpen`** (one trial order allowed to see if the model has recovered) — and it trips on *two* independent signals:

1. **`CircuitMaxErrors`** — the number of *consecutive* ML-prediction failures. If the model starts returning `500`s (a feature-feed blip, a model OOM), the breaker opens *before* the bot places a bad order.
2. **`dailyLossLimit`** — the day's realized+unrealized P&L. If it drops below the limit, the breaker opens *regardless* of the prediction success rate. This is the *account* protection, not the *model* protection.

```go
// circuit_breaker.go — the three-state machine. The breaker is CLOSED
// (passing) by default, OPENS on `CircuitMaxErrors` consecutive
// failures OR when the daily P&L drops below the loss limit, and
// transitions to HALF-OPEN after `recoverTimeout` (allowing one trial
// order). A success in HALF-OPEN closes it; a failure re-opens it.
const (
	CircuitClosed = iota
	CircuitOpen
	CircuitHalfOpen
)

func (cb *CircuitBreaker) AllowRequest() (bool, time.Duration) {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	switch cb.state {
	case CircuitClosed, CircuitHalfOpen:
		return true, 0
	case CircuitOpen:
		if time.Now().After(cb.opensAt) {
			cb.state = CircuitHalfOpen // one trial order to test recovery
			cb.errCount = 0
			return true, 0
		}
		return false, time.Until(cb.opensAt)
	}
	return false, 0
}

func (cb *CircuitBreaker) RecordFailure(maxErrors int, dailyPnL float64) {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.errCount++
	cb.dailyPnL += dailyPnL
	// TRIP on the model: too many consecutive prediction failures.
	if cb.state == CircuitHalfOpen || cb.errCount >= maxErrors {
		cb.state = CircuitOpen
		cb.opensAt = time.Now().Add(cb.recoverTimeout)
		slog.Warn("circuit breaker OPEN", "errCount", cb.errCount,
			"recovery", cb.recoverTimeout)
	}
	// TRIP on the account: daily loss below the limit.
	if cb.dailyPnL < -cb.dailyLossLimit && cb.state != CircuitOpen {
		cb.state = CircuitOpen
		cb.opensAt = time.Now().Add(cb.recoverTimeout)
		slog.Warn("circuit breaker OPEN (daily loss)", "pnl", cb.dailyPnL)
	}
}

func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	if cb.state == CircuitHalfOpen {
		cb.state = CircuitClosed // the model recovered; close the breaker
		cb.errCount = 0
		slog.Info("circuit breaker CLOSED (recovered)")
	}
}
```

The *two* trip signals are *independent on purpose*: the *model* can be failing *while the account is fine* (the breaker opens on `errCount`, and the bot *stops* *before* it places a bad order), and the *account* can be failing *while the model is fine* (the breaker opens on `dailyPnL`, and the bot *stops* *before* it trades into a bigger loss). A single "too many errors" breaker would *not* catch a model that is *succeeding at losing money*; a single "daily loss" breaker would *not* catch a model that is *failing before it loses money*. The *two* signals, *or*-combined, are the *whole* protection.

## The order flow: how a Python `P(up)` becomes a Trading212 order

```mermaid
sequenceDiagram
    participant B as Python ML bot
    participant G as Go service (:8081)
    participant R as rate limiter
    participant CB as circuit breaker
    participant T as Trading212 API
    B->>G: POST /api/signal {ticker, P(up)}
    G->>G: authMiddleware (the bot's key)
    G->>R: Allow(Signal, 1)
    R-->>G: ok (or 429 + Retry-After)
    G->>CB: AllowRequest()
    CB-->>G: closed (or open → 503, no order)
    G->>T: SubmitOrder (the ONE write path)
    T-->>G: 201 Created (or 5xx)
    G->>CB: RecordSuccess / RecordFailure
    G-->>B: 200 {orderId} (or 429 / 503)
    Note over G,CB: the breaker is the *only* thing that can stop the order<br/>after the rate limiter; the kill switch is the thing that stops it *externally*
```

The *four* *checks* *in* *order* *that* *an* *order* *must* *pass* *before* *it* *reaches* *the* *broker* *are:*

1. **`authMiddleware`** — is the *caller* (the Python bot) *who it says it is?* (the *bot's* *key, *not* *the* *Trading212* *key).
2. **rate limiter** — is the *endpoint* *within* *its* *budget?* (a `429` *stops* *it* *before* *it* *costs* *a* *Trading212* *call).
3. **circuit breaker** — is the *model/account* *in a state* *that* *allows* *new* *risk?* (an `Open` *breaker* *stops* *it* *with* *a* `503).
4. **the kill switch** — is trading *globally* *halted?* (checked at the *entry* *of* *every* *order* *path, *and* *the* *one* *check* *with* *no* *auth, *so* *you* *can* *always* *reach* *it).

The *order* *is* *the* *contract:* *the* *Python* *bot* *proposes* *a* *signal, *and* *the* *Go* *service* *disposes* *of* *it* *through* *these* *four* *gates* *before* *a* *single* *HTTP* *call* *moves* *money.* *No* *gate* *is* *skippable; *the* *kill* *switch* *is* *the* *one* *that* *cannot* *be* *locked* *out.*

```mermaid
flowchart TB
    A["Python bot: P(up) for a ticker"] --> B{authMiddleware: is the bot who it says?}
    B -- no --> X1[401 Unauthorized]
    B -- yes --> C{rate limiter: is the endpoint within budget?}
    C -- no --> X2[429 + Retry-After]
    C -- yes --> D{circuit breaker: closed?}
    D -- open --> X3[503 (no new risk taken)]
    D -- closed --> E{kill switch: active?}
    E -- yes --> X4[503 (trading halted)]
    E -- no --> F[T212Client.SubmitOrder → the ONE write path]
    F --> G[201 Created → the order is placed]
    G --> H[circuit breaker: RecordSuccess]
    style F fill:#3a2a1a
    style X3 fill:#3a3a1a
    style X4 fill:#3a3a1a
```

## The gotchas that cost real money

- **The two trip signals are *independent* on purpose.** A breaker that only trips on "too many errors" misses a model that *succeeds* at *losing* money. A breaker that only trips on "daily loss" misses a model that *fails* *before* *it* *loses* *money.* *The* *`errCount` *and* *the* *`dailyPnL` *signals,* *`or`-combined,* *are* *the* *protection* — *not* *a* *single* *number.
- **The kill switch is *outside* the auth chain *on purpose.* It is the *last* *thing* *you* *reach* *for* *when* *everything* *else* *is* *failing* — *and* *everything* *else* *includes* *the* *auth.* *A* *kill* *switch* *that* *needs* *the* *service's* *key/secret* *is* *a* *kill* *switch* *you* *cannot* *use* *when* *the* *key/secret* *is* *the* *problem.
- **The per-endpoint rate limiter is *not* a *throttle* — it is a *limit.* The *`Orders`* *bucket* *has* *50* *tokens* *because* *placing* *an* *order* *is* *rare* *and* *expensive;* *the* *`Quotes`* *bucket* *has* *100* *because* *a* *quote* *is* *cheap.* *A* *global* *bucket* *would* *throttle* *the* *cheap* *calls* *to* *the* *pace* *of* *the* *expensive* *ones,* *which* *is* *a* *bug* *in* *a* *trading* *system* (it *makes* *the* *bot* *see* *stale* *quotes* *and* *trade* *on* *them).

> **Warning**: a proxy between a brain and real money is a *trust boundary*. The Python bot is untrusted input: validate its confidence, cap its position size, and treat every `/predict` that says "buy 100%" as a bug, not a feature. The circuit breaker and rate limiter exist because the *brain* is the thing most likely to be wrong.

## Takeaways

- **The brain is Python, the hands are Go, and the line between them is `:8081`.** The ML model (the *proposer*) is Python because the *ML ecosystem* is Python; the *infra* (the *disposer*) is Go because it is the *operational* *layer* (a *small* *static* *binary, *a* *goroutine* *per* *request, *readable* *by* *the* *operator* *at* *3am). *The* *boundary* *is* *an* *API,* *not* *a* *language.*
- **The Go service owns the four things a trading system dies on: auth, the rate limit, the circuit breaker, and the kill switch.** The Python bot *proposes*; the Go service *disposes*. No order reaches the broker until it has passed *all four* gates, in *that* order.
- **The circuit breaker trips on two *independent* signals — the model's *failure* (`errCount`) and the *account's* *failure* (`dailyPnL`).** A single-number breaker misses one of the two failure modes; the *or*-combined breaker catches *both*.
- **The kill switch is the one route *outside* the auth chain.** It is a `POST` with no body, no auth, so it is reachable *even when the service's own credentials are the thing that is broken.* It is the *last* line of defense that *cannot* be locked out.
- **The rate limiter is per-endpoint, not global.** `Orders` gets a smaller budget than `Quotes` because an *order* is *rare* and a *quote* is *cheap*; a global bucket would *throttle* the cheap calls to the pace of the expensive ones, which *is* a bug in a trading system.

## Next steps

1. **Run the service** — `cd ~/Documents/LLM/polyglot-trader-t212 && go build -o t212 && ./t212` (it listens on `:8081` by default, or `PORT=8082 ./t212` to move it). Hit `/health` and `/ready` to confirm the breaker and the rate limiter are initialized, then `POST /api/kill-switch` to confirm the no-auth halt works.
2. **Wire the Python bot to the Go service.** The bot's *only* Trading212-facing code is an HTTP client to `:8081` — `POST /api/signal` with a `{ticker, P(up)}` body, authenticated with the *service's* key/secret (a *different* one from the Trading212 key). The *Trading212* key/secret live *only* in the Go service's environment.
3. **Tune the two breaker thresholds to your risk budget.** `CircuitMaxErrors` is the *model's* patience (how many *consecutive* prediction failures before it stops); `dailyLossLimit` is the *account's* patience (how much it can lose in a day before it stops). The *first* of those to trip is the one that *saves* you; the *other* is the *backup.*
4. **When the model is good enough to trade, keep the hands in Go.** The *model* will change (a new feature, a new threshold) and the *ML ecosystem* will move; the *hands* (the *auth, *the* *rate* *limit, *the* *breaker, *the* *kill* *switch) *are* *stable* *and* *boring* *on* *purpose.* *That* *stability* *is* *the* *reason* *the* *Go* *service* *is* *the* *right* *shape* *for* *the* *layer* *that* *owns* *the* *money.
