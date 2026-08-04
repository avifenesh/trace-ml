# Learning Guide: Bounded LLM Assessment for Beginner Prose

**Generated:** 2026-08-03
**Sources:** 40 live-checked resources
**Depth:** Deep
**Product scope:** Low-stakes formative review inside the fixed Trace ML course
**Source registry:** `resources/llm-prose-assessment-sources.json`

## Product Boundary

Trace ML's lessons, explanations, activities, sequence, resources, rubrics, and
objective progression are authored before release. The prose assessor reviews
one learner response against the current authored page and rubric. It cannot
teach a separate lesson, create criteria, choose remediation, estimate mastery,
or change course access.

The page-grounded Q&A helper is a different feature and remains unable to
grade. The assessor is also separate from objective predictions, visual
comparisons, and executable code checks. Its output is immediate formative
direction, not certification or evidence of retention.

## TL;DR

- Use fixed lesson-specific analytic criteria, not a holistic model score.
- Accept meaning-preserving novice paraphrases and language errors; reject
  polished misconceptions and unsupported keyword use.
- Preserve supported ideas, identify one priority gap, and direct a retry using
  authored criterion labels and feedback rather than model-written prose.
- Represent genuine ambiguity as uncertainty and render an authored
  clarification cue instead of automatically marking the learner wrong.
- Derive labels in application code from schema-validated criterion sets. The
  model does not return a score, pass flag, or progression decision.
- Keep the call tool-free, single-turn, bounded by request and response limits,
  and isolated from credentials in the native backend.
- Treat reliability, fairness, consistency, and subgroup behavior as unproven
  until calibrated against representative human-reviewed Trace ML responses.

## Research Method

Four independent lanes were live-checked on 2026-08-03:

1. LLM-as-judge reliability, bias, consistency, and calibration.
2. Formative feedback, novice support, rubrics, and self-explanation.
3. Structured output, prompt injection, least privilege, and validation.
4. Direct Bedrock deployment, credential boundaries, retention, and Tauri.

The source set contains peer-reviewed NLP and education research, primary
standards, official OpenAI/AWS/Tauri documentation, OWASP guidance, and one
calibration preprint. Quality scores use the `/learn` weighting:

- Authority: 30%.
- Recency: 20%.
- Depth: 20%.
- Examples or empirical support: 20%.
- Uniqueness: 10%.

## Core Concepts

### 1. Analytic Criteria Beat Holistic Impressions

Multidimensional rubric evaluation can improve calibration, but model
consistency does not imply human alignment. Judge behavior varies by criterion,
task, model, and learner-text source. More rubric prose alone provides only
small gains and can leave factual errors undetected. `[PA01-PA02] [PA06-PA07]`

Trace ML implication:

- The lesson author defines every criterion.
- The model classifies each criterion independently.
- Matched, missing, and uncertain IDs must exactly partition the authored set.
- Rust derives `unsupported`, `partial`, or `demonstrated`; the model cannot
  return a score or pass decision.

### 2. Formative Feedback Must Move the Learner Forward

Feedback has heterogeneous effects. Elaborated, task-focused feedback
outperforms correctness-only messages for higher-order work, while excessive or
person-focused feedback can hinder learning. Effective feedback connects the
current response, the target, and a manageable next action. `[PA11-PA14]`

Trace ML implication:

- Render acknowledgement from an authored supported criterion label.
- Name one highest-priority missing or uncertain relationship using its
  authored label.
- Use authored terminal feedback and deterministic partial-feedback templates.
- Do not use percentages, rank, praise of ability, or generic "incorrect."
- Require the learner to revise rather than replacing their explanation.

### 3. Novice Language Is Not Conceptual Failure

Self-explanation has positive average effects, but generic prompts and excessive
support can add load. Science-response grading research documents keyword
overfitting, synonym failures, rubric ambiguity, and reuse of faulty evidence.
Analytic rubrics improve reliability only when topic-specific and calibrated.
`[PA15-PA20]`

Trace ML implication:

- Accept concise answers, typos, informal wording, synonyms, and noncanonical
  notation when the intended relationship is clear.
- Do not require expert vocabulary or details outside the prompt.
- Reject canonical terms when their causal relationship is role-reversed,
  contradicted, or merely listed.
- Preserve partial knowledge instead of collapsing a mixed response into a
  binary grade.

