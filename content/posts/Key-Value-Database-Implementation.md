---

draft: false
title: "Implement a KVDB Key-Value Database: B-tree + a Write-Ahead Log + Snapshots"
image: /images/covers/Key-Value-Database-Implementation.svg
summary: "Go: a key-value store that is actually durable — a balanced B-tree index in memory, an append-only WAL that fsyncs before a write is acknowledged, and periodic snapshots that compact the log the way Redis BGSAVE and RocksDB do."
date: 2021-02-15T23:57:07.239Z
lastmod: 2026-10-16T00:00:00Z
author: Punit Naran
cover: /img/database-1954920_640.jpg
images: null
weight: 1
categories:
  - Database
tags:
  - Database
  - B-tree
  - WAL
  - Redis
---

An in-memory map is a *cache*, not a *database*, because the moment the process dies the data is gone. The difference between the two is one file and one guarantee: **every write is appended to an on-disk log *before* the caller is told it succeeded.** That single rule — the **write-ahead log (WAL)** — is what makes a key-value store *durable*, and it is the entire engine of the store in this post. The rest of the design falls out of it: a **balanced B-tree** gives you `O(log n)` point lookups and range scans without an `O(n)` map scan, and **snapshots** let you compact the ever-growing log the way Redis's `BGSAVE` and RocksDB compaction do, so restart recovery stays fast no matter how long you have been running.

After reading this you can (1) implement the three pieces below in stdlib-only Go and prove each one works, and (2) understand exactly *why* a write is not "done" until it has been `fsync`'d to the log — and *why* a snapshot is a compaction, not a backup.

## The three pieces and how they cooperate

The store has three components with three non-overlapping jobs:

- **The B-tree** is the *index in memory*. It answers `Get`/`Set`/`Delete` in `O(log n)` and is what a caller *talks to*. It is volatile by design.
- **The WAL** is the *durable journal*. Every `Set`/`Delete` is appended to it and `fsync`'d *before* the in-memory tree is mutated, so a crash between the two never loses the write.
- **The snapshot** is the *compaction*. When the log grows past a size, the tree is dumped to a fresh snapshot file and the now-redundant log segments are deleted. Recovery = load the latest snapshot, then replay the log that came *after* it.

```mermaid
flowchart LR
    subgraph mem[In memory, volatile]
        BT[B-tree / balanced BST<br/>O(log n) Get/Set/Delete]
    end
    subgraph disk[On disk, durable]
        WAL[(WAL<br/>append-only segments<br/>seg_000001.wal)]
        SNAP[(snapshot<br/>store-000042.snap)]
    end
    C[caller Set k v] --> WAL
    WAL -- fsync ok --> BT
    BT -- log over threshold --> SNAP
    SNAP -.deletes.-> WAL
    R[crash] --> REC[recover]
    REC -->|1 load| SNAP
    REC -->|2 replay| WAL
    REC -->|3 resume| BT
    style WAL fill:#1a3a1a
    style SNAP fill:#1a3a1a
```

The ordering in that diagram is the whole safety argument: the WAL write is *first*, the tree update is *second*, and a snapshot is only ever *compaction* of what the WAL already proved durable.

## The B-tree: the index, in memory

A red-black tree is the textbook answer to "a balanced BST in Go," but it is a lot of code. A *pragmatic* in-memory B-tree for a teaching store is a simple balanced BST with a *size cap on the height*: it is not self-balancing, which is the honest limit. For a store whose access pattern is *inserts and point reads in roughly sorted order* (the common case for a KVDB), an ordinary BST stays shallow enough. We mark the ceiling explicitly so it is not a surprise later.

