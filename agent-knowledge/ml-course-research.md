# Trace ML Course Research Guide

**Research date:** 2026-08-02, with claim-specific corrections validated 2026-08-05<br>
**Depth:** Deep<br>
**Sources:** 109 live-validated resources<br>
**Product:** Fixed, authored 21-lesson machine-learning course
**Source registry:** `resources/ml-course-research-sources.json`

## Status And Claim Labels

This guide distinguishes evidence from product choices:

- **Sourced finding:** a claim reported by one or more sources in the registry. Source IDs such as `[S01]` resolve to the JSON registry.
- **Synthesized design decision:** a Trace ML choice inferred from several findings and the product requirements. It is not a claim that a study validated the complete design.
- **Product constraint:** a non-negotiable requirement supplied by the product owner.

The six-stage loop `read -> predict -> manipulate -> explain -> transfer -> code` is an **evidence synthesis, not a validated instructional package**. Individual stages and transitions have supporting evidence, but no reviewed source tested this exact sequence end to end.

## Executive Decision

**Product constraint:** Trace ML is a complete course whose lessons, order,
explanations, activities, gates, code, resources, and rubrics are authored
before release. The course is not generated, sequenced, or directed by an LLM.
A bounded LLM may review one free-form response against the current authored
page and rubric, but it cannot create criteria, control progress, choose
remediation, or certify mastery.

**Synthesized design decision:** Use a fixed foundations-to-modern-ML spine:

`data and prediction -> linear models -> loss -> optimization -> generalization -> classification -> features and classical models -> neural networks -> representation architectures -> sequential decisions -> deployment diagnosis`

This order reflects substantial convergence among current official courses. Those courses often call themselves beginner-friendly while still requiring Python, NumPy, algebra, statistics, and sometimes calculus. Trace therefore authors a Lesson 00 zero-onramp and assumes no prior ML, Python, NumPy, matrix, derivative, or probability vocabulary. `[S01-S15] [S108-S109]`

**Product constraint:** The chatbot is a small, optional side feature. It may answer a learner's question about the current authored page, ask a clarifying question, or restate the page more simply. It may not teach a separate lesson, choose the next topic, alter the sequence, create material, grade, unlock progression, or estimate mastery.

## Research Method

Five independent research lanes were completed and consolidated on 2026-08-02:

1. Current curriculum sequences and prerequisites.
2. Learning science for prediction, feedback, worked examples, self-explanation, manipulation, transfer, mastery, and code scaffolding.
3. Visual and interactive ML artifacts, including their misconception risks.
4. Runnable-code pedagogy and exact placement of official readings and exercises.
5. Page-grounded Q&A architecture and safety boundaries.

The lanes prioritized current official course pages, primary studies, systematic reviews, meta-analyses, standards, and canonical interactive artifacts. URLs in the registry were live-validated by the research lanes on 2026-08-02. Metadata is intentionally conservative: dates are `null` when the reports did not establish an exact date, and qualified date notes are retained instead of guessed.

Sources were scored with the `/learn` rubric:

- Authority: 30% of the total.
- Recency: 20%.
- Depth: 20%.
- Examples: 20%.
- Uniqueness: 10%.

Summaries are original, short, and copyright-safe. They capture implications rather than reproducing source prose.

## Curriculum Source Matrix

### Sourced Findings

