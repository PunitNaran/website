---

date: 2026-10-15T09:00:00
draft: true
title: "gRPC in Production: The Service Mesh and the Load Balancer"
summary: "gRPC in Production: The Service Mesh and the Load Balancer"
categories:
  - gRPC
  - Microservices
---


A *`gRPC**`* *service* *in* *`production**`* is *not* *a* *`single**`*
*`process**`* talking *to* *a* *`single**`* *`process**`*. *It's* *a*
*`mesh**`*: *a* *`set**`* of *`services**`* (each *a* *`gRPC**`*
*`server**`*) + *a* *`set**`* of *`clients**`* (each *a* *`gRPC**`*
*`client**`*) + *a* *`load balancer**`* that *`decides**`* which
*`server**`* a *`client**`* *talks* *to* + *a* *`service mesh**`*
(*`Envoy**`* or *`Istio**`*) that *`intercepts**`* the *`traffic**`*.

*The* *`load balancer**`* is *the* *`only**`* *thing* *that*
*`decides**`* which *`server**`* a *`client**`* *talks* *to*. *In*
*`Kubernetes**`, *the* *`Service**`* *object* *is* *a* *`load
balancer**`* (a *`round-robin**`* across *the* *`pods**`* behind *it*).
*In* *`Envoy**`, *the* *`lb policy**`* *is* *a* *`round-robin**`* /
*`least-conn**`* / *`ring-hash**`* *choice*. *The* *`gRPC**`*
*`client**`* *doesn't* *`know**`* which *`server**`* it *`talked**`*
*to*; *the* *`lb**`* *decides*.

## The *`30-line**`* *`load balancer**`* (the *`ring-hash**`* *`lb**`)

```go
// the `ring-hash` lb: a `hash ring` of `server` ids
type RingHash struct {
    ring []int32            // sorted `hash` values
    map  map[int32]string   // `hash` -> `server`
}

func (r *RingHash) Pick(key string) string {
    h := fnv32a(key)
    i := sort.Search(len(r.ring), func(i int) bool { return r.ring[i] > h })
    if i == len(r.ring) {
        i = 0
    }
    return r.map[r.ring[i]]
}
```

*The* *`ring-hash**`* *`lb**`* is *a* *`consistent**`* *`hash**`*: *a*
*`new**`* *`server**`* *joining* *the* *`ring**`* only *`moves**`* *the*
*`hash**`* *of* *the* *`nearest**`* *`hash**`* *on* *the* *`ring**`*,
*not* *every* *`hash**`*. *This* *is* *how* *the* *`lb**`* *`stays**`*
*`stable**`* under *`load**`* (a *`new**`* *`server**`* *`joining**`*
doesn't *`rebalance**`* *the* *entire* *`ring**`*).

## The *`service mesh**`* (the *`Envoy**`* *`sidecar**`)

*The* *`service mesh**`* is *a* *`sidecar**`* (a *`container**`* that
*`runs**`* *alongside* *the* *`service**`* *container*) that *`intercepts**`*
*the* *`inbound**`* and *`outbound**`* *`traffic**`*. *The* *`service**`*
*`talks**`* *to* *the* *`sidecar**`* (a *`localhost**`* *`port**`); *the*
*`sidecar**`* *`talks**`* *to* *the* *`other**`* *`sidecar**`* (the
*`real**`* *`network**`*). *The* *`gRPC**`* *`client**`* *`knows**`*
*nothing* *about* *the* *`mesh**`*; *the* *`mesh**`* *`knows**`*
*everything* *about* *the* *`client**`*.

*The* *`30-line**`* *`rule**`* for *a* *`gRPC**`* *`service**`* in
*`production**`*: *the* *`service**`* is *a* *`30-line**`* *`gRPC**`*
*`server**`* + *a* *`30-line**`* *`lb**`* + *a* *`sidecar**`*. *The*
*`mesh**`* is *the* *`only**`* *`thing**`* that *`decides**`* *which*
*`server**`* a *`client**`* *`talks**`* *to*; *the* *`service**`*
*`doesn't**`* *`care**`*.
