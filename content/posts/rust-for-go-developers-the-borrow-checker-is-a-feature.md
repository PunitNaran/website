---

date: 2026-10-15T09:00:00
draft: true
title: "Rust for Go Developers: The Borrow Checker Is a Feature"
summary: "Rust for Go Developers: The Borrow Checker Is a Feature"
categories:
  - Rust
---


If you came from Go, the first thing you'll notice about Rust is that the
compiler *argues* with you. That's the borrow checker, and it is the single
most productive "nag" in any language I've used. This post is the mental
model that makes Rust feel like a natural extension of Go rather than a
rewrite.

## The one idea: ownership, not garbage

Go's model: the GC decides when a value dies. Rust's model: the compiler
decides, at compile time, *who* owns a value and *who* may borrow it. The
rules are:

- Every value has **exactly one owner**.
- When the owner's scope ends, the value is dropped (deterministic — no GC
  pause, no finalizer).
- A value can be *borrowed* immutably by any number of readers **or**
  mutably by exactly one writer, **but not both at the same time**.

That last rule is the entire borrow checker. It's not a linter; it's a
*proof* that your reference graph is a DAG at every program point.

## The Go developer's translation table

| Go idiom | Rust idiom | Why it's a win |
|----------|------------|----------------|
| `*T` (heap) | `Box<T>` | Same, but the compiler knows who frees it |
| `[]T` (slice) | `&[T]` (borrow) / `Vec<T>` (own) | The split kills whole classes of aliasing bugs |
| `map[K]V` | `HashMap<K, V>` (with `SipHash` by default) | Same ergonomics, better default hash |
| `chan T` | `mpsc::channel()` | Same model, no GC of the channel buffer |
| `interface{}` | `dyn Trait` / generics | Generics get you monomorphization (inlined) for free |
| `defer f()` | `Drop` impl + scope end | Deterministic, no "forgot to defer" class of bugs |
| `context.Context` | `Context` (std) | Same shape, same idioms — the mental port is 1:1 |

## The FFI story (why you'd reach for Rust at all)

Go's cgo is *a* FFI, not *the* FFI. It allocates a goroutine per C call,
copies the stack, and you can't see the other side's memory model. Rust's
C ABI is **stable and cheap**: you write a C header, `#[no_mangle]` the
export, and the caller sees it as plain C. This is the pattern I use to
port a hot Go loop into Rust without changing the Go service:

```rust
// lib.rs — the "C" side the Go service links against
#[no_mangle]
pub extern "C" fn run_bench(data: *const u8, len: usize) -> u64 {
    let slice = unsafe { std::slice::from_raw_parts(data, len) };
    let mut h: u64 = 0;
    for chunk in slice.chunks(64) {
        h = h.wrapping_mul(0x9E3779B97F4A7C15) ^ u64::from_le_bytes(
            chunk.iter().map(|b| u64::from(*b)).fold(0u64, |a, b| a + b)
        );
    }
    h
}
```

```go
// main.go — the Go side; cgo is the *only* bridge
package main

/*
#include "lib.h"
*/
import "C"
import "unsafe"

func main() {
    data := make([]byte, 1<<20)
    h := C.run_bench((*C.uchar)(unsafe.Pointer(&data[0])), C.size_t(len(data)))
    println(h)
}
```

The Go side stays 95% identical; the hot loop is now monomorphic, inlined,
and 10–30× faster. That's the *real* reason to learn Rust as a Go
developer: not the language, the **leverage** it gives you over the hot path.

## The gotchas I hit (and you will too)

1. **`'static` on a borrowed pointer**: the moment a Rust function takes
   `&[u8]` and you want to store the result past the call, you hit the
   lifetime checker. The fix is almost always "allocate a `Vec<u8>`,
   return it, and let the caller own it."
2. **`Send + Sync` on a `Mutex` across threads**: the `Mutex` itself is
   `Sync` but the *guard* is not `Send`. You can't hold the guard across a
   `.await`. The fix: clone the data you need, drop the guard, then await.
3. **`dyn` dispatch cost**: `Box<dyn Trait>` is a vtable call. If your hot
   path is a `dyn` dispatch, you've paid the function-pointer tax. The
   fix is a `Vec<Concrete>` of the 3–4 things you actually do, and a
   `match` on a tag — the compiler monomorphizes the match, and you're
   back to inlined.
4. **`#[no_mangle]` + `extern "C"`**: if you skip `#[no_mangle]` the
   symbol gets mangled and the Go side can't see it. If you skip
   `extern "C"`, the calling convention is Rust's, not C's, and you'll
   segfault on the first cross-ABI call.

## The 30-line rule

If your Rust interop is more than 30 lines of FFI, you've built a
*subsystem*, not a fast path. At that point, ask: do I want a Rust
*library* (shared `.so`, C ABI, fast) or a Rust *service* (gRPC/REST,
slower, cleaner boundary)? The 30-line number is the line between the
two. Under it, library. Over it, service.