| Source | Current published sequence | Exercise model | Boundary for Trace ML |
|---|---|---|---|
| Google ML Crash Course `[S01]` | Linear regression, logistic classification, data/generalization, neural networks, embeddings, LLM and production topics | Checks, interactive visualizations, browser notebooks | Strong broad order and short resources; not a mechanism-evidence system |
| Stanford CS229 2026 `[S02]` | Least squares and optimization before classification, classical models, neural networks, transformers and RL | Mathematical problem sets and final | Assumes stronger probability, calculus, and mathematical maturity |
| MIT 6.390 2026 `[S03]` | Public topic calendar was not available in the report | Lecture, team lab, recitation rhythm | Supports delivery rhythm only, not topic order |
| MIT 6.S191 2026 `[S04]` | Deep learning, sequence models, vision, generative models, RL, LLM fine-tuning, safety | Software labs and project | Useful after foundational mechanisms; not an intro-ML spine |
| CMU 10-301/601 `[S05]` | Function approximation and classical models through optimization, neural networks, transformers, RL and unsupervised learning | Written work, programming, quizzes, exams | Broad and rigorous; assumes substantial programming and math |
| Dive into Deep Learning `[S06]` | Preliminaries, linear models, MLPs, CNNs, RNNs, attention, advanced topics | Runnable notebooks; from-scratch then concise APIs | Excellent implementation pattern; site content is older than current courses |
| scikit-learn MOOC `[S07]` | Predictive pipelines, model selection, tuning, linear models, trees, ensembles, evaluation | Named exercises, quizzes, notebooks | Best for evaluation and model-selection stages, not first mechanism discovery |
| Berkeley CS189 2026 `[S08]` | Data and mechanics, probability, generative and discriminative models, optimization, neural networks, transformers and applications | Derivation and coding homework | Strong evidence for theory-code pairing; prerequisite bar is high |
| Harvard CS1810 2026 `[S09]` | kNN and regression, validation, optimization, classification, features, neural networks, trees, unsupervised and sequential models | Theory/programming homework and solved sections | Supports early evaluation and a broad survey; faster than Trace ML's mechanism pace |
| Understanding Deep Learning 2026 `[S10]` | Supervision, networks, loss, training, gradients, generalization, architectures, generative models and RL | Problems, interactive figures, fill-in-code notebooks | Strong modern reference and visual/code pattern; deep-learning-centered |
| PyTorch Learn the Basics `[S11]` | Tensors, data loading, model, autograd, optimization, persistence | Executable tutorial notebooks | Framework introduction belongs after mechanisms, not before them |
| Stanford CS231n 2026 `[S12]` | Linear classifiers and optimization before neural networks, attention, generative and multimodal models | Written/programming assignments and project | Valuable for representations and architectures after the core |
| ISLP `[S13]` | Regression, classification, resampling, regularization, nonlinear methods, trees, deep and unsupervised learning | Chapter labs and notebooks | Accessible statistical-learning reference; not current enough to set modern-topic scope |
| Building AI `[S14]` | Optimization, probability, regression, classification, neural networks and project framing | Tiered exercises | Supports approachable practice but not the complete mechanism sequence |
| TensorFlow Playground `[S15]` | No course sequence | Live network editing and training | A controlled instrument only; it can encourage test peeking and toy-data overgeneralization |

**Sourced finding:** Across the current curricula, the most stable foundation is linear prediction, objective/loss, optimization, generalization, logistic classification/evaluation, and only then neural networks. Modern topics such as transformers, agents, and generative models appear after optimization and backpropagation. `[S01-S12]`

**Sourced finding:** A recurring exercise structure is derive or trace, implement from scratch, use a library, and diagnose failure. `[S05-S12]`

**Sourced finding:** A beginner label does not imply a from-zero prerequisite boundary. Google MLCC explicitly expects Python, NumPy, algebra, linear algebra, statistics, and optional calculus, while the official Python tutorial separately introduces assignment, arithmetic, lists, and sequence length. `[S108-S109]`

### Synthesized Design Decisions

- Keep a fixed authored sequence. Remediation may repeat or expose an authored hint, but no runtime system changes the curriculum.
- Teach the exact Python and mathematical notation used by the course inside Lesson 00; external prework may reinforce it but cannot be required.
- Slow down the shared foundational order so each lesson can expose a mechanism, its assumptions, and a failure mode.
- Introduce framework APIs only after the learner can trace the relevant mechanism in a small example.
- Treat current LLM, agent, diffusion, and GNN content as post-course electives. Lesson 18 covers transformer mechanics because attention is now foundational, but not LLM product engineering.

## Learning-Science Synthesis

### What The Evidence Supports

