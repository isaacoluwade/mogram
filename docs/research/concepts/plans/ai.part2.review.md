# AI part 2 review summary

Verdicts (33 plans): Keep 8, Improved 25, Rethought 0, Merged 0.

## Most important changes

- llmops: pinned model versions do not change silently; aliases and retirements do. Beat 3 corrected.
- rag-evaluation: generation is scored for faithfulness to the chunks it was given, not left "unscoreable".
- prompt-injection: the guardrail fix is shown as partial (a reworded attack slips past); least privilege is the stronger fix.
- llm-as-a-judge: added position bias (swap order, verdict flips) and a fuller fix.
- llm-hallucination: readout relabelled "sounds sure" (tone), not identical internal confidence.
- model-context-protocol: discovery matches the 2026-07-28 stateless spec; the client, not the model, makes the call.
- gpu-scheduling-kubernetes: added time-slicing, gang scheduling via Kueue/Volcano (not default), and DRA.
- ai-bias-fairness: group sizes make the 94% arithmetically true; ai-data-privacy: log retention and training reuse hedged to real terms.
- Smaller fixes: step numbering (agent-loop), 98% vs "all green" (llm-evals), span timings (llm-observability), KV-cache beat (ai-accelerators), stray drafting note (training-checkpoints).

## Patterns for the platform

- "Toggle a component off and replay" (guardrail, tool, trifecta leg, router, gateway) is the dominant interaction; needs cheap scenario replay with one switch.
- Before/after twin runs of the same input with one variable changed (rewind and replay) appear in nearly every plan.
- A shared token-chip tray with per-chip styling (red-tinted, cached highlight, price tag) carries injection, caching, cost and memory.
- Meters that accumulate per arrow or per span (latency, cost, tokens) and scoreboards with pass/fail tints recur.
- Dials/sliders that change a threshold or interval (similarity ring, checkpoint interval, rollout percentage, budget cap) with live consequences.