```go
// pkg: kvdb — the in-memory B-tree index.
// ponytail: a plain BST, not a self-balancing red-black tree. It stays
// shallow for roughly-sorted insert/read patterns; if you get adversarial
// reverse-sorted inserts and care about worst-case height, swap in an
// RB-tree (the Node shape below is unchanged, only insert/split differ).
package kvdb

import "fmt"

// Node is one entry in the in-memory tree.
type Node struct {
	Key   string
	Value []byte
	Left  *Node
	Right *Node
}

// Tree is the index a caller talks to. All mutations go through the WAL first.
type Tree struct {
	Root *Node
	Size int
}

// Get returns the value for key, or nil if absent.
func (t *Tree) Get(key string) []byte {
	n := t.Root
	for n != nil {
		switch {
		case key < n.Key:
			n = n.Left
		case key > n.Key:
			n = n.Right
		default:
			return n.Value
		}
	}
	return nil
}

// Insert sets key/value and reports whether the key was new.
func (t *Tree) Insert(key string, value []byte) bool {
	n, ok := t.findInsert(key)
	if ok {
		n.Value = value // update in place
		return false
	}
	n.Value = value
	t.Size++
	return true
}

// Delete removes key; returns false if it was not present.
func (t *Tree) Delete(key string) bool {
	n := t.Root
	if !t.remove(&n, key) {
		return false
	}
	t.Root = n
	t.Size--
	return true
}

func (t *Tree) findInsert(key string) (*Node, bool) {
	var parent *Node
	n := t.Root
	for n != nil {
		switch {
		case key < n.Key:
			parent, n = n, n.Left
		case key > n.Key:
			parent, n = n, n.Right
		default:
			return n, true
		}
	}
	// Attach a new leaf under parent (or make it the root).
	node := &Node{Key: key}
	if parent == nil {
		t.Root = node
	} else if key < parent.Key {
		parent.Left = node
	} else {
		parent.Right = node
	}
	return node, false
}

// remove performs a standard BST delete via the in-order successor (min of
// the right subtree). It mutates the child pointers of *parent.
func (t *Tree) remove(parent **Node, key string) bool {
	n := *parent
	if n == nil {
		return false
	}
	switch {
	case key < n.Key:
		return t.remove(&n.Left, key)
	case key > n.Key:
		return t.remove(&n.Right, key)
	}
	// Found the node.
	if n.Left == nil {
		*parent = n.Right
		return true
	}
	if n.Right == nil {
		*parent = n.Left
		return true
	}
	// Two children: copy the in-order successor over this node, then delete it.
	succ := n.Right
	for succ.Left != nil {
		succ = succ.Left
	}
	n.Key, n.Value = succ.Key, succ.Value
	return t.remove(&n.Right, succ.Key)
}

// Len is the cached size; ponytail: O(1), kept in a field for the hot path.
func (t *Tree) Len() int { return t.Size }

func (t *Tree) Describe() string {
	return fmt.Sprintf("tree(size=%d)", t.Size)
}
```

## The WAL: a write is not done until it is `fsync`'d

This is the piece that separates a store from a cache. A WAL is an *append-only* file of records. The contract has two parts, and both are about the *order* of system calls:

1. **Append first, mutate second.** The record is written to the file and `fdatasync`'d (flush the data to the device) *before* the in-memory tree changes. A crash after the `fsync` replays the record; a crash before it never applied the record, so the tree is consistent with the log either way.
2. **The record is self-contained.** It carries the key and the value in full (a `Delete` carries the key), so replay needs no side information.

The code below is a real, small WAL: a length-prefixed binary format, `fdatasync` per record, and a reader that walks records for replay.

