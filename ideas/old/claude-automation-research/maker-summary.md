# MAKER Framework: Comprehensive Summary

## Overview

**MAKER** (Maximal Agentic decomposition, first-to-ahead-by-K Error correction, and Red-flagging) is a framework developed by Cognizant AI Lab that successfully solved a task requiring over **one million LLM steps with zero errors**. This represents an orthogonal approach to scaling AI—instead of building more intelligent base LLMs, MAKER achieves reliability through extreme decomposition and error correction.

The framework belongs to a broader category called **Massively Decomposed Agentic Processes (MDAPs)**.

---

## The Core Problem

> "A system with a 1% per-step error rate is expected to fail after only 100 steps of a million-step task."

Current LLMs have a **persistent error rate** that prevents scale-up:
- Performance deteriorates significantly (often exponentially) with task length
- Even "state-of-the-art" reasoning models fail catastrophically after ~5-6 disk Towers of Hanoi (31-63 steps)
- Traditional benchmarks measuring 99% accuracy are meaningless for long-horizon tasks

**Key insight**: Even small improvements in individual subtask performance lead to **exponential improvements** in achievable task lengths.

---

## Three Core Components

### 1. Maximal Agentic Decomposition (MAD)

Break tasks into the **smallest possible subtasks** where each agent handles exactly one step.

**Why it works**:
- Each agent's context is limited to information sufficient for its single step
- Avoids confusion from irrelevant context accumulation
- Enables use of smaller, cheaper LLMs with limited context sizes
- Creates modularity that enables effective error correction

**Two extremes of decomposition**:
- **Single-agent** (m = s): One agent does all steps → context burden grows, reliability decreases
- **MAD** (m = 1): One agent per step → focused context, maximum modularity

**Mathematical formulation**:
```
For each step i:
  r_{i+1} ~ M(φ(x_i))       # Sample response from LLM M with prompt template φ
  a_{i+1} = ψ_a(r_{i+1})    # Extract action
  x_{i+1} = ψ_x(r_{i+1})    # Extract state for next agent
```

### 2. First-to-ahead-by-k Voting

An error correction mechanism where multiple agents independently solve the same subtask, and a winner is determined through voting.

**Algorithm**:
```python
def do_voting(x, M, k):
    V = {v: 0 for all v}  # Vote counts
    while True:
        y = get_vote(x, M)
        V[y] = V[y] + 1
        if V[y] >= k + max(V[v] for v != y):
            return y
```

**Key properties**:
- Samples candidates until one has been sampled **k times more than any other**
- Based on Sequential Probability Ratio Test (SPRT) optimality
- Guarantees convergence to correct answer with probability approaching 1 as k increases

**Scaling Laws**:

Probability of solving full task:
```
p_full = (1 + ((1-p)/p)^k)^(-s/m)
```

Where:
- `p` = per-step success rate
- `s` = total steps
- `m` = steps per subtask (1 for MAD)
- `k` = vote threshold

Minimum k for target success probability t:
```
k_min = ⌈ln(t^(-m/s) - 1) / ln((1-p)/p)⌉ = Θ(ln s)
```

**Critical insight**: k_min grows only **logarithmically** with the number of steps!

**Expected cost**:
```
E[cost; m=1] = Θ(p^(-1) · c · s · ln(s)) = Θ(s ln s)
```

This is **log-linear** scaling—comparable to efficient classical algorithms. The system scales efficiently as steps increase.

### 3. Red-Flagging

Detecting and discarding responses that signal unreliability before they contaminate the voting pool.

**Two red flag types**:
1. **Overly long responses** - When agents "go off the rails" and over-analyze
2. **Incorrectly formatted responses** - Indicates confusion during reasoning

**Why it works**:
- "Bad" behaviors are correlated in LLMs
- If output signals pathological behavior, the reasoning is likely wrong too
- Discarding flagged responses increases effective per-step success rate p
- **Crucially reduces correlated errors**, not just independent errors

**Cost with red-flagging**:
```
E[cost of MAKER] ≈ (c · s · k_min) / (v · (2p - 1)) = Θ(cs ln s / vp)
```
Where `v` = probability of valid (non-flagged) response

---

## Key Algorithms

### Main Solution Generation
```python
def generate_solution(x_0, M, k):
    A = []  # Action list
    x = x_0
    for s steps:
        a, x = do_voting(x, M, k)
        A.append(a)
    return A
```

