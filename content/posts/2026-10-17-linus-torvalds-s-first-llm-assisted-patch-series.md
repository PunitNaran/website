---

date: 2026-10-17T09:00:00
draft: true
title: "Linus Torvalds's first LLM-assisted patch series"
image: /images/covers/2026-10-17-linus-torvalds-s-first-llm-assisted-patch-series.svg
summary: "At the recently concluded Maintainers Summit , Linus Torvalds said that he had been using a large language model to work on a patch series addressing a longstanding problem; he has now posted that ser"
categories:
  - posts


At the recently concluded Maintainers Summit , Linus Torvalds said that he had been using a large language model to work on a patch series addressing a longstanding problem; he has now posted that series for review . The fairly short series of ten patches basically enhances folio lookup by noticing when folios are hot, and setting a "delay releasing this folio until after a RCU period", and then using that RCU delay it does not just the folio lookup itself under RCU (which we've done forever), b

[Full article](https://lwn.net/Articles/1100449/)
