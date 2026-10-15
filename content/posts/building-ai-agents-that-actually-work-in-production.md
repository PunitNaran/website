---

date: 2026-10-15T09:00:00
draft: true
title: "Building AI Agents That Actually Work in Production"
summary: Building AI Agents That Actually Work in Production
categories:
  - Artificial Intelligence
---


Most "AI agent" demos die in the gap between a 10-call happy path and the
1,000-call production reality. This post is about the production gap: the
patterns that keep an LLM-driven system *boring* (in the good sense).

## The three properties that matter

1. **Bounded context.** The model should never see more than it can use.
   A 200k-token window is not a feature; it's a place where retrieval
   silently returns 40 near-misses and the model hallucinates the 41st.
   Ship a retriever with a **hard top-k=5** and a **relevance threshold**
   (e.g. cosine ≥ 0.72) and *no result beats a no-answer*.
2. **Idempotent actions.** Every side effect (write, send, buy) must be
   safe to replay. Model: an *intent* (what the agent wants) vs a
   *confirmation* (what the world agreed to). The agent emits intents; a
   separate, deterministic executor applies them with a dedup table keyed
   by `(intent_id, action_hash)`.
3. **Degrade, don't die.** A failed tool call is a *signal*, not an
   exception. The agent's next step should be "the tool is unavailable,
   here is what I can still do", not a 500.

## A minimal agent loop that respects all three

```go
type Agent struct {
    llm    LLM          // your provider
    tools  map[string]Tool
    mem    *DedupStore  // intent -> applied (idempotency)
}

func (a *Agent) Run(ctx context.Context, goal string) (string, error) {
    msgs := []Message{{Role: "system", Content: systemPrompt()}}
    for i := 0; i < maxSteps; i++ {
        resp, err := a.llm.Chat(ctx, msgs, a.toolSchemas())
        if err != nil {
            return "", err // the only place an error is fatal
        }
        if resp.ToolCall == nil {
            return resp.Content, nil // done
        }
        // deterministic executor: dedup + retry budget
        outcome, err := a.exec(resp.ToolCall)
        msgs = append(msgs, resp, outcome)
        if err != nil {
            outcome = degrade(err) // "tool X unavailable" message, not a crash
        }
    }
    return "", errors.New("max steps")
}
```

The `exec` step is where the dedup table lives:

```go
func (a *Agent) exec(call ToolCall) (Message, error) {
    key := hash(call.ID + call.Args)
    if prior, ok := a.mem.Seen(key); ok {
        return Message{Content: "already applied: " + prior}, nil
    }
    out, err := a.tools[call.Name].Do(call.Args)
    a.mem.Mark(key)
    return out, err
}
```

## Retrieval: the part everyone gets wrong

- **Embed the *question*, not the document.** Chunk the document into
  ~512-token overlapping (64) blocks, embed each, store the *query-time*
  embedding in the index. Don't pre-compute a "summary embedding" and
  expect it to answer new questions.
- **Rerank, don't trust the first pass.** A cross-encoder reranker over the
  top-20 is cheap (one 8B-class model, ~50ms) and fixes the "40 near
  misses" problem.
- **Cite or be silent.** Every generated claim that cites a source must
  carry a span (doc id, char range). A citation you can't locate is a
  hallucination with a bibliography.

## The 500-line rule

If your agent is one file, one class, and under 500 lines, it's
*inspectable*. The minute you need a DAG, an event bus, and a workflow
engine, you have built a platform, not an agent. Most production agents
that are boring are ~300 lines of loop + a table of tools + a dedup store.
Everything else is the *platform* that hosts them, and that can be added
when (not before) one agent starts failing in ways the others share.

## What I'd ship this week

1. A single-purpose agent (one tool domain, e.g. "support ticket triage").
2. A 5-step max loop, hard tool budget of 3.
3. A dedup table in SQLite keyed by `(intent_id, action_hash)`.
4. A "no-result" path that returns *no result, here's what I can do* —
   not an apology, a *menu*.
5. A log line per step: `step=3 tool=order_lookup args=… outcome=ok`.
   That log line is your entire observability story until you need more.
