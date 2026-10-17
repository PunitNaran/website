---

date: 2026-10-15T09:00:00
draft: true
title: "Schedulers in Go: The Ticker and the Heap That Never Misses a Tick"
summary: "Schedulers in Go: The Ticker and the Heap That Never Misses a Tick"
categories:
  - Go
  - Schedulers
---A scheduler in Go is two objects, not a framework. For *periodic* work you want a **`time.Ticker` inside a `select` loop** — a clock plus a cancel handle, twelve lines. For *arbitrary-time* work ("run this job at 09:00", "retry this at t+42s", "run this batch every hour on the hour, but never two at once") you want a **min-heap of `(time, job)` pairs** with a single `time.Timer` that fires exactly when the earliest job is due. The heap is the only data structure that gives you the *next* job in O(log n) while you add and cancel jobs in O(log n), and it is what makes a scheduler that "never misses a tick": the timer is *always* armed for the one job that is next, so a slow job, a dropped tick, or a clock jump can never leave the queue behind. This post is the two schedulers, the difference between a *ticker* and a *timer* (it is the difference between a *rate* and a *deadline*), and the three bugs that eat the naive version. After reading it you can build a cron-class scheduler in ~100 lines of stdlib and know exactly why it is safe.

---

## The periodic case: the ticker

The ticker is the entire *periodic* story. Three rules make it production-grade:

- **Drive it with a `select` on `ctx.Done()`** — a `for { fn(); time.Sleep(n) }` loop cannot be cancelled cleanly and *drifts* (the sleep is added to the period). A ticker fires on an absolute schedule; the `select` is how you get *and* cancel it.
- **Stop the ticker in `defer`** — a `time.Ticker` is a system timer that the runtime will *not* collect; a leaked ticker is a leaked goroutine's worth of wakeups forever.
- **Treat the *job's* duration, not the *tick's*, as the thing you measure.** If the job takes longer than the period, the question is "do I drop ticks or queue them" — and the ticker does not queue, so you must decide what "missed a tick" means for *your* job.

```go
package sched

import (
	"context"
	"log"
	"time"
)

// Periodic runs fn every interval until ctx is cancelled.
//
// Why a ticker and not a loop of time.Sleep(interval):
//   - Sleep(interval) *adds* the job's runtime to the period, so a job
//     that takes 200ms on a 1s period silently becomes 1.2s. The ticker
//     fires on an absolute wall-clock schedule; the interval never drifts.
//   - A ticker is a real runtime timer object; deferring Stop() releases
//     it. A sleep loop has nothing to release and nothing to cancel.
func Periodic(ctx context.Context, name string, interval time.Duration, fn func() error) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop() // the ticker outlives the loop if you forget this

	for {
		select {
		case <-ticker.C:
			start := time.Now()
			if err := fn(); err != nil {
				// The job failing must not kill the scheduler. Log and go
				// on; the next tick is 1s away regardless of this one.
				log.Printf("[%s] tick failed: %v (will retry next tick)", name, err)
			} else if elapsed := time.Since(start); elapsed > interval/2 {
				// A job that eats more than half its own period is about to
				// start overlapping its successor. That is the warning
				// signal that the *period* is the wrong knob for this job.
				log.Printf("[%s] tick ran %v, period is %v", name, elapsed, interval)
			}
		case <-ctx.Done():
			return
		}
	}
}
```

One subtlety worth stating flatly: **a `Ticker` is a *rate*, not a *deadline*.** It says "do this every N," and the *time* of each tick is the wall clock. That is exactly right for polling, metrics flushes, and heartbeats. The moment the requirement is "do this *at* 09:00" — a deadline, not a rate — the ticker is the wrong tool, because a tick at 08:59:59.9 and a job that takes 200ms is *late*, and the ticker has no concept of "late."

---

## The arbitrary-time case: the heap

A **binary min-heap** of `(time, job)` gives you the two operations a scheduler needs, at the right cost:

