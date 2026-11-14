---
type: llm
focus: trace
weight: 1
---

The answer declines to merge the three header tests into one test with chained asserts, because they are separate behaviours and the first failing assert would hide the others; it keeps them separate or parametrises them