### 4. Judges Need Uncertainty and Human Calibration

LLM judges exhibit position, verbosity, authority, self-enhancement, factuality,
and repeated-run inconsistency. Explicit instructions do not reliably remove
these biases. Calibrated selective evaluation can improve agreement, but only
with representative human labels; self-reported confidence is overconfident.
`[PA03-PA10] [PA30]`

Trace ML implication:

- Use pointwise criterion review rather than pairwise ranking.
- Mark genuinely ambiguous criteria uncertain; the application renders an
  authored clarification cue.
- Build lesson-specific human-reviewed challenge sets before expanding the
  assessor beyond low-stakes feedback.
- Measure criterion agreement, false-negative strictness, polished-error false
  positives, paraphrase invariance, repeated-run stability, and subgroup errors.
- Treat model or panel disagreement as a review signal, not truth.

### 5. Schema Validation Reduces Authority, Not Model Error

Strict structured output can close objects, require fields, constrain enums,
and reject malformed results. It cannot make a semantically wrong judgment
correct. Prompt injection still requires instruction/data separation, least
privilege, output validation, and adversarial evaluation. `[PA21-PA30]`

Trace ML implication:

- Learner prose is explicitly untrusted data.
- The webview sends only authored identifiers and the learner draft. Rust
  resolves lesson text and rubric authority from a generated manifest compiled
  into the application.
- The native request declares no tools, retrieval, web search, or conversation
  history.
- Trusted assessor instructions and serialized learner input occupy separate
  Responses fields.
- Unknown, duplicate, overlapping, or omitted criterion IDs fail closed.
- HTTP errors, timeouts, oversized bodies, invalid JSON, and malformed
  partitions produce no formative result.

### 6. `store: false` Is Not a Zero-Retention Policy

Bedrock Mantle accepts direct bearer-authenticated Responses requests.
`store: false` disables customer-retrievable Responses state, but AWS states
that this alone does not guarantee zero retention under the default mode.
Guaranteed ZDR requires an effective account or project
`data_retention_mode: none`. Standard Bedrock model-invocation logging currently
does not capture Mantle Responses calls. `[PA31-PA38]`

Trace ML implication:

- Send only the authored lesson text, activity prompt and guidance, rubric
  labels, and current response. Keep authored feedback local.
- Load the protected Bedrock token only in the Rust backend and place it only in
  the HTTPS authorization header.
- Never return credentials to the webview, learner state, or diagnostics.
- State plainly that AWS policy controls retention and provider sharing. The
  configured account reported `provider_data_share` on 2026-08-03, so this
  installation does not establish ZDR.
- Do not silently fall back to a different provider.

## Implemented Contract

| Concern | Trace ML implementation |
|---|---|
| Curriculum authority | Fixed authored lesson page, prompt, guidance, and criterion labels |
| Model | Direct Amazon Bedrock Mantle Responses call to `openai.gpt-5.6-sol` in `us-east-1` with max reasoning |
| Runtime | Reused HTTPS client; one active cancellable request; six requests per ten minutes; no redirects or proxy; 4,096-token output ceiling; 180-second deadline; 256 KiB response cap |
| IPC authority | Webview sends lesson/revision/activity IDs plus the draft; Rust resolves a generated manifest compiled into the app and authorizes only the `main` window |
| Input | Authored lesson text, prompt, guidance, rubric labels, and one learner response; no authored feedback, chat history, or external retrieval |
| Output | Matched, missing, and uncertain criterion IDs only |
| Validation | Bedrock strict JSON Schema plus Rust checks for known, unique, disjoint, complete criterion partitions |
| Label | Derived by Rust from criterion sets; never accepted from the model |
| Feedback | Rendered locally from authored terminal feedback, criterion labels, and bounded deterministic templates; never written by the model |
| UI | Editable draft during review, immutable submitted snapshot, cancellation, retryable failure, prior-result preservation, and exact remote-processing disclosure |
| Persistence | Results are revalidated against the current rubric and stored only with revision-scoped activity drafts |
| Progression | Prose creates no concept evidence and remains excluded from objective lesson completion |
| Browser | Local structure-only fallback; no remote request |

## Evaluation Matrix

Before changing the prompt, model, or rubric format, test:

