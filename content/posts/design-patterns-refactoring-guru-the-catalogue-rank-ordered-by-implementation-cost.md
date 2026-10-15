---
date: 2026-10-15T09:00:00
draft: true
title: "Design Patterns (Refactoring Guru): The Catalogue, Ranked by Implementation Cost"
summary: Design Patterns (Refactoring Guru): The Catalogue, Ranked by Implementation Cost
categories:
  - DesignPatterns
---


[refactoring.guru](https://refactoring.guru/design-patterns) is the
friendliest *Gang of Four* reference on the web: every pattern gets a
diagram, a "when to use", and a *C++/Java* example. The *Java*
examples are the trap: 12 of the 23 patterns are *class-hierarchy*
patterns (Factory, Builder, Adapter, Bridge, Composite, Proxy,
Decorator, Facade, Strategy, Command, Mediator, Memento, Observer,
State, Template Method, Visitor, Interpreter, Flyweight, Active
Object). That's 12 patterns that need *inheritance* to "work", and Go
has no inheritance. This post is the *Go-translation* of the catalogue,
ranked by **implementation cost in Go** — so you know which patterns
are *free idioms* and which are *a library you'd rather not write*.

## The 23, ranked by Go implementation cost

**Cost = 0 (a Go idiom, 10 lines or less):**
- **Singleton** — `var x = &T{}` + `sync.Once` if you need lazy init.
- **Factory** — `func NewT(deps... ) *T`. *This is the Go constructor.*
- **Builder** — functional options `func WithX(x) Opt`. *This is how
  every Go client library is built.*
- **Strategy** — `type Strategy = func(ctx, T) R`. *A function type IS
  the strategy.*
- **Command** — `type Command = func(ctx) (R, error)`.
- **Adapter** — a 10-line wrapper function. *One function, one adapter.*
- **Proxy** — `type T struct { inner *RealT }` + method delegation.
- **Mediator** — a `chan Event` + a `for e := range c` loop. *This is
  just a Go event loop.*
- **Observer** — same as Mediator; *the Go idiom for both is a channel.*
- **State** — a struct with a `switch` on the current state.
- **Composite** — a `type Node interface { Children() []Node }`.
- **Chain of Responsibility** — `for _, h := range handlers { if h(h) { break } }`.
  *This is the Go middleware pattern, and it's the only pattern you'll
  write every day.*

**Cost = 1 (a small library, ~50 lines):**
- **Visitor** — a `type Visitor interface { Visit(*T) }` + a `type
  T struct { v Visitor }` + one method per `T`. *Go has no `accept`
  method; the visitor *calls* the node's `Accept`, not the other way
  around.*
- **Flyweight** — a `sync.Map[string]Payload` + a key struct. *Go's
  `map` is the flyweight; the key is the "shared" part, the value is
  the "unique" part.*
- **Memento** — `copy(orig)` (Go has no reference type, so "deep copy"
  is just `copy`).
- **Bridge** — two `type` + one `interface` + two `struct` impls.
  *Go's `interface` *is* the bridge; the two hierarchies are just
  two `struct` types.*

**Cost = 2 (a real library, ~200 lines):**
- **Template Method** — *Go has no inheritance, so the "template" is
  a function that takes a `func` (the "hook") and a `*Receiver` (the
  "context"). It works, but it's 30 lines of boilerplate per use.*
- **Interpreter** — a real parser (`go/parse` + a `type Node interface
  { Eval() }` + an AST). *This is a compiler, not a pattern.*

## The 30-line rule for the catalogue

If a *Gang of Four* pattern needs **more than 30 lines of Go** to
express, you've written a *library*, not a *pattern*. The *catalogue*
is the *map*; the *30-line rule* is the *compass*. Use the map to
*find* the pattern; use the compass to *decide* if it's worth writing.