| Construct | Sourced finding | Trace ML implication |
|---|---|---|
| Retrieval and prequestions | Retrieval can improve delayed retention; prequestions chiefly benefit the specifically questioned material and may disengage some learners. `[S16-S20]` | Ask a narrow prediction tied to the next mechanism. A wrong prediction diagnoses a model; it does not itself block the learner. |
| Error generation and feedback | Generating an error followed by corrective feedback can outperform reading; useful feedback is specific, task-focused, actionable, and sensitive to prior knowledge. `[S21-S22] [S29-S30]` | Commit predictions before reveal, then show the discrepancy and require a corrected explanation. |
| Worked examples and fading | Integrated worked examples support novices; support should change with expertise and may need to return. Generic self-explanation prompts can add load. A 2025 randomized study found better delayed recall and problem solving when later isomorphic examples prompted retrieval of each upcoming step before reveal. `[S23-S27] [S44] [S104]` | Begin with a complete worked specimen, then retrieve the same mechanism on an analogous case whose answer was not already shown. Fade selected steps and restore scaffolds when needed. |
| Self-explanation | Prompted self-explanation generally improves learning, but effects vary by prompt and context. `[S27-S28]` | Ask targeted causal prompts, not generic "explain your thinking." |
| Guided manipulation | Guided inquiry and supported simulation outperform unaided discovery; simulation activity alone is not understanding. `[S34-S35]` | Every lab names the intervention, holds other variables fixed, and requires before/after comparison. |
| Interleaving and discrimination | Interleaving has positive average effects when similar categories must be discriminated, but is not uniformly beneficial. `[S31]` | Interleave nearby mechanisms after initial schema formation, not during first exposure. |
| Transfer | Transfer depends on task distance and structural mapping; comparison of analogous cases can expose deep structure. `[S18] [S36-S37]` | Require an explicit mapping on a surface-different case, near transfer before far transfer. |
| Mastery and durable evidence | Immediate fluent performance may not predict durable learning; mastery systems often bundle thresholds with feedback, repetition, and extra time. `[S38-S40]` | Do not infer understanding from completion, confidence, resource opens, or one immediate score. |
| Misconceptions | Refutation can help, while intuitive models may remain latent after correct answers. `[S41-S42]` | Name the nearest misconception, contrast it with evidence, and recheck later in a varied context. |
| Programming | Programming difficulty includes syntax, concepts, strategy, mental models, prior knowledge, and environment; evidence does not establish one ideal trace/explain/write order. `[S43-S45]` | Use code as one evidence channel after conceptual work, with editable specimens and debugging rather than blank-editor performance. |

### Loop Interpretation

**Synthesized design decision:** Use this loop as an authored lesson template, with authored backward routes:

1. **Read:** Present a concise explanation and one integrated analogous example. This is exposure, not evidence.
2. **Predict:** Require a directional or numerical prediction, rationale, and optional confidence before reveal.
3. **Manipulate:** Change one causally relevant variable; preserve a baseline, seed, and exact before/after state.
4. **Explain:** Ask for the causal chain, a boundary condition, the nearest competing explanation, and a falsifying observation.
5. **Transfer:** Use an uncued, surface-different case and require the learner to map the shared structure.
6. **Code:** Predict a runnable specimen, execute it, investigate its state, modify it, and diagnose a failure.

Again, this six-stage sequence is an evidence synthesis, not a validated package.

### Evidence Gates

**Synthesized design decision:** Store an evidence vector rather than a single percent score:

`{uncuedRetrieval, causalPrediction, mechanismExplanation, misconceptionDiscrimination, transfer, executableCode, assistanceLevel, delay}`

Research vocabulary:

- `exposed`: read or opened a resource; never counts as understanding.
- `fragile`: succeeded with hints, same-format repetition, or immediate recognition.
- `demonstrated`: independently explained the mechanism and transferred it.

**Current-release boundary:** Trace ML records only `unsupported`, `partial`,
or `demonstrated` performance on the submitted authored activity. This release
does not schedule delayed checks, record a `retained` state, or infer durable
learning or mastery from an immediate demonstration. A future longitudinal
revision could claim retention only after a separately authored delayed or
interleaved variant is implemented and validated.

**Boundary:** These labels describe performance on an authored activity. The
chatbot does not assign or change them. Objective progression labels come from
deterministic checks; the separate prose assessor may return a formative label
for the current draft, but prose never satisfies objective completion or
establishes retention.

## Visual-Artifact Audit

### Sourced Findings And Risks

