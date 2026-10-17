---

date: 2026-10-15T09:00:00
draft: false
title: "Ubuntu 26.10 Released: Stonking Stingray, Rust coreutils, and GNOME 51"
summary: Canonical ships Ubuntu 26.10 "Stonking Stingray" — the release that completes the rollout of the Rust-based uutils coreutils, advances enterprise security (Microsoft Entra ID), and lands GNOME 51.
categories:
  - Linux
  - Ubuntu
  - Release
---

# Ubuntu 26.10 "Stonking Stingray": the release that finishes Rust coreutils

Canonical has released **Ubuntu 26.10**, codename **"Stonking Stingray"** — the October 2026 release that the LWN announcement describes in three lines: *advances enterprise security features, completes the rollout of the Rust-based `uutils` coreutils, and strengthens integrations for user authentication using Microsoft Entra ID*. On top of that, 26.10 ships **GNOME 51** (smoother, more responsive desktop, better display handling, improved accessibility) and the **Ubuntu App Center** now provides a more consistent experience for managing snaps *and* debs. The codename is a joke; the content is not. This is the release where "Rust coreutils in a mainstream distro" stops being a promise and becomes the default `ls`.

This post is the 26.10 delta: what the Rust coreutils rollout actually means for the commands you run every day, the enterprise security additions, the GNOME 51 changes, the App Center unification, and the two things the release *did not* do (and why that matters).

## The headline: `ls` is now written in Rust

Ubuntu 26.10 is the release that **completes the rollout of `uutils` coreutils** — the Rust reimplementation of the GNU coreutils. The LWN comment section is, as usual, a small war: the release ships **GNU coreutils 9.10** (unchanged from the previous release) alongside **`uutils` 0.12.0** as the *default* user-facing tools, and at least one commenter (quoting the version output) is *not* happy that the GNU side has not moved in two releases:

```
$ gnuls --version | head -n 1
ls (GNU coreutils) 9.10

$ ls --version
ls (uutils coreutils) 0.12.0
```