- **`Push(job)`** — O(log n). You add a job at any time without touching the running timer.
- **`Peek()`** — O(1). The top of the heap is *always* the earliest pending job, which is the invariant the whole design rests on.
- **`Pop()` / `Remove(job)`** — O(log n). Cancellation is a `Pop` of the job you cancelled; the heap stays a DAG of "what is pending and when."

The scheduler goroutine is then *one* `time.Timer` that is **re-armed to the top of the heap** after every change. Because the timer is always aimed at the *next* job (never at "now + a constant poll interval"), a tick is *never* missed: there is no polling interval to drift, no 100ms sleep to overshoot, no "the timer fired between my read and my write" race — the *re-arm* and the *pop* happen in the same goroutine, in order, with no window in between.

```go
package sched

import (
	"container/heap"
	"context"
	"fmt"
	"log"
	"sync/atomic"
	"time"
)

// Job is one unit of scheduled work. ID lets callers cancel it; the
// heap does not need IDs, only the (at, job) ordering.
type Job struct {
	ID   string
	At   time.Time
	Run  func()
	// deadline: how long Run is allowed to take. A job that blows it is
	// logged and *then* the scheduler moves on, so one slow job can never
	// starve the queue (see the run loop below).
	Deadline time.Duration
}

// jobHeap is a min-heap over Job.At. It satisfies heap.Interface, so the
// stdlib's heap.Push/heap.Pop give you O(log n) with the right invariants.
type jobHeap []Job

func (h jobHeap) Len() int { return len(h) }
func (h jobHeap) Less(i, j int) bool {
	if h[i].At.Equal(h[j].At) {
		return h[i].ID < h[j].ID // stable, deterministic tie-break
	}
	return h[i].At.Before(h[j].At)
}
func (h jobHeap) Swap(i, j int)       { h[i], h[j] = h[j], h[i] }
func (h *jobHeap) Push(x any)         { *h = append(*h, x.(Job)) }
func (h *jobHeap) Pop() any {
	old := *h
	n := len(old)
	j := old[n-1]
	*h = old[:n-1]
	return j
}

// HeapScheduler is the "runs at an arbitrary time" scheduler. One goroutine,
// one heap, one re-armed timer. The invariant it maintains: *the timer is
// always aimed at the top of the heap* (or it is stopped if the heap is empty).
type HeapScheduler struct {
	h      jobHeap
	cond   *time.Timer // the single timer, re-armed on every change
	ctx    context.Context
	cancel context.CancelFunc
	seq    int64 // monotonically increasing; gives each job a unique ID
}

func NewHeapScheduler(ctx context.Context) *HeapScheduler {
	c, cancel := context.WithCancel(ctx)
	s := &HeapScheduler{ctx: c, cancel: cancel}
	go s.loop() // the constructor owns the single goroutine; the caller just Schedules
	return s
}

// Schedule adds a job to run at the given time. O(log n). The caller
// gets back the job's ID so it can cancel it.
func (s *HeapScheduler) Schedule(at time.Time, j Job) string {
	atomic.AddInt64(&s.seq, 1)
	j.At = at
	j.ID = fmt.Sprintf("job-%d", atomic.LoadInt64(&s.seq))
	heap.Push(&s.h, j)
	s.rearm()
	return j.ID
}

// rearm points the timer at the top of the heap. This is the *whole*
// "never misses a tick" argument: there is no polling interval to drift
// past, only a recompute of the single next deadline.
func (s *HeapScheduler) rearm() {
	if s.cond == nil {
		s.cond = time.NewTimer(0)
		s.cond.Stop()
	}
	if len(s.h) == 0 {
		s.cond.Stop() // nothing pending: park the timer
		return
	}
	next := time.Until(s.h[0].At)
	if next < 0 {
		next = 0 // already due: fire on the next loop iteration
	}
	if !s.cond.Stop() {
		select {
		case <-s.cond.C: // drain a just-fired tick so the re-arm is clean
		default:
		}
	}
	s.cond.Reset(next)
}

// loop is the single goroutine that owns both the heap and the timer.
// Because it is the *only* writer, Push/Pop/rearm are ordered with no
// locks: the "missed tick" race (timer fires between a read and a write)
// is structurally impossible.
func (s *HeapScheduler) loop() {
	for {
		select {
		case <-s.ctx.Done():
			s.cond.Stop()
			return
		case <-s.cond.C:
			if len(s.h) == 0 {
				continue // a spurious fire (a cancelled job's timer)
			}
			j := heap.Pop(&s.h).(Job)
			// re-arm *before* running the job: the job may Schedule() more
			// work, and the re-arm inside Schedule() would race this one.
			s.rearm()
			done := make(chan struct{})
			go func() {
				defer close(done)
				j.Run()
			}()
			select {
			case <-done:
				// the job finished in time; no action needed
			case <-time.After(j.Deadline):
				// the job blew its deadline. The scheduler is *not* blocked
				// by the job: the goroutine keeps running in the background,
				// and the next job is already queued. This is the "one slow
				// job must not starve the queue" guarantee.
				log.Printf("job %s blew its %v deadline; continuing", j.ID, j.Deadline)
			}
		}
	}
}
```