| Artifact | Useful interaction pattern | Misconception risk | Trace ML use |
|---|---|---|---|
| TensorFlow Playground `[S15]` | Editable networks and stepwise training | Test peeking, changing many variables, overgeneralizing toy boundaries | Seeded presets after generalization; one intervention at a time |
| Distill Gaussian Processes `[S46]` | Sliders linked to equations, samples, and uncertainty | Smooth graphics hide assumptions; exploration has no gate | Borrow coordinated representations, not GP content |
| PAIR Grokking `[S47]` | Scrubbable timeline linking loss, representations, and generalization | Exceptional dynamics may appear typical | Show multiple seeds and ordinary runs in training dynamics |
| Seeing Theory `[S48]` | Repeated trials connect samples and distributions | IID and stationarity remain implicit | Add repeated sampling and visible finite-sample variation |
| 3Blue1Brown Neural Networks `[S49]` | Verified 18:40 embedded video with progressive animation plus current checks | Visual fluency and literal feature-detector stories | Require prediction and non-image transfer after exposure |
| Observable Linear Regression `[S50]` | Drag points while residuals and fit update | Suggests altering observations; R-squared may imply causality or generalization | Link each residual, square, and mean; commit outlier prediction first |
| R2D3 `[S51]` | Staged, inspectable construction of a decision tree | Clean boundary can make training look inevitable | Follow with noise and a counterexample |
| K-Means Explorable `[S52]` | Manual objective, stepper, assumptions, local minima, scaling, outliers | Geometric clarity may be overgeneralized | Reuse its manual-objective-to-failure architecture for gradient descent |
| MLU Train/Test/Validation `[S53]` | Features and split behavior update together | Repeated selection makes "unbiased" validation/test language unsafe | Make train/validation/test roles and repeated-selection uncertainty explicit |
| PyTorch and UDL interactives `[S10-S11]` | Stable numeric state paired with code | Framework execution can obscure mechanism | Keep numeric traces visible before API abstraction |

### Synthesized Lab Contract

Every manipulation lab should:

1. State the invariant and the single intervention.
2. Capture a committed directional prediction.
3. Reveal linked data, model, objective/error, and internal-state views.
4. Compare exact before and after snapshots.
5. Stress one assumption or failure mode.
6. Require a causal explanation or a transfer.
7. Preserve the random seed and complete experiment state.

Slider movement, elapsed time, and visiting controls are activity telemetry, not comprehension evidence.

## Code Progression

### Sourced Findings

- PRIMM starts learners with working code through `Predict -> Run -> Investigate -> Modify -> Make`, rather than a blank editor. `[S54]`
- Current Google material places programming after conceptual explanations and interactive work; the loss and gradient-descent resources provide appropriate transition points. The gradient-descent page embeds a verified 2:12 Google video. `[S55-S56]`
- PyTorch's examples move from manual NumPy forward/backward work to tensors, autograd, and modules. `[S57]`
- NumPy is justified when vectorization, shape, multidimensional data, efficiency, and reduced boilerplate become part of the mechanism. `[S58]`
- Current scikit-learn material is strongest for pipelines, leakage prevention, model selection, and evaluation after core concepts. `[S07]`
- PyTorch `gradcheck` compares analytical derivatives with finite-difference approximations at tested inputs and tolerances; a pass supports derivative implementation but not the model or objective. `[S100]`
- PyTorch's momentum convention initializes the first buffer from the first gradient, while Adam carries first and second gradient moments and bias-corrects both. These exact state conventions must be visible whenever the course claims to reproduce them. `[S101-S102]`
- Ridge minimizes squared error plus a coefficient-size penalty. Even a tiny nonzero penalty changes the objective; in an underdetermined fit it can select one reproducible coefficient vector. `[S105]`
- Demographic parity compares overall positive-decision rates, while equality of opportunity compares positive-decision rates among actually positive or otherwise qualified cases. Neither metric supplies a universal fairness tolerance or settles stakeholder consequences alone. `[S106-S107]`

### Synthesized Progression

1. **Zero-onramp:** Read assignment, lists, function calls, loops, return, NumPy construction, shapes, and plot coordinates in a supplied specimen; repair one demonstrated array operation rather than inventing code.
2. **After loss:** Run a prewritten 12-20 line pure-Python specimen using scalar arithmetic, lists, and `math`. Predict output and loss before execution.
3. **At gradient direction:** Modify one update expression and learning-rate value. Never require a blank-file optimizer as the first code task.
4. **At vectors and batches:** Use NumPy after its array and shape notation has been explicitly introduced.
5. **At backpropagation:** Hand-trace one tiny branched scalar graph, add both routes into a shared parameter, verify several signed states with finite differences, then introduce autograd. Do not build a general autodiff engine.
6. **At evaluation:** Introduce scikit-learn pipelines, splitting, cross-validation, baselines, and parameter search.
7. **Across all code:** Predict before run, expose state, include held-out tests, and require an explanation of a failure and its repair.

