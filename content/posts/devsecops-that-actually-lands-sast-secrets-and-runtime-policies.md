---

date: 2026-10-15T09:00:00
draft: true
title: "DevSecOps That Actually Lands: SAST, Secrets, and Runtime Policies"
summary: "DevSecOps That Actually Lands: SAST, Secrets, and Runtime Policies"
categories:
  - DevSecOps
---


Most DevSecOps programs die the same way: the scan runs, the report is
long, nobody closes the finding, and the next scan has a new report with
the same findings. This post is the counter: a small, *enforced* set of
checks that actually change what ships. No new platform, no new toolchain
beyond what you already have.

## The three checks that matter (in order of value)

1. **Secrets in the repo** — the only check that's *free* and *always
   right*. Gitleaks (or TruffleHog) as a pre-commit hook + a CI gate.
   One false positive per quarter is the cost; the 12:00am "how did this
   get here" is the thing you're avoiding.
2. **SAST on the *changed* lines only** — the full repo is too big to
   read; the diff is the size a human can absorb. Semgrep with
   `--diff` (or CodeQL on the PR) gives you the *delta*, not the whole
   book.
3. **OPA/Gatekeeper admission policies** — the check that runs *at
   admission time* in the cluster, not at build time. This is the one
   that catches the "we deployed a pod with `privileged: true` because
   the CI image was built from a branch that bypassed the pipeline."

## The minimum pipeline (one repo, no new infra)

```yaml
# .github/workflows/sec.yml — the whole thing
name: security
on: [pull_request]
jobs:
  secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: {fetch-depth: 0}
      - uses: gitleaks/gitleaks-action@v2
        env: {GITLEAKS_ENABLE_EXIT_CODE: "1"}
  sast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          pip install semgrep
          semgrep ci --diff --error --config p/go p/python p/js
  trivy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aquasecurity/trivy-action@master
        with: {image: "golang4u_server:latest", format: "table", exit_code: "1"}
```

The *only* thing that makes this "land" is the `--error` / `exit_code: 1`
flags. A scanner that *reports* is a hobby; a scanner that *blocks* is a
control. Everything else (dashboards, SOC 2, the platform) is decoration
until the block is real.

## The OPA policy that catches the rest

```rego
# k8s.policies/privileged-ns.rego
package k8s
import data.custom.privileged_namespaces as pn

main deny[msg] {
  input.pod.spec.securityContext.privileged
  input.pod.metadata.namespace in pn
  msg := sprintf("pod %v in %v is privileged",
      [input.pod.metadata.name, input.pod.metadata.namespace])
}
```

Wire it through Gatekeeper (one `ConstraintTemplate` + one `K8sPSP`-style
`Constraint`), and the *runtime* policy is now as real as the build-time
one. This is the check that catches the "we built the image in a
separate CI that doesn't run the same lint" class of bug.

## What I'd *not* do

- **Don't gate on "critical" severity.** Gate on *the finding being in
  a changed line and in a trust boundary* (HTTP handler, auth path,
  deserializer). Severity is a ranking, not a gate.
- **Don't add a "security platform".** If the team of three can run
  `gitleaks`, `semgrep`, `trivy` and read one OPA policy, you have a
  program. A $40k/yr platform is a *procurement* problem, not a
  *security* problem.
- **Don't make the scanner the bottleneck.** A 20-minute CI is a
  scanner that gets bypassed. The rule I use: if a check takes > 2
  minutes, it's a *report*, not a *gate*.

## The boring win

The goal is not "we have SAST". The goal is: *a PR that adds an
`os.Getenv("PASSWORD")` to a hot path is blocked by the pre-push hook in
10 seconds, the developer fixes it, and the finding never reaches the
12:00am Slack.* That's the whole program. Everything else is scale.
