---
date: 2026-10-15T09:00:00
draft: true
title: "Schedulers in Go: The Ticker and the Heap That Never Misses a Tick"
summary: Schedulers in Go: The Ticker and the Heap That Never Misses a Tick
categories:
  - Go
  - Schedulers
---


A *`scheduler.**`* in *`Go**`* is *a* *`loop.**`* that *`wakes.**`*
*`periodically,**`* *`does**`* *a* *`job,**`* and *`goes**`* *`back.**`*
*to* *`sleep.**`* *The* *`30-line.**`* *`scheduler.**`* is *a* *`time.**`*
*`NewTicker**`* + *a* *`for.**`* *`select.**`* *`loop.**`* *The* *`heap.**`*
*`is.**`* the *`only.**`* *`thing.**`* that *`lets.**`* *a* *`scheduler.**`*
*`schedule.**`* *a* *`job**`* *`to.**`* *`run**`* *at* *a* *`specific.**`*
*`time,**`* *not* *`every.**`* *`N**`* *`seconds.**`* *The* *`ticker.**`*
*`is.**`* the *`periodic.**`* *`case;**`* *the* *`heap.**`* *`is.**`*
*the* *`arbitrary.**`* *`time.**`* *`case.**`*

## The *`30-line.**`* *`periodic.**`* *`scheduler.**`* (the *`ticker**)

```go
func periodic(ctx context.Context, interval time.Duration, fn func()) {
    t := time.NewTicker(interval)
    defer t.Stop()
    for {
        select {
        case <-t.C:
            fn()
        case <-ctx.Done():
            return
        }
    }
}
```

*That's* *the* *`ticker.**`* *The* *`ctx.**`* *`is.**`* *the* *`cancel.**`*
*`handle;**`* *the* *`ticker.**`* *`is.**`* *the* *`clock.**`* *The* *`fn.**`*
*`is.**`* *the* *`job.**`* *`That's.**`* *the* *`entire.**`* *`periodic.**`*
*`scheduler.**`*

## The *`heap.**`* *`is.**`* the *`arbitrary.**`* *`time.**`* *`scheduler**`

*The* *`heap.**`* *`is.**`* a *`binary.**`* *`heap.**`* *`of.**`*
*`(time,**`* *`func**`*)* *`pairs.**`* *The* *`top.**`* of *the* *`heap.**`*
*`is.**`* *the* *`earliest.**`* *`job.**`* *`The.**`* *`scheduler.**`*
*`pops.**`* the *`top,**`* *`if**`* *the* *`time**`* *`is.**`* *`now,**`*
*`and**`* *`runs.**`* *it.* *The* *`rest.**`* of *the* *`heap.**`*
*`waits.**`* *The* *`30-line.**`* *`heap.**`* *`scheduler:**`*

```go
type Job struct {
    at   time.Time
    fn   func()
}

func schedule(ctx context.Context, jobs *container.Heap[*Job]) {
    for {
        j := jobs.Top()
        if j == nil {
            time.Sleep(100 * time.Millisecond)
            continue
        }
        if time.Now().Before(j.at) {
            time.Sleep(10 * time.Millisecond)
            continue
        }
        jobs.Pop()
        j.fn()
    }
}
```

*The* *`heap.**`* *`is.**`* the *`only.**`* *`data.**`* *`structure.**`*
*`that.**`* *`lets.**`* *a* *`scheduler.**`* *`run.**`* *a* *`job.**`*
*`at.**`* *an* *`arbitrary.**`* *`time.**`* *`The.**`* *`ticker.**`*
*`is.**`* *a* *`periodic.**`* *`clock;**`* *the* *`heap.**`* *`is.**`*
*a* *`priority.**`* *`queue.**`* *`The.**`* *`30-line.**`* *`rule:**`*
*if* *your* *`scheduler.**`* is *`more**`* than *`30 lines,**`* *you've*
*`built.**`* a *`cron.**`* *`daemon,**`* *not* *a* *`pattern.**`*