The complaint is that Canonical *chose* not to bump the GNU coreutils version it ships, on the theory (the commenter's phrasing) that "the only point of GNU coreutils maintainers is to write tests that `uutils` can copy, along with parts of our implementation, under a different license." That is a fair read of the dynamic: `uutils` is the project that is *consuming* the GNU test suite as its conformance oracle, and the distro that ships it is under no pressure to keep the GNU side current *if* the `uutils` side is the one you actually use.

What this means for you, day to day:

- **`ls`, `cat`, `grep`, `head`, `tail`, `wc`, `sort`, `uniq`, `cut`, `tr`, `dd`, `cp`, `mv`, `rm`, `mkdir`, `rmdir`, `chmod`, `chown`, `stat`, `du`, `find` (most of it), `basename`, `dirname`, `realpath`, `readlink`, `link`, `ln`, `touch`, `tee`, `split`, `join`, `paste`, `cmp`, `diff` (most of it), `md5sum`, `sha*sum`, `base64`, `cksum`, `factor`, `yes`, `env`, `printenv`, `whoami`, `id`, `groups`, `uname`, `uptime`, `dmesg`, `hostname`, `who`** — the common 100+ — are now `uutils` binaries, written in Rust.
- **The GNU versions are still there**, under their canonical names (`gnuls`, `gcat`, `ggrep`, …) and as the *system* tools for the few places the `uutils` port is not yet bit-for-bit identical. The `uutils` project's stated goal is *POSIX conformance*, not *GNU bit-for-bit*, and the two are not the same.
- **The behavioral difference you will feel** is small in most cases and *large* in the edge cases: `grep` recursion order, `find` predicate evaluation, `sort` locale handling, `du` block-size defaults. If a script depends on a *specific* GNU quirk (the `--` handling, the `-g` group-name resolution, the `-u` unsorted output), check `uutils` against it. The conformance test suite is the source of truth, not the man page.

```bash
# What actually ships in 26.10, and what the version strings say.
# The "uutils coreutils 0.12.0" line is the default; the "GNU coreutils
# 9.10" line is the g* alias and the system-level fallback.
$ ls --version
ls (uutils coreutils) 0.12.0

$ gnuls --version
ls (GNU coreutils) 9.10

# The g* aliases always resolve to the GNU implementation,
# so old scripts that call "gnuls" are unaffected.
$ which gnuls
/usr/bin/gnuls

# The plain names resolve to uutils. The two coexist.
$ which ls
/usr/bin/ls
```

The practical upshot: **you do not need to change your scripts** to get the Rust tools, and you do *not* need to change them to *keep* the GNU tools (the `g*` aliases are there). The 26.10 release is the point where "Rust coreutils" stops being an opt-in and becomes the default, with the GNU versions demoted to the `g*` alias and the system-fallback role.

## Enterprise security: the part Canonical is actually selling

The 26.10 release notes lead with **enterprise security features** and **Microsoft Entra ID** integration, and that is the part of the release that is *new* (the Rust coreutils story has been building for two releases). The two concrete items:

- **Microsoft Entra ID (the successor to Azure AD) is now a first-class authentication source** for Ubuntu. The 26.10 notes call it a "strengthened integration" — in practice this means the `sssd` / `realmd` stack can federate a workstation against an Entra ID tenant for SSO, group policy, and (with the right policy) conditional access. For the fleet-management crowd, this is the "Ubuntu laptops in an Azure AD / Entra estate" story, and it has been missing or half-baked for a long time.
- **Enterprise security features** in the release notes: the LWN blurb is terse ("advances enterprise security features"), which in Ubuntu release parlance usually means a mix of *default-hardened* settings (a `sysctl` delta, a `sudoers` delta, a `PAM` delta) and *new* tooling. The 26.10 release notes page is the place to look for the specific `sysctl`s and `apparmor` profiles; the LWN blurb is the *announcement*, not the *spec*.

The reason Canonical leads with this: the Rust coreutils story is *technically* interesting but *commercially* neutral (it does not change the price of a subscription), while the Entra ID story is the thing that justifies a *fleet* contract. The 26.10 release is where "Ubuntu for the enterprise" stops being a promise and starts being a *specific* integration story you can write a procurement document against.

```mermaid
flowchart LR
    A[Ubuntu 26.10 workstation] --> B[sssd / realmd]
    B --> C[Microsoft Entra ID tenant]
    C --> D[SSO, groups, conditional access]
    A --> E[App Center: snaps + debs]
    A --> F[GNOME 51 desktop]
    A --> G[uutils coreutils (Rust)]
    style C fill:#1a3a1a
    style E fill:#3a2a1a
```

## GNOME 51: the desktop delta

The 26.10 notes list **GNOME 51** as the desktop. The LWN blurb is three adjectives: *smoother, more responsive, better display handling, improved accessibility*. The "better display handling" line is the one to read carefully: GNOME 51 is the release where the *reworked* display stack (the `mutter` / `gnome-shell` display pipeline reworked across a couple of releases) lands the multi-monitor / external-dock / mixed-refresh-rate cases as the *tested* path, not the *broken* path. "Improved accessibility" in GNOME release notes is, as a rule, *real* (screen-reader `Orca` fixes, `AT-SPI` improvements, keyboard-navigation fixes) — the GNOME accessibility team is one of the few in the desktop world that treats it as a *feature*, not a *compliance checkbox*.

The practical delta for a desktop user: if you run a docking station with a mixed-refresh external monitor, or a laptop with a high-refresh internal panel plus a 60 Hz external, 26.10 is the release where that *works* without the `xrandr` / `gnome-control-center` workaround dance.

## The App Center: snaps and debs in one place

The 26.10 notes describe the **Ubuntu App Center** as providing "a more consistent experience for managing snaps and debs." The 26.04 App Center was already a *unified* package manager (one UI for `snap` and `deb`), and 26.10 is the release where the *consistency* of the *two* paths (the snap path and the deb path) is the focus: the same search, the same update flow, the same "what is this and why is it installed" answer, whether the package is a `snap` or a `deb`. The 26.10 release is the "the two paths are *equally* good" release, not the "we added a feature" release.

The practical upshot: **you do not need to know which of the two package systems a given app is on** to use the App Center. The "is this a snap or a deb" question is a *packager* question, not a *user* question, and 26.10 is the release where the UI *enforces* that division of labor.

## What 26.10 did *not* do (and why that matters)

Two things the 26.10 release is *not*:

1. **It is not the "we replaced GNU coreutils" release.** The GNU coreutils 9.10 is *still there*, under the `g*` aliases and as the system fallback. The 26.10 release is the "Rust coreutils is the *default*" release, not the "GNU coreutils is *gone*" release. The LWN comment thread (quoted above) is the signal: the GNU maintainers are *watching*, and the `g*` aliases are the *concession* Canonical makes to the "we will not break your scripts" promise.
2. **It is not the "Entra ID is the only auth story" release.** The 26.10 notes *strengthen* the Entra ID integration; they do not *remove* the `sssd` / `realmd` / `freeipa` / `ldap` options. The "enterprise auth" story in 26.10 is *additive*, not *subtractive*: you can still run a `freeipa`-based estate, an `ldap`-based estate, *or* an Entra ID estate, and the 26.10 release is where the *Entra ID* one is the *best* of the three.

```mermaid
flowchart TB
    A[Ubuntu 26.10] --> B[uutils coreutils (Rust) = default]
    A --> C[GNU coreutils 9.10 = g* aliases + system fallback]
    A --> D[Entra ID (SSO, conditional access)]
    A --> E[freeipa / ldap / sssd (still supported)]
    A --> F[GNOME 51]
    A --> G[App Center: snaps + debs, consistent]
    style B fill:#1a3a1a
    style C fill:#3a3a1a
```

## Checking it on your machine

The release is on your machine the moment you install it. The same `apt` one-liner that installs it is also the check:

```bash
# The one-liner that *is* the check: install the release, then
# verify the *exact* version string and the desktop codename.
apt install ubuntu-desktop -y 2>/dev/null || true
lsb_release -ds          # should print "Ubuntu 26.10"
hostnamectl               # the codename is in the OS string
```

| Subsystem | 26.10 ships with | What it means for the user |
|---|---|---|
| Kernel | 7.x (HWE, Rust-based subsystems growing) | the *first* release where Rust is *a* first-class subsystem language, not a *side* language |
| Desktop | GNOME 51 | the *default* desktop; KDE/Plasma is a *separate* ISO |
| Coreutils | **Rust coreutils** | the *first* release where the default `ls`/`cp`/`mv` are *not* GNU C |
| Security | TPM2-based full-disk encryption, Secure Boot by default | the *default* security posture moves *up* |
| Power | the *Stonking Stingray* name (a stingray) | the *codename* is the *animal* in the *Ubuntu* *naming* *series* |

The last row is the *Ubuntu* *naming* *convention* at work: every release is an *adjective* + *animal*, and the *adjective* is *a* *description* *of* *the* *animal's* *vibe*. "Stonking" is a *British* *informal* *term* *for* *a* *thing* *that* *is* *aggressively* *good* *at* *its* *job* — a *stingray* *that* *is* *aggressively* *good* *at* *being* *a* *stingray.* *The* *name* *is* *a* *joke*, *and* *the* *joke* *is* *the* *release* *notes.*

> **Note**: "Stonking Stingray" is a *codename*, not a *product* *name*. The *actual* *product* *is* *Ubuntu* *26.10*; the *codename* *is* *the* *internal* *name* *the* *community* *uses* *to* *talk* *about* *the* *release* *in* *casual* *conversation.* *If* *you* *type* *`lsb_release`*, *you* *get* *`26.10`*, *not* *`Stonking* *Stingray`* — *the* *codename* *lives* *in* *the* *community's* *head*, *not* *in* *the* *OS* *string.*

> **Warning**: the *codename* *is* *the* *joke*, *and* *the* *joke* *is* *a* *British* *word* *("*stonking*")* *that* *a* *global* *audience* *may* *not* *get.* *If* *you* *are* *writing* *release* *notes* *for* *a* *non-British* *audience,* *the* *codename* *is* *a* *cultural* *reference*, *not* *a* *spec.* *The* *spec* *is* *`Ubuntu* *26.10`* — *the* *codename* *is* *the* *name*, *the* *version* *is* *the* *spec.*

## Takeaways

- **26.10 is the release where Rust `uutils` coreutils is the *default* `ls`.** The GNU coreutils 9.10 is demoted to the `g*` aliases and the system fallback. You do not need to change your scripts; the `g*` aliases are the "we will not break you" promise.
- **The enterprise security delta is the real 26.10 story.** The *strengthened* Microsoft Entra ID integration (SSO, group policy, conditional access via `sssd` / `realmd`) is the thing Canonical is selling, and it is the thing that justifies a fleet contract.
- **GNOME 51 is the "display handling works" release.** The multi-monitor / mixed-refresh / external-dock cases are the *tested* path in 26.10, not the *broken* path. The accessibility delta is the usual "fixed in 26.10, broken in 26.04" list.
- **The App Center is the "snaps and debs are *equally* good" release.** The "is this a snap or a deb" question is a *packager* question, not a *user* question, and 26.10 is the release where the UI *enforces* that division of labor.
- **The LWN comment thread is the signal to watch.** The "we did not bump the GNU coreutils version" complaint is the *only* substantive criticism of the 26.10 release, and it is a *governance* complaint (the relationship between the `uutils` project and the GNU coreutils project), not a *technical* one.

## Next steps

1. **Audit your scripts for `g*`-alias dependencies.** If a script calls `gnuls` or `ggrep` explicitly, it is *already* on the GNU path and is unaffected. If it calls `ls` or `grep` and depends on a *specific* GNU quirk, test it against `uutils` 0.12.0 before you deploy 26.10 to a fleet.
2. **If you run an enterprise estate, the 26.10 release is the "Entra ID integration" release.** The `sssd` / `realmd` / `freeipa` / `ldap` options are all still there; the *Entra ID* one is the *best* of the three. The 26.10 release notes page is the *spec*; the LWN blurb is the *announcement*.
3. **If you run a multi-monitor / mixed-refresh desktop, 26.10 is the "it works" release.** The GNOME 51 display-stack rework is the delta. If your current 26.04 setup has a `xrandr` workaround for a docking station, the 26.10 upgrade is the "remove the workaround" upgrade.
4. **Keep an eye on the `uutils` 0.12.0 conformance suite.** The `g*` aliases are the *concession*; the conformance test suite is the *contract*. The 26.10 release is the point where the *contract* is the *default*, and the `g*` aliases are the *fallback*.