## Fixed Authored Lesson Spine

This is a **synthesized design decision**, informed by the curriculum matrix and learning-science findings. It is not copied from one source and has not been validated as a complete 21-lesson treatment.

| ID | Authored lesson | Required mechanism evidence |
|---|---|---|
| 00 | Zero-onramp: Python values, NumPy shapes, plot coordinates, arithmetic notation, slope, chain rule, and class-count probability | Read every introduced symbol, trace array shapes, complete one supplied derivative rule and one count-based probability, then make one demonstrated code repair |
| 01 | Data, examples, targets, predictions, parameters, training vs. inference, baselines | Identify what changes during learning and beat a mean or majority baseline |
| 02 | One-feature linear model | Predict how weight and bias move the line, then verify with linked equation and graph views |
| 03 | Residuals, MSE, and the loss landscape | Trace every example's loss contribution and explain outlier sensitivity |
| 04 | Gradient descent from scratch | Predict direction and learning-rate failure, then implement and repair a small loop |
| 05 | Train, validation, test, and leakage | Create a controlled leakage failure, observe false improvement, and repair the split |
| 06 | Capacity, polynomial features, learning curves, and overfitting | Distinguish underfit, variance, and insufficient data from visible curves |
| 07 | Logistic regression and log loss | Hand-compute logit, probability, and loss; explain the decision boundary |
| 08 | Thresholds, confusion matrix, precision, recall, calibration, and cost | Choose a threshold for stated costs and distinguish ranking from calibration |
| 09 | Scaling, categorical encoding, missing values, feature crosses, and pipelines | Build a leakage-resistant pipeline and explain each transformation |
| 10 | k-nearest neighbors versus decision trees | Sketch boundaries before execution and contrast each inductive bias |
| 11 | L1/L2 regularization, cross-validation, and tuning | Select without touching the test set and predict coefficient changes |
| 12 | Bagging, random forests, and boosting | Explain whether each intervention primarily changes variance or bias |
| 13 | Hidden units, nonlinear composition, and XOR | Construct the boundary from visible hidden-unit features |
| 14 | Computational graphs, backpropagation, and autodiff | Accumulate both paths in a branched graph and verify signed gradients with finite differences |
| 15 | Mini-batches, initialization, learning rate, momentum, and Adam | Classify exact learning-rate regimes, inspect printed SGD and momentum state, and implement one Adam update |
| 16 | k-means, PCA, and learned embeddings | Distinguish clustering, reconstruction, and prediction objectives |
| 17 | Convolution, weight sharing, and residual paths | Compute a tiny convolution and explain receptive fields and shared weights |
| 18 | Attention and transformers | Compute a tiny Q-K-softmax-V pass and trace where information moved |
| 19 | Bandits, MDPs, and tabular Q-learning | Distinguish reward from label and execute one Bellman or Q update |
| 20 | Distribution shift, fairness, monitoring, and capstone diagnosis | Diagnose an end-to-end failure across data, objective, optimization, evaluation, and deployment |

The complete course, including every explanation, activity, alternative worked
example, hint, resource, rubric, and objective deterministic check, must ship as
authored content. Free-form prose remains a formative draft. Desktop semantic
review is bounded to the current authored page and rubric; browser-only term
matching reports structure. Neither path changes course material or objective
progression. Course revisions happen through editorial review and versioning,
never through runtime chatbot or assessor decisions.

## External Resource Placement

### Rules

1. An external resource follows a local prediction, manipulation, or checkpoint; it does not replace the authored lesson.
2. Opening, watching, scrolling, or spending time on a resource is exposure only and never progression evidence.
3. Every link has an exact placement, purpose, publisher, expected duration when known, date note, and misconception warning.
4. The learner can skip an external resource without losing access to authored course content.
5. Links are live-checked during editorial releases; a broken link cannot block a lesson.
6. Optional resources are labeled reinforcement or extension, not required proof.
7. Current framework documentation appears only after the corresponding mechanism is visible.
8. External interactives do not receive learner data unless separately reviewed and disclosed.

### Representative Placement Map

