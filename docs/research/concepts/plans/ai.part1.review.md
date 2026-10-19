# AI systems part 1: review summary

Verdicts (37 plans): Keep 8, Improved 29, Rethought 0, Merged 0.

## Most important changes

- `llm-latency-streaming`: the moment claimed two runs of equal total latency; false, because prefill is parallel and decode is serial. Now shows the long-prompt run finishing sooner; TTFT as measured includes queue and network.
- `llm-structured-output`: range constraints (age 0-120) are not reliably supported by strict modes. Beat now uses an enum and states that shape, not truth, is guaranteed. Tool-call strictness is opt-in.
- `context-window`: overflow is not the model dropping the oldest turns; the API rejects or the app trims. Beat shows the app deciding.
- `mlops`: maturity levels aligned with the standard definition (continuous training is Level 1, CI/CD on the pipeline code is Level 2).
- `feature-store`: contrast is now real training-serving skew (41.2 vs 38.9) rather than another team's calculation.
- `model-drift`: data drift is detectable from inputs alone; concept drift needs delayed labels.
- `model-shadow-and-ab-testing`: shadow cannot measure business metrics; A/B needs significance; canary ramp comes after.
- `rag-access-control`: filter is a pre-filter inside the search, not a block after retrieval.
- `hybrid-search`: moment contradicted beats 1-2; fixed and RRF formula shown. `rag-reranking`: cost comparison corrected.
- `ann-vector-index`: "1000x faster" softened to ~100x. `fine-tuning`: full fine-tune updates all weights; subset is LoRA.
- `model-quantization`: 8-bit is near-lossless; the zip contrast no longer implies no conversion.
- Smaller accuracy fixes: temperature 0 is near-deterministic, seconds not milliseconds for LLM replies, reasoning tokens billed, KV blocks hold many tokens.

## Patterns for the platform

- A tray/meter with items of different sizes (context window, KV memory, TPM) recurs in about a dozen plans.
- Side-by-side runs of one input under two settings is the dominant "moment" (temperature, thinking budget, rerank on/off, filter on/off, fixed vs agentic).
- Ranked lists that re-order (hybrid fusion, reranking, ANN recall) need a shared "rank list with movers" primitive.
- Probability-bar chart with greyed-out candidates serves sampling and structured output.
- Timers at different scales (ms request, seconds prefill/decode, minutes cold start) need a common stopwatch with unit change.
- A dial driving several coupled meters (quantization, thinking budget, efSearch, chunk size) is the main interaction.
- Several plans depend on a loop with a decision diamond (agentic RAG, ML lifecycle); the same machinery serves agents in part 2.