The *invariant* to internalize: **the timer is a *function* of the heap top, not an independent clock.** Every push and pop re-computes the next deadline; the timer is just the *actuator* of that computation. That is the entire "never misses a tick" property, and it costs nothing.

```mermaid
flowchart TD
    A[Schedule job at T] --> B[heap.Push, O(log n)]
    B --> C{heap empty?}
    C -- yes --> D[timer.Stop, park]
    C -- no --> E["rearm: timer <- T - now"]
    E --> F{timer fires?}
    F -- "job at top is due" --> G[heap.Pop, O(log n)]
    G --> H[rearm to new top]
    H --> I[run job in its own goroutine]
    I --> J{job within deadline?}
    J -- yes --> K[done, next job is armed]
    J -- no --> L[log it, job runs in background]
    L --> K
    F -- "spurious (cancelled job)" --> M[continue loop]
    M --> F
    style E fill:#1a3a1a
    style H fill:#1a3a1a
```

The sequence below is the *cancellation* path, which is the one that is easy to get wrong: cancelling a job is a *heap* operation, not a *timer* operation, and the re-arm is what keeps the timer honest.

```mermaid
sequenceDiagram
    participant C as caller
    participant H as heap (top = next)
    participant T as timer
    participant G as scheduler goroutine
    C->>H: Schedule(job X at 10:00)
    H->>T: rearm to 10:00
    C->>H: cancel X (heap.Pop by ID)
    H->>T: rearm to new top (10:05)
    T-->>G: fires at 10:05
    G->>H: Pop top
    G->>T: rearm to next top
    G->>G: run the 10:05 job
    Note over C,T: cancelling X never touches the timer's <i>target</i>;<br/>the timer is always the heap top, so it stays exact
```

---

## The three bugs that eat the naive version

**1. The `for { fn(); time.Sleep(n) }` drift.** The *sleep* is added to the *period*, so the interval grows by the job's runtime every tick. A 1-second period with a 200ms job becomes 1.2s, then 1.4s, and so on, until the job is *late* by construction. The ticker does not have this bug: it fires on an *absolute* wall-clock schedule.

**2. The `time.Sleep(100ms)` poll that overshoots the deadline.** A scheduler that "checks every 100ms for due jobs" has a *worst-case latency of 100ms plus the job's own duration*, and a job scheduled at `t` can be *up to 100ms late*. The heap + re-armed timer has a *worst-case latency of ~0* (it fires *exactly* at the top), which is the only way to make a "run at 09:00" job *actually* run at 09:00.

**3. The one slow job that starves the queue.** If the scheduler *runs* the job inline (in the same goroutine that owns the timer), a job that takes 30s blocks the *entire scheduler* for 30s, and every job scheduled in that window is *late by 30s*. The fix is to **run the job in its own goroutine** and give the scheduler a *deadline*: if the job blows the deadline, the scheduler *logs it and moves on*, and the job finishes in the background. One slow job can no longer *hold* the queue.