| After local authored checkpoint | External exposure | Purpose |
|---|---|---|
| Lesson 01 target selection | Google supervised-learning reading `[S66]` | Clarify labels and target definition |
| Lesson 02 linked line manipulation | Google linear regression `[S67-S68]`; Observable linear regression `[S50]` | Reinforce weight/bias and residual behavior |
| Lesson 03 compare two prediction errors | Google loss `[S55]` | Consolidate residual and MSE interpretation |
| Lesson 04 predict the update direction | Google gradient descent with 2:12 embedded video `[S56]`; K-Means Explorable `[S52]` as interaction-design comparison only | Reinforce iterative objective reduction and failure modes |
| Lesson 05 local leakage experiment | MLU Train/Test/Validation `[S53]` | Compare split roles and repeated selection |
| Lesson 13 hidden-unit prediction | 3Blue1Brown 18:40 neural-networks video `[S49]`; TensorFlow Playground `[S15]` | Visual reinforcement after mechanism evidence |
| Lesson 14 scalar chain-rule trace | PyTorch examples `[S57]` | Transition from manual gradients to autograd |
| Lesson 15 multi-seed curve comparison | PAIR Grokking `[S47]` | Contrast exceptional and ordinary training dynamics |

The release contains 41 direct learner resources. Their exact URLs, titles,
publishers, placement, duration, and verification date are checked against the
registry. Broad course roots, schedules, the PRIMM project page, the UDL
homepage, and the NIST publication page remain editorial research sources, not
optional learner resources.

## Chatbot Boundary: Page-Grounded Q&A Only

### Product Constraint

The chatbot is not a tutor, teacher, curriculum engine, lesson planner, grader, mastery model, or progression controller. It is an optional page-grounded Q&A helper.

Allowed:

- Answer a learner's explicit question using approved content from the current authored page.
- Point to the exact page section that supports the answer.
- Restate or simplify that page content without adding a new lesson.
- Ask a short clarifying question when the learner's question is ambiguous.
- Say that the current page does not contain enough information.
- Resume a prior Q&A thread for the same authored page and page revision.

Forbidden:

- Generate, select, reorder, skip, unlock, or replace lessons.
- Decide what the learner should study next.
- Introduce a self-created syllabus, activity, analogy presented as course content, or assessment.
- Grade responses, estimate mastery, assign evidence labels, or change progress.
- Decide hints, remediation, difficulty, or intervention policy.
- Use teaching cases or model memory as factual authority.
- Browse the live web at runtime or answer beyond the approved page corpus.
- Write course state, execute tools, or modify authored material.

### Minimal Grounding Architecture

**Sourced finding:** Retrieval systems need explicit citation and attribution evaluation; sentence-level source alignment helps detect unsupported claims. `[S59-S61]`

**Sourced finding:** Long-session memory benchmarks expose failures in information extraction, temporal updates, and stale-state reasoning. `[S62]`

**Sourced finding:** Generative-AI systems require provenance, prompt-injection defenses, privacy controls, and explicit risk management. `[S63-S65]`

**Synthesized design decision:** For each answer:

1. Filter retrieval to the current `lessonId`, `pageId`, and `revisionHash`.
2. Retrieve small paragraph-level spans with stable chunk IDs.
3. Compose only from those spans and conversational context.
4. Attach source chunk IDs to factual sentences.
5. Reject unsupported factual claims or stale revision anchors.
6. Abstain when the page lacks the answer.

Persist only current page/revision, learner-visible turns, unresolved learner question, and cited chunk IDs. Do not persist hidden reasoning or treat chat summaries as learning evidence.

This architecture supports Q&A reliability only. It does not give the chatbot any role in teaching or course governance.

## Prose Assessor Boundary: Authored-Rubric Review Only

The prose assessor is not the page Q&A chatbot and is not a curriculum agent.
It receives one authored page, one authored prompt, the authored criterion
labels, and one learner response. Its only model output is a schema-validated
partition of criterion IDs into matched, missing, and uncertain sets.

Allowed:

- Judge intended conceptual meaning rather than exact keyword overlap.
- Accept clear novice paraphrases, minor language errors, and concise answers.
- Identify which authored criteria are supported, missing, or uncertain.

Rust derives the formative level. Learner-facing acknowledgement and revision
direction come only from authored feedback and criterion labels; the model does
not write feedback, a replacement answer, or new teaching.