### Vote Collection with Red-Flagging
```python
def get_vote(x, M):
    while True:
        r ~ (M ∘ φ)(x)  # Sample from LLM
        if r has no red flags:
            return ψ_a(r), ψ_x(r)  # Return action and next state
```

---

## Microagents: A New Paradigm

MAKER uses **microagents** with "micro-roles" rather than anthropomorphized human-level roles.

**Key principle**: By assigning agents tiny, focused roles:
- Exploit the inherent machine-like nature of LLMs
- Enable error-correction methods from classical computing
- Avoid the unreliability of giving agents complex, open-ended responsibilities

**Parallels with Microservices**:

| Microservices Benefit | Microagent Equivalent |
|-----------------------|----------------------|
| Modularity | Each agent tailored to specific subtask |
| Independent development | Agents updated/tested in isolation |
| Scalability | Scale resources per actual needs |
| Communication | Natural language as protocol |
| Design for failure | Tolerates individual agent failures |
| Real-time monitoring | Monitor agents in real-time |
| Evolutionary design | Change easier than monolithic agent |

---

## The Importance of Decorrelated Errors

**Critical insight**: The theoretical analysis assumes errors are i.i.d. across steps. In practice, some steps have **abnormally high error rates** for no apparent reason—these are correlated errors.

**Why correlation matters**:
- Even a single step with abnormally high error rate can cause failure
- Multiple votes on the same pathological input may all be wrong
- Correlated errors can overwhelm the voting mechanism

**Mitigation strategies**:
1. **Temperature sampling** - Independent resampling
2. **Red-flagging** - Discard suspicious responses
3. **Prompt paraphrasing** - Add noise to avoid anomalous states
4. **Model diversity** - Use different LLMs for different samples

**Empirical finding**: In the million-step experiment, zero steps had errors in both independent runs on a 10K sample set—demonstrating sufficient decorrelation.

---

## Model Selection Strategy

MAKER enables principled model selection based on **cost-effectiveness at scale**.

**Selection criterion**: Minimize `c/p` where:
- `c` = cost per sample
- `p` = per-step success rate

**Surprising findings**:
1. Smaller non-reasoning models perform comparably to advanced reasoning models
2. Per-step error rate is **remarkably stable** as problem size increases
3. The most cost-effective model isn't the cheapest OR the most accurate—it's the optimal ratio

**Results from experiments**:

| Model | $/MTok | Error Rate | k_min | Expected Cost |
|-------|--------|------------|-------|---------------|
| gpt-4.1-nano | 0.4 | 35.71% | 29 | $41.9K |
| gpt-4.1-mini (τ=0.1) | 1.6 | 0.22% | 3 | **$3.5K** |
| o3-mini | 4.4 | 0.18% | 3 | $9.4K |
| gpt-oss-20B | 0.2 | 3.58% | 6 | **$1.7K** |

**Key insight**: Expensive reasoning models aren't necessary. Small models with proper decomposition + error correction beat large models on cost-effectiveness.

---

## Execution vs. Insights

The paper distinguishes two types of LLM behaviors:

1. **Insights** - Creatively generating ideas, plans, strategies
2. **Execution** - Following through with clear instructions

MAKER focuses on **execution**: given a correct strategy, ensure reliable step-by-step completion.

**Why this matters for your coding agent**:
- Decomposition phase requires **insights** (creative problem-solving)
- Execution phase requires **reliable following of the plan**
- Different approaches may be needed for each phase

---

## Task Decomposition Scaling Laws

The cost grows **exponentially** with the number of steps per agent (m):

```
E[cost] = Θ(p^(-m) · c · s · ln(s))
```

**Visualization of the impact**:
- At m=1 (MAD): Efficient log-linear scaling
- At m=100: Orders of magnitude more expensive
- At m=1000+: Practically infeasible

**Why**: As more decisions are assigned to one agent, the chance that its sequence matches exactly across multiple samples vanishes exponentially.

---

## Convergence Behavior

In the million-step experiment:

1. **Exponential decay** in undecided steps after first k rounds
2. **Vast majority of cost** (and time) spent in first k samples
3. Remaining steps are "rounding error" in cost terms
4. Both first-to-k and first-to-ahead-by-k voting succeed

**Practical implication**: Can parallelize across Θ(ln s) processes, so **time cost scales linearly** with steps.

---

## Limits of Decomposition

**Central question**: Are there important problems where decomposition to sufficiently small steps is not possible?

**Considerations**:
- At lowest level: LLM operations decompose to CPU/GPU primitives
- Hope: Some linguistic decomposition exists between primitive and full task
- Unknown: Which tasks resist linguistic decomposition

