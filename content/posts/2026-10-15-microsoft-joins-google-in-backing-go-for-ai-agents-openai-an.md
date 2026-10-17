---

date: 2026-10-15T09:00:00
draft: false
title: "Microsoft Joins Google in Backing Go for AI Agents — OpenAI and Anthropic Lag"
summary: Go has become the lingua franca of cloud infrastructure, and now Microsoft (alongside Google) is building its agent framework in Go — while OpenAI and Anthropic's agent tooling is still Python-first. The post is the systems case for why Go is the agent-era infrastructure language.
categories:
  - Go
  - AI
  - Cloud
---

# Microsoft Joins Google in Backing Go for AI Agents

The New Stack's framing is a *market* story with a *systems* core: **Go has become the lingua franca of cloud infrastructure** (container orchestration, CI/CD pipelines, the *entire* operational layer of the cloud), and **Microsoft — alongside Google — is now building its agent framework in Go**, while **OpenAI and Anthropic's agent tooling is still Python-first.** The *headline* is "Microsoft joins Google"; the *substance* is *why* Go is the *right* language for the *infrastructure* layer of the agent era, and *why* the Python-first incumbents are *lagging* on that specific axis (not on the *ML* axis, where Python is *right*).

This post is the *systems* case, expanded: *what* *"*the* *lingua* *franca* *of* *cloud* *infrastructure*" *actually* *means* *as* *a* *measurable* *property* (and *why* *Go* *maximizes* *it), *the* *Python-vs-Go* *split* *that* *the* *agent* *era* *is* *making* *explicit* (Python *for* *the* *model,* *Go* *for* *the* *infrastructure), *the* *two* *concrete* *reasons* *OpenAI/Anthropic* *are* *Python-first* *on* *the* *agent* *tooling* (and *why* *that* *is* *a* *lag,* *not* *a* *preference), *and* *the* *practical* *rule* *for* *anyone* *building* *an* *agent* *system* *that* *has* *to* *run* *in* *production.

## What "the lingua franca of cloud infrastructure" actually means (and why Go maximizes it)

"*Lingua* *franca*" *is* *not* *a* *vibe; *it* *is* *a* *measurable* *property:* **the* *language* *that* *the* *shared* *operational* *layer* *of* *the* *cloud* *is* *written* *in.** *The* *cloud's* *operational* *layer* *is* *the* *thing* *that* *runs* *between* *the* *user's* *application* *and* *the* *hardware: *the* *container* *runtime* (Docker, *containerd), *the* *orchestrator* (Kubernetes), *the* *CI/CD* *system* (the *pipelines* *that* *build* *and* *deploy), *the* *service* *mesh,* *the* *service* *discovery,* *the* *load* *balancer,* *the* *observability* *stack* (the *metrics,* *the* *tracing, *the* *logging). *This* *layer* *is* *the* *"*infrastructure" *of* *the* *cloud,* *and* *it* *is* *overwhelmingly* *Go:** *Docker* *is* *Go,* *Kubernetes* *is* *Go,* *containerd* *is* *Go,* *etcd* *is* *Go,* *Prometheus* *is* *Go,* *Cilium* *is* *Go,* *the* *Cilium* *FQDN* *policy* *engine* *is* *Go.* *The* *reason* *Go* *won* *that* *layer* *is* *the* *same* *reason* *it* *is* *the* *right* *language* *for* *the* *agent* *infrastructure* *layer:** *Go* *is* *the* *language* *that* *is* *cheap* *to* *run* *as* *a* *small* *binary* *on* *every* *node,* *cheap* *to* *compile* *to* *a* *single* *static* *binary* (no *runtime* *to* *ship), *cheap* *to* *read* *for* *a* *non-author* (small *surface, *readable* *errors), *and* *cheap* *to* *run* *at* *high* *concurrency* (the *goroutine* *model* *is* *the* *right* *model* *for* *a* *service* *that* *talks* *to* *many* *things* *at* *once).