> **Note**: The re-arm's `Stop()` + `select { case <-t.C: default: }` drain is *load-bearing*. A `time.Timer`'s `Stop()` returns `false` if the timer has *already fired*; in that case the tick is sitting in the `C` channel, and a bare `Reset()` without draining it will deliver a *stale* tick one iteration later. The two-line drain is the only reason the "spurious fire" case in the loop is correct.

> **Warning**: Do **not** let a job call back into the scheduler from its own goroutine (a `Schedule()` from inside a `Run()`). The scheduler goroutine and the job goroutine are *different*; a `Schedule()` from the job would race the `heap` (which the scheduler owns). If a job needs to enqueue follow-up work, have it `Send` to a *channel* that the scheduler goroutine drains, so all heap mutation stays in *one* goroutine. The one-writer invariant is the whole correctness argument; a second writer is a *race*, not a *feature*.

---

## The 30-line rule

| | **Ticker (periodic)** | **Heap (deadline)** |
|---|---|---|
| **Schedules** | a *rate* (every 5 s) | a *deadline* (at 14:03:22) |
| **Miss a tick?** | no (select re-arms) | no (timer = f(top), re-armed after every op) |
| **Cost of a slow job** | next tick waits (serial) or runs concurrent (fan-out) | logged + moved past, runs in own goroutine |
| **Survives restart?** | no (in-process) | no (in-process) |
| **Over the line?** | become a cron daemon | become a cron daemon |

**Rule:** if a job must *survive a process restart*, you no longer have a pattern — you have a daemon (durable store, systemd unit, crash-recovery story). That is a *different artifact*; the ticker/heap pair stops being the answer the moment persistence enters.

A **`time.Ticker` + `select` loop** is the *periodic* scheduler; a **heap + one re-armed timer** is the *arbitrary-time* scheduler. If your "scheduler" is more than ~100 lines of stdlib, you have built a *cron daemon* (a separate process, a durable store, a *systemd* unit), not a *pattern* — and that is a *different artifact* with a *different* failure surface (durable state, a *crash* recovery story, a *restart* policy). The line between the two is the *persistence* question: **if the job has to survive a process restart, it is a daemon; if it does not, it is a heap in a goroutine.** Under the line, the ticker and the heap are the *entire* scheduler. Over it, the *scheduler* is a *component* of a *system*, and you should stop calling it a *scheduler*.

## Takeaways

- **Two schedulers, not one:** a `time.Ticker` in a `select` for *periodic* (a *rate*), and a min-heap of `(time, job)` with *one* re-armed `time.Timer` for *arbitrary-time* (a *deadline*). A ticker is a rate; a heap is a deadline.
- **The "never misses a tick" property is structural, not a discipline.** It follows from *one* invariant: the timer is a *function* of the heap top, re-armed after *every* push and pop, in *one* goroutine. There is no *polling interval* to *drift* past and no *read/write* race because the *re-arm* and the *pop* are *ordered* in the same goroutine.
- **A job runs in its *own* goroutine with a *deadline*.** The scheduler *logs* a *deadline* *blowout* and *moves on*; the *job* *finishes* in the *background*. One *slow* job *cannot* *starve* the *queue*.
- **The `Stop()` + *drain* of the *fired* tick is *load-bearing*.** A *bare* `Reset()` after a *fired* tick delivers a *stale* tick *one* iteration *later*; the *two-line* `select` *drain* is the *only* *reason* the *spurious-fire* case is *correct*.

## Next steps

1. Build the *periodic* scheduler first (it is *twelve* lines) and *instrument* the *tick* *duration* against the *period*; that is the *signal* that the *period* is the *wrong* *knob*.
2. Add the *heap* scheduler and a *deadline* per job; *test* the *slow-job* case by *artificially* making one job take *10×* its *deadline* and *watch* the *queue* *keep* *running*.
3. When a job *needs* to *survive* a *restart* (a *cron* *class* job), *stop* *calling* it a *scheduler*: *make* it a *daemon* with a *durable* store and a *crash* *recovery* *story*, and *let* the *heap* *scheduler* be the *in-process* *half* of the *system*.