**For coding agents**: The quality of decomposition **directly determines execution success**. A well-decomposed plan with clear acceptance criteria will execute reliably; a vague plan produces vague results.

---

## Safety and Controllability Benefits

If problems can be decomposed into microsteps:

1. **Limited scope** - Each agent's view of world is strictly limited
2. **Sand-boxing** - Easier to audit and control
3. **Anti-collusion** - Multiple independent agents reduce harmful action risk
4. **Smaller models** - Avoid emergent harmful behaviors of powerful models
5. **Reduced sentience risk** - Limited-scope subtasks reduce chance of unintentional emergence

---

## Relevance to Coding Agent Design

### Direct Applications

1. **Task Decomposition**
   - Break features into atomic, verifiable subtasks
   - Each subtask simple enough for reliable completion
   - Clear acceptance criteria for each

2. **Multi-Agent Execution**
   - Parallel workers for independent tasks
   - Voting for critical decisions
   - Red-flagging for suspicious outputs

3. **Verification at Each Step**
   - Self-verification (task writes its own tests)
   - Quick validation (cheap model confirms intent match)
   - Phase gates (full test suite at milestones)

4. **Model Selection**
   - Use cheap models where sufficient
   - Reserve expensive models for complex reasoning
   - Optimize for cost-effectiveness, not raw capability

### Implementation Considerations

**From MAKER to Coding**:

| MAKER Concept | Coding Agent Application |
|---------------|-------------------------|
| Towers of Hanoi step | Single atomic code change |
| Known strategy | Decomposed plan with subtasks |
| State = disk config | Codebase state + git |
| Move = disk action | Code edit + test |
| Red-flag: long response | Red-flag: excessive changes |
| Red-flag: bad format | Red-flag: failing tests |
| Voting on action | Multiple implementations → test-based selection |

### Key Differences to Consider

1. **Code steps are not uniform** - Unlike Towers of Hanoi, code tasks vary in complexity
2. **Verification is expensive** - Tests take time; can't vote as cheaply
3. **State is complex** - Codebase state is much larger than disk configuration
4. **Decomposition is hard** - Discovering optimal decomposition is an open problem

### Suggested Adaptations

1. **Tiered verification**:
   - Quick: Syntax/lint check (like format red-flag)
   - Medium: Type check + fast tests
   - Full: Complete test suite (at phase gates)

2. **Adaptive voting**:
   - Simple tasks: k=1 (no voting)
   - Complex tasks: k=2-3 with test-based discrimination

3. **Red-flag signals for code**:
   - Excessive file changes
   - Large diffs
   - Failing type checks
   - Lint errors
   - Touching unrelated files

4. **Error decorrelation**:
   - Different prompts for each implementation attempt
   - Temperature variation
   - Potentially different models

---

## Key Takeaways

1. **Decomposition enables reliability** - Break tasks into smallest possible pieces
2. **Error correction at each step** - Don't wait until the end to discover problems
3. **Small models often suffice** - With proper decomposition, expensive models aren't needed
4. **Red-flagging catches correlation** - Detect and discard suspicious outputs
5. **Cost scales log-linearly** - Efficient scaling is achievable with MAD
6. **Decorrelation is crucial** - Independent samples must actually be independent
7. **Verify continuously** - Each step verification catches errors early

---

## Mathematical Reference

### Core Equations

**Probability of correct subtask via voting**:
```
p(a_i = a*) = p^k / (p^k + (1-p)^k)
```

**Probability of solving full task**:
```
p_full = (1 + ((1-p)/p)^k)^(-s/m)
```

**Minimum k for target probability t**:
```
k_min = ⌈ln(t^(-m/s) - 1) / ln((1-p)/p)⌉
```

**Expected cost (MAD)**:
```
E[cost] = (c · s · k_min) / (p^(m-1) · (2p-1))
```

**With red-flagging**:
```
E[cost] ≈ (c · s · k_min) / (v · (2p-1))
```

Where:
- `p` = per-step success rate
- `s` = total steps
- `m` = steps per subtask
- `k` = vote threshold
- `c` = cost per step
- `v` = probability of valid (non-flagged) response
- `t` = target overall success probability

---

## Citation

```
Meyerson, E., Paolo, G., Dailey, R., Shahrzad, H., Francon, O., Hayes, C.F.,
Qiu, X., Hodjat, B., & Miikkulainen, R. (2025). Solving a Million-Step LLM
Task with Zero Errors. arXiv:2511.09030
```