Forbidden:

- Add requirements beyond the authored rubric or use external facts.
- Write or revise lessons, rubrics, hints, resources, or activities.
- Choose the next lesson, remediation path, difficulty, or intervention.
- Treat one immediate response as retained learning or mastery.
- Change objective completion, lesson availability, or chatbot behavior.

The webview sends authored IDs and the learner draft; Rust resolves the trusted
lesson text and rubric from a generated manifest compiled into the app. The
desktop backend sends one direct HTTPS request with strict structured output,
validates that matched, missing, and uncertain IDs exactly partition the
authored criteria, derives the level, and renders authored feedback. One active
request is cancellable and rate-limited. Results remain revision-scoped
formative activity state and never become concept evidence. The request sets
`store: false`, but remote retention and provider sharing remain governed by
the effective AWS account/project policy. The configured account reported
`provider_data_share` during the 2026-08-05 verification, so zero data
retention is not established. The browser fallback reports structure only.
This separation preserves semantic feedback without turning course governance
over to an LLM.

## Known Evidence Gaps

- No reviewed study validates the full six-stage loop as one package.
- No reviewed study validates this exact 21-lesson order for the stated audience.
- Many foundational learning studies predate generative AI and interactive ML labs.
- Prequestioning can disengage some learners and primarily benefits the questioned content.
- Generic self-explanation prompts can add cognitive load or weaken worked-example benefits.
- Interleaving is conditional and should follow initial schema formation.
- Far transfer is heterogeneous; success on the same interface is not transfer evidence.
- Mastery-learning studies often confound thresholds with feedback, repetition, and extra time.
- Programming research does not establish one ideal explain/trace/write order.
- Visual artifacts can create fluency without mechanism understanding; the proposed lab contract still needs learner testing.
- A fixed course needs accessibility, internationalization, and novice usability studies beyond this research set.
- The page-grounded chatbot has no evidence showing it improves this course's outcomes. It should be evaluated as a side feature against a no-chat condition, with factuality and learner dependence monitored.
- LLM prose judgments can vary or encode bias even with a fixed rubric. Before
  they are used beyond low-stakes formative direction, they require
  criterion-level agreement studies against multiple human reviewers,
  adversarial response tests, and subgroup error analysis.
- Source freshness does not establish instructional correctness. Course releases still require subject-matter review, activity QA, and learner studies.

## Editorial Validation Before Publishing Lessons

For each lesson:

1. Map every factual claim to approved sources.
2. Mark every unsourced product choice as a synthesized design decision.
3. Confirm prerequisite concepts are already authored.
4. Verify that predictions precede reveals and executions.
5. Verify each manipulation changes one named causal variable.
6. Verify that the explanation and transfer prompts have authored rubrics.
7. Verify code starts from runnable specimens and includes failure diagnosis.
8. Verify resource opens cannot satisfy evidence gates.
9. Verify the chatbot corpus contains only the current approved page revision.
10. Run desktop and mobile interaction QA with stable seeds and snapshots.

## Self-Evaluation Against `/learn`

| Metric | Score | Rationale |
|---|---:|---|
| Coverage | 9/10 | Covers curriculum, learning science, visual mechanisms, code progression, fixed lesson spine, resources, Q&A boundary, gaps, and release checks |
| Diversity | 9/10 | Uses current university and official courses, primary studies, reviews/meta-analyses, standards, and canonical interactive artifacts |
| Examples | 8/10 | Provides concrete lesson gates, visual-lab contract, resource placements, and staged code progression; it intentionally does not include application code |
| Accuracy | 8/10 | Claims are bounded to the five live-validated reports, with conservative metadata and explicit synthesis labels; original sources were not independently re-fetched during consolidation |

**Flagged gaps:** learner accessibility studies, internationalization, comparative trials of the complete loop, empirical validation of the exact course order, and a course-specific Q&A ablation.

**Learn-skill compliance:**

- Deep target met with at least 40 live-validated sources.
- Source quality scored using the documented weighted rubric.
- Full metadata is in the companion JSON.
- Summaries are copyright-safe and do not reproduce source passages.
- Evidence and synthesized decisions are explicitly separated.
- Known limitations are prominent rather than hidden.

---

*Consolidated from five research lanes completed on 2026-08-02. See `resources/ml-course-research-sources.json` for source-level metadata.*