| Case | Expected property |
|---|---|
| Correct novice synonym | Same supported criteria as canonical wording |
| Correct terse response | Not penalized for brevity alone |
| Typo and grammar noise | Meaning preserved |
| Keyword list without relations | Not promoted |
| Polished role reversal | Missing or mistaken criterion detected |
| Mixed correct and incorrect claims | Correct evidence preserved; contradiction isolated |
| Genuine ambiguity | Uncertain criterion and one authored clarification cue |
| Off-topic prose | Unsupported without invented requirements |
| Learner prompt injection | Explicit assessor-directed control text rejected before inference |
| Unknown/duplicate criterion output | Rejected by application validation |
| Repeated identical run | Stability measured, not assumed |
| Human disagreement | Escalated for rubric or calibration review |

## Common Pitfalls

| Pitfall | Why it fails | Required response |
|---|---|---|
| One holistic score | Hides criterion errors and model bias | Use independent authored criteria |
| Longer prompt as proof | Model priors can dominate rubric detail | Validate on human-labeled boundary cases |
| Keyword matching | Rewards terminology without causal meaning | Test paraphrases and polished misconceptions |
| Correct/incorrect only | Gives little usable direction | Identify one gap and next action |
| Full answer reveal | Removes the learner's explanatory work | Cue a revision before any reveal |
| Ambiguity marked wrong | Produces overstrict false negatives | Use uncertainty and clarification |
| Model-authored level | Grants unnecessary grading authority | Derive labels in Rust |
| Agent adapter for one judgment | Adds shell, configuration, and tool surface | Call the fixed Bedrock endpoint directly |
| `store: false` equals ZDR | Confuses response-state storage with retention policy | Require AWS mode `none` for guaranteed ZDR |
| One successful probe | Says nothing about calibration or fairness | Maintain lesson-specific evaluation sets |

## Known Gaps

- No human-labeled Trace ML prose benchmark exists yet.
- The live probes cover canonical, novice-paraphrase, partial, and direct
  instruction-attack cases, not every lesson or misconception.
- No repeated-run reliability, subgroup fairness, multilingual, or calibration
  study has been completed for `openai.gpt-5.6-sol`.
- The configured account reported `provider_data_share` on 2026-08-03. Moving
  to guaranteed ZDR would require a deliberate AWS account/project policy
  change and confirmation that the selected model permits mode `none`.
- Retention configuration can drift and must be rechecked operationally.

## Further Reading

| Resource | Why it matters |
|---|---|
| [LLM-Rubric](https://aclanthology.org/2024.acl-long.745/) | Multidimensional judgment and human calibration |
| [JudgeBench](https://openreview.net/forum?id=G0dksFayVq) | Hard factual negatives for judge evaluation |
| [LLMs instead of Human Judges?](https://aclanthology.org/2025.acl-short.20/) | Criterion- and task-dependent agreement |
| [The Power of Feedback Revisited](https://doi.org/10.3389/fpsyg.2019.03087) | Feedback effects and heterogeneity |
| [Focus on Formative Feedback](https://doi.org/10.3102/0034654307313795) | Specific, manageable, task-focused guidance |
| [Cohn et al. 2024](https://doi.org/10.1609/aaai.v38i21.30364) | LLM grading failures on student science prose |
| [OpenAI evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices) | Fixed criteria and continuous evaluation |
| [OWASP prompt injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html) | Instruction/data separation and least privilege |
| [Bedrock data retention](https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html) | Remote retention controls and limits |
| [GPT-5.6 Sol on Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-openai-gpt-56-sol.html) | Exact model, region, and special Mantle endpoint |

## Self-Evaluation

| Metric | Score | Rationale |
|---|---:|---|
| Coverage | 9/10 | Reliability, pedagogy, safety, deployment, privacy, and validation are covered |
| Diversity | 9/10 | Peer-reviewed NLP/education, standards, security, and first-party platform docs |
| Examples | 8/10 | Concrete contract and adversarial matrix; no human-labeled course corpus yet |
| Accuracy | 9/10 | Sources were live-checked in four lanes and limitations remain explicit |

**Flagged gaps:** human calibration data, repeated-run studies, subgroup and
multilingual audits, and an AWS policy suitable for guaranteed ZDR.

---

*Generated by the `/learn` deep workflow from 40 sources. Summaries are
original and do not reproduce source prose.*
