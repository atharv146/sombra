# Model experiments

| Version | Training data | Test set (40, hand-written) | Accuracy | Macro F1 | Emergency recall | Shipped? |
|---|---|---|---|---|---|---|
| v1 | 430 Gemini-generated, hand-checked | Darshan's | 0.80 | 0.80 | 0.80 | **Yes** |
| v2 | v1 + 150 AI-written off-topic/request sentences labeled `ok` (`train_extra_ok.csv`) | same | 0.80 | 0.80 | 0.70 | No |

**Why v2 was rejected:** the extra "ok" examples made the model less willing to call emergencies (recall 0.80 → 0.70). Missing an emergency is the worst error for a safety tool, so we kept v1. Off-topic messages ("hi boss", "I miss you") are handled instead by the AI router plus a confidence gate: the model's label only counts as health at ≥ 0.55 confidence, and safety keywords always escalate.