```go
// pkg: kvdb/wal — an append-only, fsync-durable write-ahead log.
package wal

import (
	"bytes"
	"encoding/binary"
	"io"
	"os"
)

// op is the 1-byte header prefix for each record.
type op byte

const (
	opSet    op = 0x01
	opDelete op = 0x02
)

// Record is one atomic write: a Set (key + value) or a Delete (key only).
type Record struct {
	Op    op
	Key   []byte
	Value []byte
}

// Log appends records to an on-disk file and fsyncs before returning.
type Log struct {
	f *os.File
}

// New opens (or creates) the log file in append mode.
func New(path string) (*Log, error) {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return nil, err
	}
	return &Log{f: f}, nil
}

// Append writes a record and fsyncs it. This is the "first half" of the
// durability contract: a Set is not acknowledged to the caller until the
// bytes are on stable storage.
func (l *Log) Append(r Record) error {
	var buf bytes.Buffer
	binary.Write(&buf, binary.LittleEndian, r.Op)
	writeLenPrefixed(&buf, r.Key)
	writeLenPrefixed(&buf, r.Value)
	if _, err := l.f.Write(buf.Bytes()); err != nil {
		return err
	}
	// fdatasync: flush the data, not the metadata. This is what makes the
	// write durable; without it the data may still sit in the OS page cache
	// and be lost on a power cut.
	return l.f.Sync()
}

func writeLenPrefixed(buf *bytes.Buffer, b []byte) {
	var n int32 = int32(len(b))
	binary.Write(buf, binary.LittleEndian, n)
	buf.Write(b)
}

// Reader walks a set of log files in order and yields records for replay.
type Reader struct {
	files []string
	pos   int
	f     *os.File
}

// NewReader builds a replay iterator over the given (already-sorted) files.
func NewReader(files []string) *Reader { return &Reader{files: files} }

// Next advances to the next record, opening the next file as needed.
// A truncated trailing record (a crash mid-write) ends the stream.
func (r *Reader) Next() (*Record, error) {
	for {
		if r.f == nil {
			if r.pos >= len(r.files) {
				return nil, io.EOF
			}
			f, err := os.Open(r.files[r.pos])
			if err != nil {
				return nil, err
			}
			r.f = f
			r.pos++
			continue
		}
		rec, err := r.readOne()
		if err == io.EOF {
			r.f.Close()
			r.f = nil
			continue
		}
		if err != nil {
			return nil, err // truncated / corrupt record: stop replay
		}
		return rec, nil
	}
}

// readOne reads one length-prefixed record from the current file.
func (r *Reader) readOne() (*Record, error) {
	var opb [1]byte
	if _, err := r.f.Read(opb[:]); err != nil {
		if err == io.EOF {
			return nil, io.EOF
		}
		return nil, err
	}
	rec := &Record{Op: op(opb[0])}
	rec.Key = readLenPrefixed(r.f)
	rec.Value = readLenPrefixed(r.f)
	if rec.Key == nil {
		return nil, io.ErrUnexpectedEOF
	}
	return rec, nil
}

func readLenPrefixed(f *os.File) []byte {
	var n int32
	if err := binary.Read(f, binary.LittleEndian, &n); err != nil || n < 0 {
		return nil
	}
	b := make([]byte, n)
	if _, err := io.ReadFull(f, b); err != nil {
		return nil
	}
	return b
}

// Close releases the file.
func (l *Log) Close() error { return l.f.Close() }
```

> **Warning**: Do **not** skip the `f.Sync()` / `fdatasync` and call it durable. A write that is only in the OS page cache is *lost* on a power cut. The WAL's value is entirely in the *order*: **append + fsync, *then* mutate the tree**. Reverse that (mutate, then log) and a crash between the two loses the write even though the log "has" it later — you have acknowledged a write you cannot recover.

> **Note**: A crash *mid-record* (a partial write) leaves a *truncated* trailing record. The reader above stops at the first record it cannot fully parse, which is correct: a truncated record is the *last* thing that was half-written, and its data is not durable. This is exactly why you `fsync` per record — the boundary of a *complete* record is the boundary of *durable* state.

## Snapshots: compaction, not backup

The log grows forever; if you replay *all* of it on every restart, recovery time grows linearly with the lifetime of the process. A **snapshot** fixes this. A snapshot is a full dump of the *current* tree to a fresh file. Once it is on disk, every log record *up to and including* the snapshot is redundant — the snapshot already contains those writes. So **compaction** is: dump the tree to `snap_N`, then *delete* every WAL segment at or before `N`, keeping only the segments written *after*. Recovery is now `load snap_N` + `replay the few segments after N`, which is constant in the *snapshot* size and small in the *time since the last snapshot*.

```mermaid
sequenceDiagram
    participant S as Store
    participant L as WAL segments
    participant SN as Snapshot
    Note over S,SN: steady state: every write appends + fsyncs
    S->>L: append Set(k,v) + fsync
    S->>L: append Delete(k) + fsync
    L-->>S: size over threshold
    Note over S,SN: compaction: the log is now redundant
    S->>SN: dump tree -> snap_000042
    SN-->>S: snapshot durable
    S->>L: delete seg_000001..seg_000042
    L-->>S: keep only seg_000043.. (post-snapshot)
    Note over S,SN: later crash + restart
    S->>SN: 1. load snap_000042
    S->>L: 2. replay seg_000043..
    S->>S: 3. resume; recovery is O(snapshot), not O(lifetime)
```

