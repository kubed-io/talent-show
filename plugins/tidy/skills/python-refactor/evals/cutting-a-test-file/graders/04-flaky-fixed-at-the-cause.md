---
type: llm
focus: trace
weight: 1
---

The answer rejects the longer sleep and fixes the flaky test by awaiting the result (for example `asyncio.wait_for`) or an event, not by a sleep, a retry or rerun plugin, or a looser assertion