The *consequence* *for* *the* *agent* *era:* **the* *agent* *infrastructure* *layer* *is* *the* *same* *kind* *of* *thing* *as* *the* *cloud* *infrastructure* *layer** *— *a* *service* *that* *runs* *on* *every* *node,* *talks* *to* *many* *things* *at* *once,* *and* *has* *to* *be* *cheap* *to* *run* *and* *cheap* *to* *read* *for* *the* *operator* *who* *maintains* *it.** *Go* *is* *the* *language* *that* *maximizes* *all* *four* *of* *those* *properties,* *which* *is* *why* *"*Microsoft* *joins* *Google* *in* *backing* *Go* *for* *AI* *agents" *is* *a* *real* *strategic* *move* *and* *not* *a* *marketing* *one.

```mermaid
flowchart LR
    subgraph infra["the cloud's operational layer (the 'lingua franca')"]
        A[Docker / containerd]
        B[Kubernetes]
        C[etcd]
        D[Prometheus / observability]
        E[Cilium / service mesh]
    end
    subgraph agents["the agent infrastructure layer (same shape)"]
        F[agent runtime (per-node)]
        G[agent orchestration / service discovery]
        H[agent metrics / tracing]
    end
    infra -->|all Go| X[Go]
    agents -->|Microsoft + Google now| X
    style X fill:#1a3a1a
```

The *one-line* *summary:* **the* *cloud's* *operational* *layer* *is* *Go* *because* *Go* *is* *the* *language* *that* *is* *cheap* *as* *a* *per-node* *binary,* *cheap* *to* *read* *for* *a* *non-author,* *and* *cheap* *to* *run* *at* *high* *concurrency.** *The* *agent* *infrastructure* *layer* *is* *the* *same* *shape,* *which* *is* *why* *Microsoft* *and* *Google* *are* *building* *it* *in* *Go* *and* *not* *in* *Python.

## The Python-vs-Go split the agent era is making explicit

The *New* *Stack* *headline* *is* *"*OpenAI* *and* *Anthropic* *lag," *and* *the* *lag* *is* *on* *one* *specific* *axis:* **the* *infrastructure* *layer* *of* *the* *agent* *system.** *The* *reason* *is* *the* *Python-vs-Go* *split* *that* *the* *agent* *era* *is* *making* *explicit:*

- **Python* *is* *the* *right* *language* *for* *the* *model* *layer.** *The* *ML* *ecosystem* (the *training* *frameworks, *the* *inference* *engines, *the* *model* *serving) *is* *Python,* *and* *it* *is* *Python* *because* *the* *ML* *research* *community* *is* *Python.* *OpenAI* *and* *Anthropic* *are* *Python-first* *on* *the* *model* *layer* *because* *the* *model* *layer* *is* *where* *the* *ML* *ecosystem* *lives,* *and* *that* *is* *correct.*

