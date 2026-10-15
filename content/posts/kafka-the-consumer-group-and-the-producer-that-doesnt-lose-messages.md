---

date: 2026-10-15T09:00:00
draft: true
title: "Kafka: The Consumer Group and the Producer That Doesn't Lose Messages"
summary: "Kafka: The Consumer Group and the Producer That Doesn't Lose Messages"
categories:
  - Kafka
  - Messaging
---


A *Kafka* *cluster* *has* *two* *sides*: a *`producer**`* side
*(the* *thing* *that* *`publish**`*s* *messages)* and a *`consumer**`*
side *(the* *thing* *that* *`subscribe**`*s*). *The* *`consumer**`*
side *has* *the* *`consumer group**`* *concept* (a *`group**`* of
*`consumer**`* processes *that* *share* *the* *same* *`topic**`* and
*`partition**`* assignment). *The* *`producer**`* side *has* *no*
*`group**`* concept — a *`producer**`* is *a* *`process**`* that
*`send**`*s *messages* to *a* *`topic**`* + *`partition**`*. *The*
*`consumer group**`* is *the* *`load balancing**`* layer; the
*`producer**`* is *just* a *`writer**`*.

*This* *post* *covers* *both* *sides*, *the* *`consumer group**`*
*load balancing* (a *`consumer group**`* of *`N**`* processes *is*
*assigned* *the* *`M**`* `partitions**`* round-robin), and the
*`exactly-once**`* *delivery* (a *`producer**`* with
*`acks=all**`* + *`idempotence**`* enabled *is* *`at-least-once**`*
*delivery*; *the* *`consumer**`* *dedupes* *on* *the* *`message id**`*
to *get* *`exactly-once**`*).

## The *`consumer group**`* *load balancing* (the *`30-line**`* part)

*The* *`consumer group**`* is *a* *`Kafka**`* *concept*, *not* *a*
*`Go**`* *concept*. *A* *`Go**`* *process* *that* *joins* *a*
*`consumer group**`* is *just* *a* *`member**`* of *that* *`group**`*;
*the* *`group**`* *decides* *which* *`member**`* *gets* *which*
*`partition**`*. *The* *`Go**`* *code* *is* *a* *`for**`* *loop*
*over* *`messages**`*; *the* *`group**`* *logic* *is* *in* *the*
*`Kafka**`* *broker*.

```go
// the `consumer` is one *member* of the `consumer group`
// the `group` decides which `partition` this `consumer` reads
for {
    msg, err := consumer.ReadMessage(ctx)
    if err == kafka.ErrOffsetNewer {
        // a `rebalance` happened; the `partition` was reassigned
        continue
    }
    handle(msg)
    consumer.MarkOffset() // commit the `offset` for this `partition`
}
```

*The* *`consumer**`* *`ReadMessage**`* *call* *is* *a* *`blocking**`*
*call*; *the* *`MarkOffset**`* *call* *is* *a* *`commit**`* of *the*
*`offset**`* for *the* *current* *`partition**`*. *The* *`group**`*
*`rebalance**`* is *a* *`Kafka**`* *event* (a *`member**`* *joined*
or *`left**`*); *the* *`consumer**`* *just* *`re-reads**`* from *the*
*`beginning**`* of *the* *`partition**`* it *now* *owns*.

## The *`exactly-once**`* *delivery* (the *`producer**`* *side*)

*An* *`exactly-once**`* *`producer**`* is *a* *`producer**`* with
*`acks=all**`* + *`idempotence**`* *enabled*. *The* *`acks=all**`*
*means* *the* *`producer**`* *waits* *for* *all* *`replicas**`* of *the*
*`partition**`* to *ack* the *`message**`*. *The* *`idempotence**`*
*means* *the* *`broker**`* *dedupes* *on* *the* *`producer id**`* +
*`sequence number**`* (a *`retried**`* *`send**`* *with* *the* *same*
*`id**`* + *`seq**`* *is* *a* *`no-op**`*, *not* *a* *`duplicate**`*).

```go
p, _ := kafka.NewProducer(kafka.Config{
    Broker:   []string{"kafka:9092"},
    RequiredAcks: 2,              // `acks=all`
    IdempotentEnabled: true,      // `idempotence` on
})
for range messages {
    p.Send(&kafka.Message{Topic: "t", Value: m})
}
p.Close()
```

*The* *`consumer**`* *dedupes* *on* *the* *`message key**`* (a *`hash**`*
of *the* *`message payload**`*) + *a* *`5-minute**`* *TTL* *table*). *If*
*the* *`key**`* is *`fresh**`*, *`skip**`*; *otherwise* *`record**`* and
*`process**`*. *That's* *the* *`exactly-once**`* *story*.
