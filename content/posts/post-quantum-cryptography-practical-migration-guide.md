---

date: 2026-10-15T09:00:00
draft: true
title: "Post-Quantum Cryptography: A Practical Migration Guide for Engineers"
summary: "Post-Quantum Cryptography: A Practical Migration Guide for Engineers"
categories:
  - Artificial Intelligence
---


Quantum computers have not yet broken RSA in production, but the threat is
*harvest now, decrypt later*: traffic encrypted today with RSA-2048 or
ECDH-P256 can be stored and decrypted once a sufficiently large fault-tolerant
machine exists. The NIST PQC standards (finalized 2024, FIPS 203/204/205)
give you the exit plan. This is the engineer's migration guide.

## The three standards you will actually use

| FIPS | Algorithm | Type | Sizes (bytes) |
|------|-----------|------|----------------|
| 203 | ML-KEM (Kyber) | KEM — key encapsulation | 773 / 1088 / 1568 public key |
| 204 | ML-DSA (Dilithium) | signature | 1325 / 2170 / 3203 public key |
| 205 | SLH-DSA (SPHINCS+) | signature (hash-based, stateless) | huge, slow — last resort |

For TLS you will mostly meet **ML-KEM-512/768/1024** in hybrid key shares
(X25519 + Kyber), which is what Cloudflare, Akamai and Let's Encrypt already
roll out.

## Hybrid first: never pure-PQC on day one

The standard move is a *hybrid* key exchange: classical curve **AND** Kyber
in the same group, with the shared secret being an HKDF over both. You get
quantum resistance if Kyber is sound, and classical security if Kyber isn't.
OpenSSL 3.2+ does this natively:

```bash
# openssl 3.2: a Kyber-768 key share inside an X25519 hybrid group
openssl genpkey -algorithm ML-KEM-768 -out kyber768.pem
openssl pkeyutl -inkey kyber768.pem -encap -out wrapped.bin
```

Go 1.24+ exposes the NIST PQC primitives in the standard library
(`crypto/kem` via `crypto/ecdh` hybrid types are still in flight; the stable
interface today is via `crypto/mldsa` + `crypto/mlkem` packages added in the
Go 1.24 release). The pattern for a TLS-level hybrid:

```go
// hybrid key exchange: X25519 + ML-KEM-768, HKDF over both shared secrets
func HybridX25519MLKEM768(privX [32]byte, kyberPub []byte) ([]byte, error) {
    x, err := ecdh.X25519().NewPrivateKey(rand.Reader)
    if err != nil {
        return nil, err
    }
    kyb, err := mlek.ML768()
    if err != nil {
        return nil, err
    }
    ssX, err := x.ECDH(xPub) // caller supplies xPub
    if err != nil {
        return nil, err
    }
    ssK, ssK2, err := kyb.Encapsulate(rand.Reader, kyberPub)
    if err != nil {
        return nil, err
    }
    // HKDF-SHA256 over both secrets => one combined IKM
    return hkdf.Hash(ssX, ssK, nil, nil, 32)
}
```

## What to migrate, and in what order

1. **TLS (external facing)** — hybrid X25519+ML-KEM-768. Lowest risk,
   highest value; the client and server can be upgraded independently.
2. **Signatures on data at rest** — ML-DSA-65 for document/record
   signatures. SLH-DSA only where you need 100-year security margins.
3. **Symmetric keys are fine** — AES-256 and ChaCha20 are not threatened by
   Shor; they only need to survive Grover's square-root, which 256-bit keys
   do. **Do not rotate your symmetric keys as part of "PQC migration".**
4. **Certificates** — the CA infrastructure is the long pole; let your CA
   (Let's Encrypt, Cloudflare) handle the hybrid certs. Your job is just
   (a) use a TLS library new enough, (b) don't pin to `TLS_RSA_*` cipher
   suites.

## Pitfalls

- **Key sizes**: ML-DSA public keys are ~1.3–3.2 KB. If you store signed
  blobs in a fixed-length column, that column needs widening.
- **Signatures are slower**: ML-DSA-65 sign is ~1.3 ms on a modern CPU vs
  ~50 µs for ECDSA-P256. Fine for documents, not fine for per-packet.
- **Don't mix with old hashes**: ML-DSA uses SHAKE-256 internally; a
  SHA-256-based wrapper is not equivalent.
- **Testing**: `go test` with `crypto/mlkem`/`crypto/mldsa` gives you the
  NIST test vectors for free; use them, don't hand-derive expected values.

## The one-line summary

Adopt hybrid classical+PQC for TLS now (OpenSSL 3.2+ / Go 1.24+), switch
long-lived document signatures to ML-DSA-65, and leave your symmetric crypto
alone. That is 95% of the migration.