- **Go* *is* *the* *right* *language* *for* *the* *infrastructure* *layer.** *The* *agent* *runtime* (the *thing* *that* *runs* *on* *every* *node,* *manages* *the* *agent's* *lifecycle,* *talks* *to* *the* *model* *API,* *handles* *the* *tool* *calls) *is* *infrastructure,* *not* *ML.* *It* *has* *to* *run* *at* *high* *concurrency* (many *agents* *at* *once), *it* *has* *to* *be* *cheap* *to* *deploy* *as* *a* *small* *binary* (no *Python* *interpreter* *to* *ship), *and* *it* *has* *to* *be* *readable* *by* *the* *operator* *who* *maintains* *it* (a *non-author). *Go* *maximizes* *all* *three.*

- **The* *lag* *is* *that* *OpenAI* *and* *Anthropic* *are* *still* *Python-first* *on* *the* *infrastructure* *layer** *— *their* *agent* *tooling* *is* *Python* *because* *it* *was* *written* *in* *the* *same* *language* *as* *the* *model* *layer* (the *path* *of* *least* *resistance), *and* *the* *convenience* *of* *one* *language* *for* *both* *layers* *is* *outweighing* *the* *infrastructure* *cost* *of* *a* *Python* *interpreter* *on* *every* *node.* *The* *New* *Stack* *is* *naming* *the* *lag* *because* *the* *infrastructure* *layer* *is* *where* *the* *agent* *system* *lives* *and* *dies* (a *Python* *interpreter* *on* *every* *node* *is* *a* *100MB* *runtime* *that* *has* *to* *be* *kept* *updated), *and* *the* *Go* *answer* *is* *a* *10MB* *static* *binary.*

The *practical* *rule* *that* *follows:* **the* *agent* *era* *has* *two* *layers,* *and* *they* *want* *different* *languages:** *the* *model* *layer* *is* *Python* (because *the* *ML* *ecosystem* *is* *Python), *and* *the* *infrastructure* *layer* *is* *Go* (because *the* *operational* *layer* *is* *the* *shape* *Go* *maximizes). *A* *system* *that* *puts* *both* *layers* *in* *one* *language* *is* *a* *system* *that* *is* *optimizing* *for* *convenience* *at* *the* *cost* *of* *the* *layer* *that* *matters* *in* *production* (the *infrastructure* *layer).

```go
// The two-layer split, made concrete. The model layer is Python
// (the ML ecosystem); the infrastructure layer is Go (the
// operational layer). The Go agent runtime talks to the Python
// model service over gRPC/HTTP — the boundary is the API, not the
// language.
package main

import (
	"context"
	"log/slog"
	"net"
)

// AgentRuntime is the Go infrastructure layer: a small static
// binary that runs on every node, manages the agent lifecycle,
// and talks to the Python model service over gRPC. 10MB, no
// interpreter to ship.
func main() {
	// The gRPC client to the Python model service (the model
	// layer). The boundary is the API; the language is the
	// implementation detail.
	conn, err := grpc.NewClient("model-service:50051",
		grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		slog.Error("connect model service", "err", err)
		return
	}
	client := NewModelClient(conn)

	// The agent loop: high concurrency (many agents at once),
	// cheap to run (a goroutine per agent), cheap to read
	// (small surface, readable errors).
	for req := range agentRequests {
		go func(r AgentRequest) {
			resp, err := client.Predict(context.Background(), r)
			if err != nil {
				slog.Error("predict failed", "agent", r.ID, "err", err)
				return
			}
			r.Dispatch(resp) // the tool calls, the state, the reply
		}(req)
	}
	_ = net.Listen // (the gRPC server setup elided for brevity)
}
```

## Why the Python-first incumbents are "lagging" (and why it is not a Python problem)

The *New* *Stack* *is* *careful* *not* *to* *say* *"*Python* *is* *bad"; *it* *is* *saying* *"*Python-first* *on* *the* *infrastructure* *layer* *is* *a* *lag." *The* *reason* *it* *is* *a* *lag* *is* *the* *three* *infrastructure* *costs* *of* *a* *Python* *interpreter* *on* *every* *node:*

1. **The* *runtime* *cost:** *a* *Python* *interpreter* *is* *a* *100MB* *runtime* *that* *has* *to* *be* *shipped* *to* *every* *node,* *kept* *updated* (the *security* *patches), *and* *started* *on* *every* *boot.* *A* *Go* *binary* *is* *10MB* *and* *static* (no *runtime* *to* *ship). *At* *the* *scale* *of* *a* *cloud* *with* *thousands* *of* *nodes,* *the* *100MB* *times* *the* *node* *count* *is* *a* *real* *cost.

2. **The* *concurrency* *cost:** *Python's* *GIL* *means* *a* *Python* *process* *cannot* *use* *more* *than* *one* *core* *for* *CPU-bound* *work,* *and* *the* *async* *model* *is* *a* *separate* *concern* (the *event* *loop). *Go's* *goroutine* *model* *is* *the* *native* *high-concurrency* *model: *a* *goroutine* *per* *agent* *is* *cheap* (a *few* *KB* *of* *stack), *and* *the* *runtime* *schedules* *them* *across* *all* *cores* *without* *an* *event* *loop.* *For* *a* *service* *that* *manages* *thousands* *of* *agents* *at* *once,* *the* *goroutine* *model* *is* *the* *right* *model.

3. **The* *readability* *cost:** *the* *operator* *who* *maintains* *the* *infrastructure* *layer* *is* *a* *non-author* (they *did* *not* *write* *the* *code). *Go's* *small* *surface* *and* *readable* *errors* *make* *the* *reading* *cost* *low; *Python's* *dynamic* *typing* *and* *the* *metaclass* *and* *decorator* *and* *`__init__` *surface* *make* *the* *reading* *cost* *higher* *for* *a* *non-author.* *The* *infrastructure* *layer* *is* *read* *by* *operators* *at* *3am,* *and* *the* *reading* *cost* *is* *the* *cost.

The *one-line* *summary:* **OpenAI* *and* *Anthropic* *are* *Python-first* *on* *the* *infrastructure* *layer* *because* *the* *model* *layer* *is* *Python* *and* *the* *path* *of* *least* *resistance* *is* *one* *language* *for* *both,** *but* *the* *infrastructure* *layer* *is* *where* *the* *agent* *system* *lives* *and* *dies,* *and* *the* *three* *costs* (runtime, *concurrency, *readability) *are* *the* *lag.* *Microsoft* *and* *Google* *are* *building* *the* *infrastructure* *layer* *in* *Go* *because* *Go* *is* *the* *language* *that* *minimizes* *those* *three* *costs.

## The practical rule for building an agent system that has to run in production

1. **The* *model* *layer* *is* *Python** (the *ML* *ecosystem* *is* *Python; *that* *is* *correct* *and* *not* *a* *lag). *The* *infrastructure* *layer* *is* *Go* (the *operational* *layer* *is* *the* *shape* *Go* *maximizes). *The* *boundary* *between* *the* *two* *is* *an* *API* (gRPC/HTTP), *not* *a* *language* *barrier.

2. **The* *infrastructure* *layer* *is* *a* *small* *static* *binary** *per* *node** *— *10MB,* *no* *interpreter,* *a* *goroutine* *per* *concurrent* *agent.* *The* *Go* *answer* *is* *a* *single* *static* *binary* *that* *you* *deploy* *to* *every* *node* *and* *that* *starts* *in* *milliseconds.* *The* *Python* *answer* *is* *a* *100MB* *runtime* *plus* *a* *package* *install* *on* *every* *node.*

3. **The* *operator* *reads* *the* *infrastructure* *code* *at* *3am,** *not* *the* *model* *code.** *The* *reading* *cost* *is* *the* *cost* *of* *the* *infrastructure* *layer.* *Go's* *small* *surface* *and* *readable* *errors* *are* *the* *reason* *the* *reading* *cost* *is* *low.* *A* *codebase* *that* *the* *operator* *cannot* *read* *is* *a* *codebase* *that* *the* *operator* *cannot* *fix* *at* *3am.*

4. **The* *lag* *is* *a* *cost,* *not* *a* *showstopper:** *a* *Python-first* *agent* *infrastructure* *works* (it *is* *what* *OpenAI* *and* *Anthropic* *ship), *but* *it* *pays* *the* *three* *infrastructure* *costs* *on* *every* *node.* *The* *Go* *answer* *is* *the* *lower-cost* *path* *to* *the* *same* *functionality,* *and* *the* *New* *Stack* *is* *naming* *the* *delta.*

```mermaid
flowchart TB
    A[agent system in production] --> B[model layer (Python: the ML ecosystem)]
    A --> C[infrastructure layer (Go: the operational layer)]
    B -->|gRPC / HTTP| C
    C --> D[per-node: 10MB static binary, goroutine per agent]
    C --> E[the operator reads the Go code at 3am]
    style B fill:#1a3a1a
    style C fill:#3a2a1a
    style D fill:#1a3a1a
```

## The bet, in code

The pattern Microsoft (and Google) are standardizing is the same loop you'd write by hand: a small Go service that *wraps* the LLM call and *exposes* it as an HTTP endpoint the rest of the system talks to:

```go
// The minimal "Go agent" service: an LLM call wrapped as an
// HTTP endpoint. The LLM is a *dependency*, not the *runtime*.
// The Go binary is what the *rest* of the system depends on.
package main

import (
	"fmt"
	"net/http"
)

func handler(w http.ResponseWriter, r *http.Request) {
	// The LLM is called *from* Go, not the other way round.
	// Go is the *host*, the LLM is a *tool* the host invokes.
	fmt.Fprint(w, "agent: ok")
}

func main() {
	http.HandleFunc("/ask", handler)
	http.ListenAndServe(":8080", nil)
}
```

| Company | Go-for-AI posture | What it standardized |
|---|---|---|
| Google | Go is the *default* for LLM *serving* (the model runs on Go infra) | the *inference* side |
| Microsoft | Go for the *agent* layer (the *caller* of the LLM) | the *agent* side |
| OpenAI / Anthropic | Python-first, Go a second-order choice | the *training* side (not Go's) |

The split is the whole story: **Go owns the *serving* and the *agent* layer, while Python owns *training*.** The "lag" isn't that OpenAI and Anthropic don't use Go — it's that their *primary* workloads (training, data pipelines) are Python-native, so Go never becomes the *default* there.

> **Note**: "Go for AI agents" is a *serving-and-orchestration* claim, not a *training* claim. The bet is that the *hot path* of an agent (the *HTTP* layer, the *tool* calls, the *state*) is Go's sweet spot, and the *training* (where Python rules) is a *separate* system the agent *talks to*, not *lives in*.

> **Warning**: the "Go is the agent language" narrative is *vendor-shaped*. Both Google and Microsoft have a *business* reason to prefer Go for the *serving* layer (it's their *infra* language), and the *training* workloads — where Python's dominance is *real* and *uncontested* — are *not* where the Go bet lands. Take the "Go for AI" claim at its *serving*-layer value, not as a *training*-language claim.

## Takeaways

- **The* *lingua* *franca* *of* *cloud* *infrastructure* *is* *Go** *because* *Go* *is* *the* *language* *that* *minimizes* *the* *three* *infrastructure* *costs* (the *per-node* *runtime* *cost, *the* *concurrency* *cost, *the* *reading* *cost). *Docker, *Kubernetes, *etcd, *Prometheus, *Cilium* *are* *all* *Go,* *and* *that* *is* *the* *reason.*
- **The* *agent* *era* *has* *two* *layers,** *and* *they* *want* *different* *languages:** *the* *model* *layer* *is* *Python* (the *ML* *ecosystem), *and* *the* *infrastructure* *layer* *is* *Go* (the *operational* *layer). *The* *boundary* *is* *an* *API,* *not* *a* *language* *barrier.
- **OpenAI* *and* *Anthropic* *are* *Python-first* *on* *the* *infrastructure* *layer** *because* *the* *model* *layer* *is* *Python* *and* *the* *path* *of* *least* *resistance* *is* *one* *language* *for* *both.* *The* *lag* *is* *the* *three* *infrastructure* *costs* *of* *a* *Python* *interpreter* *on* *every* *node* (the *100MB* *runtime, *the* *GIL* *concurrency* *cost, *the* *reading* *cost).
- **The* *practical* *rule* *for* *a* *production* *agent* *system:** *the* *model* *layer* *is* *Python,* *the* *infrastructure* *layer* *is* *Go,* *the* *boundary* *is* *an* *API.* *The* *infrastructure* *layer* *is* *a* *10MB* *static* *binary* *per* *node* *with* *a* *goroutine* *per* *concurrent* *agent.* *The* *operator* *reads* *that* *code* *at* *3am,* *and* *the* *reading* *cost* *is* *the* *cost.*

## Next steps

1. **Read the New Stack article in full** for the *specific* Microsoft agent-framework Go announcement and the *OpenAI/Anthropic* Python-first comparison. The *one-liner* is the *thesis*; *the* *article* is the *evidence.
2. **If you are building an agent system, split the two layers explicitly: Python for the model, Go for the infrastructure.** *The* *boundary* *is* *a* *gRPC/HTTP* *API.* *The* *infrastructure* *layer* *is* *a* *small* *static* *binary* *per* *node.*
3. **If you are running a Python-first agent infrastructure in production, measure the three costs** (the *per-node* *runtime* *size, *the* *concurrency* *ceiling* *under* *the* *GIL, *the* *operator's* *reading* *cost) *and* *price* *the* *Go* *alternative.* *The* *delta* *is* *the* *lag* *the* *New* *Stack* *is* *naming.
