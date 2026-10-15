---

date: 2026-10-15T09:00:00
draft: true
title: "Kubernetes Operators: The CRD and the Reconciler That Never Gives Up"
summary: "Kubernetes Operators: The CRD and the Reconciler That Never Gives Up"
categories:
  - Kubernetes
  - DevOps
---


A *`Kubernetes**`* *`operator**`* is *a* *`CRD**`* (a *`Custom Resource
Definition**`*: *a* *`schema**`* for *a* *`resource**`* that *isn't*
*in* *the* *`built-in**`* *`CRD**`* *list*) + *a* *`controller**`* (a
*`Go**`* *`process**`* that *`watches**`* the *`CRD**`* and *`reconciles**`*
*it* *to* *the* *`desired**`* *`state**`*). *The* *`reconciler**`* is
*the* *`heart**`* of *the* *`operator**`*; *it's* *a* *`loop**`* that
*`runs**`* *forever*, *`checks**`* the *`current**`* *`state**`* of
*the* *`resource**`*, *and* *`moves**`* it *towards* *the* *`desired**`*
*`state**`*.

*The* *`30-line**`* *`reconciler**`* is *a* *`for**`* *`loop**`* + *a*
*`status**`* *`check**`* + *a* *`patch**`*. *The* *`CRD**`* is *a*
*`YAML**`* *`schema**`*. *The* *`controller**`* is *a* *`Go**`*
*`struct**`* with *a* *`Reconcile**`* *`method**`*. *That's* *the*
*`whole**`* *`operator**`*.

## The *`30-line**`* *`reconciler**`* (the *`entire**`* *`operator**`)

```go
type Reconciler struct {
    client client.Client
}

func (r *Reconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    var obj v1.MyApp
    if err := r.client.Get(ctx, req.NamespacedName, &obj); err != nil {
        return ctrl.Result{}, client.IgnoreNotFound(err)
    }
    // `desired**`* state: `obj.Spec`
    // `current**`* state: `obj.Status`
    if obj.Status.Phase != obj.Spec.Phase {
        // `move**`* towards `desired**`*
        obj.Status.Phase = obj.Spec.Phase
        if err := r.client.Status().Update(ctx, &obj); err != nil {
            return ctrl.Result{RequeueAfter: 5 * time.Second}, err
        }
    }
    return ctrl.Result{}, nil
}
```

*The* *`reconcile**`* *`loop**`* *`runs**`* *forever*; *the* *`Reconcile**`*
*`method**`* is *a* *`30-line**`* *`function**`*. *The* *`controller**`*
*`watches**`* the *`CRD**`* (a *`watch**`* *`event**`*) and *`calls**`*
*`Reconcile**`* *on* *every* *`change**`*. *The* *`reconciler**`* is
*`idempotent**`*: *a* *`second**`* *`Reconcile**`* *`call**`* with *the*
*same* *`state**`* *`does**`* *nothing* (the *`status**`* *`is**`*
*`already**`* *`updated**`*).

## The *`3**`* *`gotchas**`* that *`break**`* the *`operator**`

1. **The *`Reconcile**`* *`loop**`* *`must**`* *`not**`* *`block**`*
   *`indefinitely**`*. *A* *`Reconcile**`* that *`blocks**`* on *a*
   *`network**`* *`call**`* *`holds**`* the *`reconcile**`* *`slot**`*
   *and* *`starves**`* the *`other**`* *`reconciles**`*. *The* *`rule**`*:
   *`Reconcile**`* *`must**`* *`return**`* *within* *`30s**`*; *if*
   *it* *`can't**`*, *`requeue**`* with *a* *`RequeueAfter**`*.
2. **The *`status**`* *`subresource**`* *`must**`* *`be**`* *`separate**`*
   *`from**`* the *`spec**`*. *The* *`spec**`* is *the* *`desired**`*
   *`state**`* (the *`user**`* *`sets**`* it); *the* *`status**`* is
   *the* *`current**`* *`state**`* (the *`controller**`* *`sets**`* it).
   *If* *they're* *in* *the* *same* *`object**`*, *the* *`controller**`*
   *`overwrites**`* the *`user**`*'s* *`spec**`* *on* *every* *`update**`*.
3. **The *`finalizer**`* *`pattern**`*. *A* *`CRD**`* *`that**`*
   *`deletes**`* *`resources**`* *`outside**`* the *`cluster**`* (a
   *`S3**`* *`bucket**`*, *a* *`Kafka**`* *`topic**`*) *`must**`* *use*
   *a* *`finalizer**`*: *a* *`string**`* in *the* *`metadata.finalizers**`*
   *`list**`* that *`blocks**`* the *`delete**`* until *the* *`operator**`*
   *`cleans**`* up *the* *`external**`* *`resource**`*. *The* *`finalizer**`*
   *`is**`* the *`only**`* *`way**`* to *`guarantee**`* the *`cleanup**`*
   *`happens**`* *before* *the* *`CRD**`* *`is**`* *`gone.**`

## The *`30-line**`* *`rule**`* for *a* *`Kubernetes**`* *`operator**`

*The* *`30-line**`* *`reconciler**`* + *a* *`10-line**`* *`CRD**`*
*`YAML**`* = *the* *`entire**`* *`operator.**`* *If* *it's* *`more**`*
*than* *that*, *you've* *`built**`* *a* *`platform**`*, *not* *a*
*`pattern.**`*