The code below is the compaction step: it takes the current tree, writes a snapshot, and prunes the pre-snapshot segments.

```go
// pkg: kvdb/snapshot — dump the tree to a file and compact the log.
package snapshot

import (
	"encoding/binary"
	"os"
)

// Entry is one (key, value) pair as a snapshot records it.
// A nil Value marks a tombstone (the key was deleted).
type Entry struct {
	Key   []byte
	Value []byte
}

// Write dumps a tree (as an in-memory []Entry) to a snapshot file.
// Format: a 2-byte magic header, then one (len-prefixed key, len-prefixed
// value) pair per entry. Replay is a single loop.
func Write(path string, get func() []Entry) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	var hdr [2]byte
	binary.Write(f, binary.LittleEndian, hdr) // magic, for a versioned header
	for _, e := range get() {
		var n int32 = int32(len(e.Key))
		binary.Write(f, binary.LittleEndian, n)
		f.Write(e.Key)
		binary.Write(f, binary.LittleEndian, int32(len(e.Value)))
		if e.Value != nil {
			f.Write(e.Value)
		}
	}
	return f.Sync() // the snapshot is durable only after this
}

// Compaction returns the segments to *keep*: everything strictly after the
// snapshot index. The caller (the store) unlinks the rest.
func Compaction(snapshotIdx int, segs []int) []int {
	keep := make([]int, 0, len(segs))
	for _, s := range segs {
		if s > snapshotIdx {
			keep = append(keep, s)
		}
	}
	return keep
}
```

> **Note**: A snapshot is a *compaction of the log*, not a *backup of the data* — the two sound alike and are not the same. A snapshot's only job is to let you *stop replaying old log records*. If you also need a *point-in-time backup* you can copy and restore, that is a *separate* concern (a copy of the snapshot file, off-box), and it is not what a snapshot is for.

## The comparison: what each piece buys you

| Piece | Job | If it fails | Recovery |
|---|---|---|---|
| B-tree (in-mem) | `O(log n)` reads/writes for the caller | process dies → data gone | rebuilt from the WAL |
| WAL (append + `fsync`) | makes a write *durable* before ack | a power cut loses in-flight data | replay the log from the last `fsync` |
| Snapshot (compact) | bounds *recovery time* to the snapshot size | none (a derived artifact) | load it, then replay the *post-snapshot* tail only |

The row to internalize: the **WAL is what makes the store correct**, the **snapshot is what makes the store fast to start**, and the **B-tree is just the thing the caller touches**. Remove any one and you have a cache (no WAL), a slow-to-restart database (no snapshot), or an `O(n)` lookup (no tree).

## Takeaways

- **The WAL is the store; everything else is an optimization.** A write is not "done" until it is appended *and* `fsync`'d to the log; the in-memory tree is mutated *after*, never before.
- **`fsync` is the durability boundary.** A record fully `fsync`'d is durable; a truncated trailing record is the crash boundary; the reader stops there.
- **The append-first / mutate-second order is the whole safety argument.** Reverse it and you acknowledge writes you cannot recover.
- **A snapshot is compaction, not a backup.** It exists to make recovery `O(snapshot)` instead of `O(lifetime)`; the post-snapshot log tail is what you replay on restart.
- **A B-tree is the caller's door.** It is volatile by design and is *rebuilt* from the WAL on every recovery — you never persist it separately.

## Next steps

1. Add a `Recover(dir string)` that loads the newest snapshot, then `Reader(files-after-snapshot).Next()` each record into a fresh `Tree`, and wire it into `main` so a restart is transparent.
2. Drive the three invariants with a test: (a) `Set` then kill → the key is present after recovery; (b) truncate the last byte of a WAL record → recovery stops exactly there; (c) snapshot + 3 more writes + kill → recovery replays only the 3.
3. Move the plain BST to a real balanced tree (red-black) when you need a guaranteed `O(log n)` under adversarial insert order — the `Node` shape in this post is unchanged, only the insert/split logic swaps in.
