import {
  lessonRevision,
  interactive,
  pythonLab,
  reading,
  responseActivity,
  video,
  videoAndReading,
} from "./lesson-helpers";
import { CAPSTONE_INCIDENT } from "./capstone-incident";
import type { Lesson } from "./types";

const CAPSTONE_ARTIFACT_DISPLAY_ID =
  `${CAPSTONE_INCIDENT.model.artifactDigest.slice(0, 19)}...`;
const CAPSTONE_TRAINING_DISPLAY_ID =
  `${CAPSTONE_INCIDENT.model.trainingTraceDigest.slice(0, 19)}...`;

export const systemLessons: Lesson[] = [
  {
    id: "backprop-graph",
    number: "14",
    moduleId: "neural",
    phase: "learn",
    published: true,
    title: "Trace credit through a graph",
    question: "How does one loss assign credit to every earlier operation?",
    summary:
      "Run a branched scalar graph forward, add both gradient paths into one shared parameter, and verify the result numerically.",
    durationMinutes: 60,
    revision: lessonRevision("backprop-graph"),
    sourceIds: ["S85", "S57", "S100", "S10"],
    mechanism: {
      input: "A scalar graph, its forward values, and a loss sensitivity",
      process:
        "Multiply each downstream sensitivity by the operation's local derivative, adding contributions where paths meet",
      output: "A gradient for every differentiable input and parameter",
    },
    starterQuestions: [
      "Why does backpropagation run in reverse graph order?",
      "What happens when one value reaches the loss through two paths?",
      "What does finite-difference checking test?",
    ],
    prerequisiteConceptIds: [
      "hidden-representation",
      "nonlinear-composition",
      "slope-chain-rule",
    ],
    outcomes: [
      {
        id: "backprop-explain-credit",
        conceptId: "backpropagation",
        text: "Explain backward credit as downstream sensitivity times a local derivative.",
        requiredEvidenceKinds: ["explanation"],
      },
      {
        id: "backprop-transfer-graph",
        conceptId: "chain-rule",
        text: "Map the same reverse accumulation to a surface-different scalar graph.",
        requiredEvidenceKinds: ["transfer"],
      },
      {
        id: "backprop-verify-code",
        conceptId: "autodiff",
        text: "Compute an analytic gradient and verify it with finite differences.",
        requiredEvidenceKinds: ["code-check"],
      },
    ],
    teaching: {
      title: "Follow loss information backward without losing a path",
      introduction: [
        "A computational graph is a step-by-step record of a calculation. In this lesson, x is an input, w is a parameter the model can change, b is an added bias, and target is the desired answer. The graph first computes p = w * x and q = w squared, then combines them as y_hat = p + q + b. The name y_hat means the model's prediction. Finally, L = 0.5 * (y_hat - target) squared produces one loss number, where a smaller loss means the prediction is closer to the target.",
        "Backpropagation asks how sensitive that final loss is to every earlier value. The notation dL/dw means the rate at which L changes when w changes by a very small amount. The letter d marks a derivative, not ordinary division. At each operation, a local derivative describes how that operation's output responds to one input. The chain rule connects operations: multiply sensitivities while moving along one path from the loss toward an earlier value.",
        "A boundary appears when one value feeds more than one later operation. Each route carries a separate contribution, and contributions that return to the same value must be added. Reverse-mode automatic differentiation, or autodiff, performs this bookkeeping in reverse graph order, but it does not decide whether the graph or loss expresses the right problem. A finite-difference check independently perturbs a value and tests the derivative calculation at that point.",
      ],
      vocabulary: [
        {
          term: "Computational graph",
          definition:
            "A directed record whose nodes hold values and whose connections show which operations produced later values.",
        },
        {
          term: "Forward pass",
          definition:
            "The left-to-right evaluation that computes every intermediate value and the final loss.",
        },
        {
          term: "Derivative",
          definition:
            "A local rate of change, such as dL/dw for loss change with respect to parameter w.",
        },
        {
          term: "Gradient",
          definition:
            "The collection of loss derivatives for the values or parameters being considered.",
        },
        {
          term: "Chain rule",
          definition:
            "The rule that multiplies local derivatives along a connected path through composed operations.",
        },
        {
          term: "Reverse-mode autodiff",
          definition:
            "An algorithm that starts at one output and accumulates chain-rule contributions backward through a recorded graph.",
        },
      ],
      workedExample: {
        title: "Trace both routes from one loss back to w",
        setup:
          "Use x = 2, w = 1, b = 0, and target = 1 in p = w * x, q = w squared, y_hat = p + q + b, and L = 0.5 * (y_hat - target) squared.",
        steps: [
          {
            label: "Compute and record the forward state",
            explanation:
              "p = 1 * 2 = 2 and q = 1 squared = 1. Therefore y_hat = 2 + 1 + 0 = 3, the prediction error y_hat - target is 2, and L = 0.5 * 2 squared = 2.",
          },
          {
            label: "Seed the backward pass at the loss",
            explanation:
              "For L = 0.5 * (y_hat - target) squared, dL/dy_hat = y_hat - target = 2. This says a small increase in y_hat would increase the current loss at a local rate of 2.",
          },
          {
            label: "Trace the product route",
            explanation:
              "Because y_hat includes p with coefficient 1, dL/dp = 2. Since p = w * x, dp/dw = x = 2. Multiplying along this route gives (dL/dp)(dp/dw) = 2 * 2 = 4.",
          },
          {
            label: "Trace the square route",
            explanation:
              "Likewise dL/dq = 2. Since q = w squared, dq/dw = 2w = 2 at w = 1. This second route contributes (dL/dq)(dq/dw) = 2 * 2 = 4.",
          },
          {
            label: "Join the routes and check the boundary",
            explanation:
              "Both routes end at the same w, so dL/dw = 4 + 4 = 8. A centered finite difference with epsilon = 0.001 gives approximately 8.000004, supporting the arithmetic. It checks this derivative implementation, not whether the objective is appropriate.",
          },
        ],
        takeaway:
          "Forward values identify the state being differentiated; backward multiplication handles each route; addition preserves every route that reaches a shared parameter.",
      },
      misconceptions: [
        {
          misconception: "Backpropagation sends the loss value itself backward.",
          correction:
            "It sends sensitivities: derivatives of the loss with respect to intermediate values. The forward loss here is 2, while the final derivative with respect to w is 8.",
        },
        {
          misconception: "Only one branch should be followed because w is one parameter.",
          correction:
            "One parameter can influence the loss through several operations. Omitting either branch discards a real effect and incorrectly gives 4 instead of 8.",
        },
        {
          misconception: "A successful gradient check proves that the model is correct.",
          correction:
            "It only compares analytical and numerical derivatives near tested inputs. A wrong data pipeline, graph, target, or objective can still have internally correct derivatives.",
        },
      ],
      summary: [
        "Write every forward value before differentiating so each local derivative has a known evaluation point.",
        "Multiply derivative factors along each route, then add contributions when routes meet at one earlier value.",
        "In the branched graph, the product route contributes 4 and the square route contributes 4, so the gradient dL/dw must accumulate both contributions.",
      ],
      sourceIds: ["S85", "S57", "S100", "S10"],
    },
    blocks: [
      {
        id: "backprop-graph-forward",
        kind: "opening",
        heading: "A graph is a record of operations",
        sourceIds: ["S85"],
        body: [
          "For x = 2, w = 1, b = 0, and target = 1, the graph p = w * x, q = w^2, y_hat = p + q + b, and L = 0.5 * (y_hat - target)^2 produces p = 2, q = 1, y_hat = 3, and L = 2. The shared value w fans out into two operations before their results meet again.",
          "The forward pass computes values. It does not yet say which earlier value should change.",
        ],
        conceptIds: ["computational-graph", "backpropagation"],
        tags: ["forward pass", "node", "edge", "loss", "scalar graph"],
      },
      {
        id: "backprop-local-chain",
        kind: "worked-example",
        heading: "Backward credit is a chain of local facts",
        sourceIds: ["S85"],
        body: [
          "At the loss, dL/dy_hat = y_hat - target = 2. The product path contributes 2 * dp/dw = 2 * x = 4. The square path contributes 2 * dq/dw = 2 * 2w = 4.",
          "Both paths originate at the same w, so reverse accumulation adds them: dL/dw = 4 + 4 = 8. The number 8 is the local rate at which this loss would change for a small change in the shared parameter.",
        ],
        conceptIds: ["chain-rule", "backpropagation"],
        tags: ["local derivative", "sensitivity", "gradient", "reverse order"],
      },
      {
        id: "backprop-paths-add",
        kind: "definition",
        heading: "Products follow paths; sums join paths",
        sourceIds: ["S10", "S85"],
        body: [
          "Along one path, chain-rule factors multiply. If a value influences the loss through several paths, the gradient contributions add because each path changes the same final loss.",
          "The product branch and square branch each provide one contribution to w. Keeping only either 4 would silently discard a real route from w to the loss.",
        ],
        conceptIds: ["chain-rule", "backpropagation"],
        tags: ["path", "accumulation", "branch", "zero derivative"],
      },
      {
        id: "backprop-autodiff-boundary",
        kind: "reading",
        heading: "Autodiff automates bookkeeping, not meaning",
        sourceIds: ["S57"],
        body: [
          "Reverse-mode autodiff records the forward operations and applies their derivative rules in reverse topological order. It computes the same chain-rule products and sums as the hand trace.",
          "Autodiff can return the exact derivative of the program and still optimize the wrong objective or propagate through a mistaken graph.",
        ],
        conceptIds: ["autodiff", "computational-graph"],
        tags: ["reverse mode", "operation tape", "objective", "implementation"],
      },
      {
        id: "backprop-gradient-check",
        kind: "checkpoint",
        heading: "A nearby perturbation checks the implementation",
        sourceIds: ["S100"],
        body: [
          "Finite differences compare the accumulated analytic gradient with [L(w + epsilon) - L(w - epsilon)] / (2 * epsilon). PyTorch's gradcheck applies this same analytical-versus-numerical idea to floating-point tensor inputs. Agreement across several signed cases supports the derivative code; it does not prove the model or loss is appropriate.",
        ],
        conceptIds: ["autodiff", "chain-rule"],
        tags: ["finite difference", "gradient check", "epsilon", "verification"],
      },
    ],
    activities: [
      {
        id: "backprop-direction-prediction",
        kind: "prediction",
        conceptIds: ["chain-rule", "backpropagation"],
        evidenceKind: "prediction",
        renderer: "choice",
        checkpoint: {
          id: "backprop-direction-prediction",
          prompt:
            "A new graph uses x = 3, w = 2, b = 0, target = 5, p = w*x, q = w^2, y_hat = p + q + b, and L = 0.5*(y_hat - target)^2. What is dL/dw after both routes are accumulated?",
          options: [
            { id: "thirty-five", label: "35" },
            { id: "fifteen", label: "15" },
            { id: "twenty", label: "20" },
            { id: "five", label: "5" },
          ],
          correctOptionId: "thirty-five",
          supportedExplanation:
            "Correct. y_hat = 10, so dL/dy_hat = 5. The product route contributes 5*x = 15 and the square route contributes 5*(2w) = 20, giving dL/dw = 35.",
          revisitExplanation:
            "First compute y_hat and the loss sensitivity. Then multiply through p = w*x and q = w^2 separately before adding the two contributions at w.",
        },
      },
      {
        id: "backprop-credit-lab",
        kind: "visual-lab",
        labId: "backprop-graph",
        conceptIds: ["computational-graph", "chain-rule", "backpropagation"],
        evidenceKind: "manipulation",
        title: "Watch two paths accumulate into one parameter",
        prompt:
          "Commit the two-path gradient first, then capture two shared-weight states and inspect each branch contribution before their sum.",
        invariant:
          "The branched topology, x = 2, b = 0, target = 1, loss, and derivative rules remain fixed.",
        intervention:
          "Change only the shared parameter w that feeds both branches.",
        control: {
          label: "Shared weight w",
          min: -1.5,
          max: 2,
          step: 0.25,
          initial: 1,
          lowLabel: "negative shared value",
          highLabel: "positive shared value",
        },
      },
      responseActivity(
        "backprop-credit-explanation",
        "explanation",
        ["chain-rule", "backpropagation"],
        "Why must dL/dw in the worked graph contain two terms? Trace both routes, show where multiplication and addition occur, and name a numerical result that would falsify your sum.",
        "Name the shared parameter, each local derivative, both path contributions, their sum, and a finite-difference check.",
        [
          {
            id: "backprop-product-route",
            label: "trace the product route through p = w times x",
            keywordGroups: [["product", "w * x", "w times x"], ["x", "local derivative"]],
          },
          {
            id: "backprop-square-route",
            label: "trace the square route through q = w squared",
            keywordGroups: [["square", "w^2", "w squared"], ["2w", "2 * w", "local derivative"]],
          },
          {
            id: "backprop-path-sum",
            label: "multiply along each route and add the two contributions",
            keywordGroups: [["multiply", "product", "chain rule"], ["add", "sum", "accumulate"], ["4 + 4", "8"]],
          },
          {
            id: "backprop-falsifier",
            label: "state a finite-difference result that would challenge the accumulated gradient",
            keywordGroups: [
              ["finite difference", "perturb"],
              ["8", "analytic gradient", "accumulated gradient"],
              ["disagree", "different", "would falsify", "would challenge"],
            ],
          },
        ],
        "You traced both branches and named a numerical check on their accumulated gradient.",
        "Start at the residual, trace w through p and q separately, then add only when both routes return to w.",
      ),
      responseActivity(
        "backprop-thermostat-transfer",
        "transfer",
        ["computational-graph", "chain-rule"],
        "A heater computes direct_heat = gain * command, resistive_heat = gain^2, temperature = direct_heat + resistive_heat + ambient, and discomfort = 0.5 * (temperature - target)^2. Explain d(discomfort)/d(gain) and map both gain paths to the worked graph.",
        "Use the residual, command, 2 * gain, both path contributions, and their sum. Do not answer only with a final formula.",
        [
          {
            id: "thermostat-residual",
            label: "derive the downstream discomfort sensitivity",
            keywordGroups: [
              ["temperature", "target"],
              ["difference", "residual", "minus"],
            ],
          },
          {
            id: "thermostat-direct-path",
            label: "identify command as the direct-heat path derivative",
            keywordGroups: [["direct heat", "gain * command", "gain times command"], ["command"], ["derivative", "path"]],
          },
          {
            id: "thermostat-resistive-path",
            label: "identify two times gain as the squared path derivative",
            keywordGroups: [
              ["resistive heat", "gain^2", "gain squared"],
              ["2 * gain", "2 gain", "twice gain"],
              ["derivative", "path"],
            ],
          },
          {
            id: "thermostat-accumulation",
            label: "multiply the residual along both routes and add at gain",
            keywordGroups: [
              ["residual", "temperature - target", "temperature minus target"],
              ["command", "2 * gain", "2 gain", "twice gain"],
              ["add", "sum", "accumulate"],
            ],
          },
        ],
        "You transferred fan-out and reverse accumulation without relying on the original variable names.",
        "Map gain to w, command to x, ambient to b, and preserve both routes from gain to temperature.",
      ),
      pythonLab(
        "backprop-python-lab",
        ["computational-graph", "chain-rule", "backpropagation", "autodiff"],
        "backprop_trace.py",
        "Predict both path contributions before running. Inspect the printed branched trace, then complete branch_contributions so it returns the product-route term, square-route term, and their sum. Verify several signed cases with finite differences and the pinned autograd library, then confirm a small negative-gradient step lowers loss.",
        `import autograd.numpy as anp
from autograd import grad


def forward(x, w, b, target):
    product_branch = w * x
    square_branch = w * w
    prediction = product_branch + square_branch + b
    residual = prediction - target
    loss = 0.5 * residual * residual
    return {
        "product_branch": product_branch,
        "square_branch": square_branch,
        "prediction": prediction,
        "residual": residual,
        "loss": loss,
    }


def branch_contributions(x, w, b, target):
    trace = forward(x, w, b, target)
    dloss_dprediction = trace["residual"]
    product_contribution = dloss_dprediction * x
    square_contribution = dloss_dprediction * (2.0 * w)
    # Modify: return both path contributions and their accumulated sum.
    return None


def backward(x, w, b, target):
    _, _, grad_w = branch_contributions(x, w, b, target)
    grad_b = forward(x, w, b, target)["residual"]
    return grad_w, grad_b


def finite_difference_w(x, w, b, target, epsilon=1e-5):
    high = forward(x, w + epsilon, b, target)["loss"]
    low = forward(x, w - epsilon, b, target)["loss"]
    return (high - low) / (2.0 * epsilon)


def loss_for_autodiff(w, x, b, target):
    residual = anp.multiply(w, x) + anp.square(w) + b - target
    return 0.5 * anp.square(residual)


autodiff_w = grad(loss_for_autodiff)


def one_step(x, w, b, target, learning_rate):
    grad_w, grad_b = backward(x, w, b, target)
    return w - learning_rate * grad_w, b - learning_rate * grad_b


CASES = [
    (2.0, 1.0, 0.0, 1.0),
    (-2.0, -0.5, 0.25, 1.0),
    (0.5, -1.0, 0.2, 0.0),
]
print("authored forward:", forward(*CASES[0]))
print("branch contributions:", branch_contributions(*CASES[0]))
`,
        [
          {
            id: "backprop-forward-values",
            label: "Forward values match the authored branched graph",
            expression:
              "str(tuple(forward(2.0, 1.0, 0.0, 1.0)[key] for key in ('product_branch', 'square_branch', 'prediction', 'residual', 'loss')))",
            expected: "(2.0, 1.0, 3.0, 2.0, 2.0)",
            conceptIds: ["computational-graph"],
          },
          {
            id: "backprop-branch-accumulation",
            label: "Both branch contributions are exposed and accumulated",
            expression: "str(branch_contributions(2.0, 1.0, 0.0, 1.0))",
            expected: "(4.0, 4.0, 8.0)",
            conceptIds: ["chain-rule", "backpropagation"],
          },
          {
            id: "backprop-route-identity",
            label: "Product and square routes retain their distinct local derivatives",
            expression:
              "str(branch_contributions(3.0, 0.5, 0.0, 0.75))",
            expected: "(3.0, 1.0, 4.0)",
            conceptIds: ["chain-rule", "backpropagation"],
          },
          {
            id: "backprop-analytic-gradient",
            label: "Backward pass is correct across signed graph states",
            expression:
              "all(abs(backward(x, w, b, target)[0] - forward(x, w, b, target)['residual'] * (x + 2.0 * w)) < 1e-12 and abs(backward(x, w, b, target)[1] - forward(x, w, b, target)['residual']) < 1e-12 for x, w, b, target in CASES)",
            expected: true,
            conceptIds: ["chain-rule", "backpropagation"],
          },
          {
            id: "backprop-finite-difference",
            label: "Finite differences verify every signed weight gradient",
            expression:
              "all(abs(finite_difference_w(x, w, b, target) - backward(x, w, b, target)[0]) < 1e-7 for x, w, b, target in CASES)",
            expected: true,
            conceptIds: ["chain-rule", "backpropagation"],
          },
          {
            id: "backprop-autodiff",
            label: "Autograd reproduces every accumulated scalar gradient",
            expression:
              "all(abs(float(autodiff_w(w, x, b, target)) - backward(x, w, b, target)[0]) < 1e-7 for x, w, b, target in CASES)",
            expected: true,
            conceptIds: ["autodiff"],
          },
          {
            id: "backprop-step-lowers-loss",
            label: "A small negative-gradient step lowers loss",
            expression:
              "all((lambda next_values: forward(x, next_values[0], next_values[1], target)['loss'] < forward(x, w, b, target)['loss'])(one_step(x, w, b, target, 0.01)) for x, w, b, target in CASES)",
            expected: true,
            conceptIds: ["backpropagation"],
          },
        ],
        1401,
        ["autograd"],
      ),
    ],
    resources: [
      reading(
        "backprop-pytorch-examples",
        "Learning PyTorch with Examples",
        "PyTorch",
        "https://docs.pytorch.org/tutorials/beginner/pytorch_with_examples.html",
        20,
        "backprop-python-lab",
        "Read after the local hand trace and finite-difference check; compare the manual-to-autograd progression without treating framework output as an explanation.",
        "S57",
      ),
      videoAndReading(
        "backprop-google-video",
        "Neural Networks: Training using backpropagation",
        "Google for Developers",
        "https://developers.google.com/machine-learning/crash-course/neural-networks/backpropagation",
        10,
        "backprop-credit-explanation",
        "After the hand explanation, watch the 2:28 conceptual video and use the surrounding reading to compare automatic backpropagation with the local scalar trace.",
        "S85",
      ),
    ],
  },
  {
    id: "optimizer-traces",
    number: "15",
    moduleId: "neural",
    phase: "learn",
    published: true,
    title: "Read the optimizer's trace",
    question: "Which mechanism produced this training curve?",
    summary:
      "Diagnose exact plain-SGD learning-rate regimes, then trace mini-batch, momentum, and Adam state in executable code.",
    durationMinutes: 65,
    revision: lessonRevision("optimizer-traces"),
    sourceIds: ["S86", "S101", "S102", "S47", "S10"],
    mechanism: {
      input: "Initialized parameters and a sequence of mini-batch gradients",
      process:
        "Aggregate each batch gradient and transform it with a learning-rate and optimizer state",
      output: "A parameter trajectory and loss trace across updates",
    },
    starterQuestions: [
      "Why do two mini-batches produce different gradients?",
      "How can momentum overshoot after the gradient changes sign?",
      "What does Adam normalize, and what does it not guarantee?",
    ],
    prerequisiteConceptIds: [
      "backpropagation",
      "gradient-descent",
      "learning-rate",
    ],
    outcomes: [
      {
        id: "optimizer-explain-trace",
        conceptId: "optimization-dynamics",
        text: "Diagnose an unstable trace using one controlled mechanism.",
        requiredEvidenceKinds: ["explanation"],
      },
      {
        id: "optimizer-transfer-control",
        conceptId: "mini-batch",
        text: "Transfer batch-noise and state reasoning to a different iterative estimator.",
        requiredEvidenceKinds: ["transfer"],
      },
      {
        id: "optimizer-code-updates",
        conceptId: "adam",
        text: "Complete an Adam parameter update and verify printed gradients, optimizer state, weights, and losses.",
        requiredEvidenceKinds: ["code-check"],
      },
    ],
    teaching: {
      title: "Read every optimizer update as a state transition",
      introduction: [
        "Training repeatedly changes model parameters to reduce an objective, usually a loss computed on training examples. Let theta name one parameter and let theta_star name the value that minimizes a simple objective. The error e_t = theta_t - theta_star is the parameter's signed distance from that minimum at step t. A gradient g_t is the local slope of the objective at theta_t. Plain stochastic gradient descent, or SGD, updates theta by theta_(t+1) = theta_t - eta * g_t, where eta is the learning rate.",
        "The learning rate scales the proposed move. A positive multiplier in the error recurrence keeps the error on the same side of the minimum; a negative multiplier crosses the minimum. A multiplier whose absolute value is below 1 shrinks the error, one with absolute value equal to 1 preserves its size, and one above 1 grows it. This sign-and-magnitude test turns a training curve into a traceable mechanism instead of a visual guess.",
        "Mini-batch SGD recomputes g_t from a subset of examples at each step, so the gradient itself can vary. Momentum also carries a velocity-like state v_t made from current and earlier gradients. Adam carries two states: m_t, a decaying average of gradients, and v_t, a decaying average of squared gradients, then bias-corrects both before updating. These optimizers transform gradients; they do not choose the objective, repair data, or guarantee useful generalization.",
      ],
      vocabulary: [
        {
          term: "Parameter",
          definition:
            "A model value, written theta here, that the optimizer is allowed to change during training.",
        },
        {
          term: "Objective",
          definition:
            "The numerical quantity training is set up to minimize or maximize; this lesson minimizes a loss.",
        },
        {
          term: "Gradient",
          definition:
            "The objective's local slope with respect to a parameter at the current state.",
        },
        {
          term: "Learning rate",
          definition:
            "The positive step-size factor eta that scales an optimizer's proposed parameter change.",
        },
        {
          term: "Momentum state",
          definition:
            "A carried value that combines the current gradient with a decaying history of earlier gradients.",
        },
        {
          term: "Adam moments",
          definition:
            "Carried first- and second-moment states that track gradients and squared gradients before bias correction.",
        },
        {
          term: "Adam decay rates",
          definition:
            "Beta1 and beta2 are numbers between zero and one that control how much earlier first- and second-moment state is retained.",
        },
        {
          term: "Epsilon",
          definition:
            "A small positive stabilizer added after the square root of Adam's corrected second moment, preventing division by zero.",
        },
      ],
      workedExample: {
        title: "Locate the exact boundary between shrinking and persistent error",
        setup:
          "Minimize J(theta) = (theta - 3) squared. Here theta_star = 3, e_t = theta_t - 3, g_t = 2e_t, and plain SGD uses theta_(t+1) = theta_t - eta * g_t. Start at theta_0 = 5.",
        steps: [
          {
            label: "Expose the initial state",
            explanation:
              "e_0 = 5 - 3 = 2, J(theta_0) = 2 squared = 4, and g_0 = 2e_0 = 4. The state before the update is therefore theta = 5, error = 2, loss = 4, gradient = 4.",
          },
          {
            label: "Derive the error transition",
            explanation:
              "Subtract theta_star from the SGD update: e_(t+1) = e_t - eta * 2e_t = (1 - 2eta)e_t. The multiplier 1 - 2eta completely determines this fixed quadratic replay.",
          },
          {
            label: "Check a shrinking case",
            explanation:
              "With eta = 0.25, the multiplier is 0.5. The first update is theta_1 = 5 - 0.25 * 4 = 4, so e_1 = 1 and the loss falls from 4 to 1 without crossing the minimum.",
          },
          {
            label: "Substitute the boundary value",
            explanation:
              "With eta = 1, the multiplier is 1 - 2 = -1. From theta_0 = 5, the update gives theta_1 = 5 - 1 * 4 = 1, so e_1 = -2: the sign flips, but the magnitude remains 2.",
          },
          {
            label: "Advance one more state",
            explanation:
              "At theta_1 = 1, g_1 = 2(1 - 3) = -4. The next update gives theta_2 = 1 - 1 * (-4) = 5, so e_2 = 2 and the loss is again 4. The trace oscillates forever without shrinking.",
          },
          {
            label: "Mark the optimizer boundary",
            explanation:
              "This recurrence describes plain SGD with a fixed full gradient and no carried state. Momentum would also require v_t; Adam would require m_t and v_t. Those states cannot be inferred from theta alone.",
          },
        ],
        takeaway:
          "For a fixed quadratic, inspect the update multiplier's sign and absolute value; at eta = 1, the multiplier -1 means alternating sides with unchanged error size.",
      },
      misconceptions: [
        {
          misconception: "Any oscillation means the run is diverging.",
          correction:
            "Oscillation only describes sign changes. Its magnitude may shrink, stay constant, or grow; eta = 1 produces constant-magnitude oscillation in this replay.",
        },
        {
          misconception: "A jagged mini-batch curve proves the learning rate is too large.",
          correction:
            "Changing batches also changes gradient estimates. Hold batch order, initialization, model, and seed fixed before attributing a trace to learning rate.",
        },
        {
          misconception: "Momentum and Adam remember earlier parameter values directly.",
          correction:
            "Their defining carried states summarize gradients. The exact convention matters, including how the first momentum buffer and Adam's bias corrections are initialized.",
        },
      ],
      summary: [
        "Translate the parameter update into an error recurrence before classifying the trace.",
        "Use the multiplier's sign for crossing behavior and its absolute value for shrinking, persistence, or growth.",
        "At eta = 1, e_(t+1) = -e_t, so the error changes sign while keeping the same magnitude.",
      ],
      sourceIds: ["S86", "S101", "S102", "S47", "S10"],
    },
    blocks: [
      {
        id: "optimizer-batches",
        kind: "opening",
        heading: "A mini-batch is a noisy view of the objective",
        sourceIds: ["S86"],
        body: [
          "The full gradient averages every training example. A mini-batch averages a selected subset, so its direction can differ even when the model and loss are unchanged.",
          "Smaller batches usually expose more variation between updates. That variation is not automatically evidence of a bug.",
        ],
        conceptIds: ["mini-batch", "optimization-dynamics"],
        tags: ["batch", "gradient estimate", "noise", "full gradient"],
      },
      {
        id: "optimizer-initialization",
        kind: "reading",
        heading: "Initialization chooses the first regime",
        sourceIds: ["S10", "S86"],
        body: [
          "Identical zero initialization can keep symmetric hidden units identical. Excessively large values can push nonlinear units into saturated regions or make early activations and gradients unstable.",
          "Initialization changes where optimization starts; it does not change which examples belong to the training objective.",
        ],
        conceptIds: ["initialization", "optimization-dynamics"],
        tags: ["symmetry", "scale", "saturation", "starting point"],
      },
      {
        id: "optimizer-rate",
        kind: "worked-example",
        heading: "Learning rate scales every proposed update",
        sourceIds: ["S86"],
        body: [
          "For gradient 4, plain gradient descent with rate 0.01 moves by 0.04; rate 0.5 moves by 2. A very small rate can look flat, while a large rate can cross the minimum repeatedly or diverge.",
          "A jagged curve alone does not identify the cause: batch order, initialization, and optimizer state must be held fixed before blaming the learning rate.",
        ],
        conceptIds: ["learning-rate", "optimization-dynamics"],
        tags: ["step size", "overshoot", "divergence", "controlled comparison"],
      },
      {
        id: "optimizer-state",
        kind: "worked-example",
        heading: "Adam updates moments, corrects them, then moves the parameter",
        sourceIds: ["S101", "S102"],
        body: [
          "Momentum accumulates a decaying history of gradients, so it can preserve motion through a shallow region and overshoot after direction changes. For this lesson's standard Adam update, start with m_0 = 0 and v_0 = 0. At step t, g_t is the current gradient, beta1 and beta2 are decay rates, eta is the learning rate, and epsilon is a small positive stabilizer.",
          "The complete update is m_t = beta1 * m_(t-1) + (1 - beta1) * g_t; v_t = beta2 * v_(t-1) + (1 - beta2) * g_t^2; m_hat_t = m_t / (1 - beta1^t); v_hat_t = v_t / (1 - beta2^t); theta_t = theta_(t-1) - eta * m_hat_t / (sqrt(v_hat_t) + epsilon). Epsilon is outside the square root: the denominator is sqrt(v_hat_t) + epsilon, not sqrt(v_hat_t + epsilon).",
          "For one numerical update, let theta_0 = 4, g_1 = 2, m_0 = v_0 = 0, beta1 = 0.9, beta2 = 0.999, eta = 0.1, and epsilon = 1e-8. Then m_1 = 0.2 and v_1 = 0.004. Bias correction gives m_hat_1 = 0.2 / 0.1 = 2 and v_hat_1 = 0.004 / 0.001 = 4. Therefore theta_1 = 4 - 0.1 * 2 / (sqrt(4) + 1e-8), approximately 3.9.",
          "Neither optimizer chooses the objective, fixes bad data, or guarantees generalization.",
        ],
        conceptIds: ["momentum", "adam", "optimization-dynamics"],
        tags: ["velocity", "first moment", "second moment", "bias correction"],
      },
      {
        id: "optimizer-diagnosis",
        kind: "checkpoint",
        heading: "Change one cause, then replay",
        sourceIds: ["S47", "S86"],
        body: [
          "A useful diagnosis preserves data order, initialization, model, and seed while changing one optimizer mechanism. Compare exact traces rather than interpreting one smooth or dramatic curve in isolation.",
        ],
        conceptIds: ["optimization-dynamics", "mini-batch", "initialization"],
        tags: ["seed", "replay", "ablation", "trace"],
      },
    ],
    activities: [
      {
        id: "optimizer-overshoot-prediction",
        kind: "prediction",
        conceptIds: ["learning-rate", "optimization-dynamics"],
        evidenceKind: "prediction",
        renderer: "choice",
        checkpoint: {
          id: "optimizer-overshoot-prediction",
          prompt:
            "A different quadratic has error update e(t+1) = (1 - 2 eta)e(t). Starting from any nonzero error, what happens when eta = 0.75?",
          options: [
            { id: "nonconvergent", label: "It oscillates without shrinking" },
            { id: "convergent", label: "It converges without crossing" },
            { id: "shrinking", label: "It oscillates and shrinks" },
            { id: "divergent", label: "It oscillates and grows" },
          ],
          correctOptionId: "shrinking",
          supportedExplanation:
            "Correct. At eta = 0.75 the multiplier is -0.5, so each step changes the error's sign while halving its magnitude.",
          revisitExplanation:
            "Substitute 0.75 into 1 - 2 eta. Use the multiplier's sign to decide whether the update crosses the minimum and its absolute value to decide whether the error shrinks.",
        },
      },
      {
        id: "optimizer-traces-lab",
        kind: "visual-lab",
        labId: "optimizer-traces",
        conceptIds: ["learning-rate", "momentum", "optimization-dynamics"],
        evidenceKind: "manipulation",
        title: "Replay one trace at several step sizes",
        prompt:
          "Predict convergence, shrinking oscillation, non-convergent oscillation, or divergence, then replay 12 plain-SGD steps on the same objective while changing only learning rate.",
        invariant:
          "Targets [1, 3], initialization 0, squared-error objective, full-batch gradient, plain-SGD update, and 12-step budget remain fixed.",
        intervention: "Change only the learning rate.",
        control: {
          label: "Learning rate",
          min: 0.01,
          max: 1.2,
          step: 0.01,
          initial: 0.08,
          lowLabel: "small steps",
          highLabel: "divergent oscillation",
        },
      },
      responseActivity(
        "optimizer-instability-explanation",
        "explanation",
        ["learning-rate", "optimization-dynamics"],
        "A replay with the same seed, batches, and initialization becomes oscillatory only after the learning rate is increased. Explain the causal chain, name the nearest competing explanation, and state a result that would falsify the learning-rate diagnosis.",
        "Connect gradient, step scale, crossing the minimum, the held-fixed controls, and a controlled replay.",
        [
          {
            id: "optimizer-step-scale",
            label: "connect learning rate to update magnitude",
            keywordGroups: [
              ["learning rate"],
              ["step", "update"],
              ["larger", "scale", "multiply"],
            ],
          },
          {
            id: "optimizer-oscillation",
            label: "connect large steps to overshoot or oscillation",
            keywordGroups: [["overshoot", "cross the minimum"], ["oscillat", "diverge"]],
          },
          {
            id: "optimizer-competitor",
            label: "name batch order or initialization as a competing cause",
            keywordGroups: [
              ["batch order", "mini-batch", "initialization"],
              ["competing", "alternative", "could also"],
            ],
          },
          {
            id: "optimizer-falsifier",
            label: "state a same-control replay that would falsify the diagnosis",
            keywordGroups: [
              ["replay", "same seed", "held fixed"],
              ["lower learning rate", "small learning rate"],
              ["still oscillates", "does not stabilize", "same oscillation"],
            ],
          },
        ],
        "You isolated the update-scale mechanism and made the diagnosis testable.",
        "Use the SGD equation, then separate the changed rate from batch and initialization alternatives.",
      ),
      responseActivity(
        "optimizer-sensor-transfer",
        "transfer",
        ["mini-batch", "momentum", "optimization-dynamics"],
        "A factory estimates sensor bias from a different small sample each minute and smooths updates with a running velocity. Map mini-batch noise and momentum to this estimator. Explain why a stale velocity can overshoot after the true bias changes sign.",
        "Name the sampled evidence, the noisy estimate, the carried state, and the sign change.",
        [
          {
            id: "sensor-batch-map",
            label: "map each minute's sample to a mini-batch",
            keywordGroups: [["sample", "readings"], ["minute", "mini-batch", "subset"]],
          },
          {
            id: "sensor-noisy-gradient",
            label: "map sample variation to a noisy update estimate",
            keywordGroups: [["noise", "variation"], ["estimate", "gradient", "update"]],
          },
          {
            id: "sensor-velocity",
            label: "identify velocity as accumulated past updates",
            keywordGroups: [
              ["velocity", "momentum"],
              ["past", "history", "accumulate", "running"],
            ],
          },
          {
            id: "sensor-overshoot",
            label: "explain overshoot after the sign change",
            keywordGroups: [
              ["sign", "direction"],
              ["changes", "reverses"],
              ["overshoot", "keeps moving", "stale"],
            ],
          },
        ],
        "You transferred both stochastic evidence and optimizer state to a different iterative system.",
        "Treat each minute's sample as the batch and the running velocity as memory from earlier updates.",
      ),
      pythonLab(
        "optimizer-python-lab",
        ["mini-batch", "learning-rate", "momentum", "adam"],
        "optimizer_trace.py",
        "Predict each update from the printed gradient before running. Inspect the working SGD and momentum trace, including optimizer state, weights, and losses. Then complete the missing Adam parameter update from its supplied bias-corrected moments and run the exact checks across multiple gradient signs.",
        `import numpy as np


def example_gradient(weight, target):
    return 2.0 * (weight - target)


def initialize_pair(seed, scale):
    first = (((seed * 17 + 11) % 100) / 100.0 * 2.0 - 1.0) * scale
    second = (((seed * 29 + 7) % 100) / 100.0 * 2.0 - 1.0) * scale
    return first, second


def batch_gradient(weight, targets):
    gradients = np.asarray(
        [example_gradient(weight, target) for target in targets],
        dtype=float,
    )
    return float(np.mean(gradients))


def sgd_step(weight, gradient, learning_rate):
    return weight - learning_rate * gradient


def momentum_step(weight, velocity, gradient, learning_rate, beta):
    next_velocity = beta * velocity + gradient
    next_weight = weight - learning_rate * next_velocity
    return next_weight, next_velocity


def adam_step(weight, first, second, gradient, step, learning_rate,
              beta1=0.9, beta2=0.999, epsilon=1e-8):
    next_first = beta1 * first + (1.0 - beta1) * gradient
    next_second = beta2 * second + (1.0 - beta2) * gradient * gradient
    corrected_first = next_first / (1.0 - beta1 ** step)
    corrected_second = next_second / (1.0 - beta2 ** step)
    # Modify: apply the bias-corrected Adam parameter update.
    next_weight = None
    return next_weight, next_first, next_second


def batch_loss(weight, targets):
    targets_array = np.asarray(targets, dtype=float)
    return float(np.mean((weight - targets_array) ** 2))


def reference_trace(targets=(1.0, 3.0), steps=4, learning_rate=0.1, beta=0.5):
    sgd_weight = 0.0
    momentum_weight = 0.0
    velocity = 0.0
    rows = []
    print("step | sgd_grad sgd_w | momentum_grad velocity momentum_w | losses")
    for step in range(1, steps + 1):
        sgd_gradient = batch_gradient(sgd_weight, targets)
        momentum_gradient = batch_gradient(momentum_weight, targets)
        sgd_weight = sgd_step(sgd_weight, sgd_gradient, learning_rate)
        momentum_weight, velocity = momentum_step(
            momentum_weight,
            velocity,
            momentum_gradient,
            learning_rate,
            beta,
        )
        row = {
            "step": step,
            "sgd_gradient": sgd_gradient,
            "sgd_weight": sgd_weight,
            "momentum_gradient": momentum_gradient,
            "velocity": velocity,
            "momentum_weight": momentum_weight,
            "sgd_loss": batch_loss(sgd_weight, targets),
            "momentum_loss": batch_loss(momentum_weight, targets),
        }
        rows.append(row)
        print(
            f"{step:>4} | {sgd_gradient:>8.4f} {sgd_weight:>5.3f} | "
            f"{momentum_gradient:>13.4f} {velocity:>8.4f} "
            f"{momentum_weight:>10.4f} | "
            f"{row['sgd_loss']:.5f} {row['momentum_loss']:.5f}"
        )
    return rows


def adam_trace(targets=(1.0, 3.0), steps=4, learning_rate=0.1):
    weight = 0.0
    first = 0.0
    second = 0.0
    rows = []
    for step in range(1, steps + 1):
        gradient = batch_gradient(weight, targets)
        weight, first, second = adam_step(
            weight,
            first,
            second,
            gradient,
            step,
            learning_rate,
        )
        rows.append((step, gradient, first, second, weight, batch_loss(weight, targets)))
    return rows


REFERENCE_TRACE = reference_trace()
`,
        [
          {
            id: "optimizer-initialization",
            label: "Deterministic initialization breaks symmetry at bounded scale",
            expression:
              "(lambda pair: pair[0] != pair[1] and max(abs(pair[0]), abs(pair[1])) <= 0.1)(initialize_pair(3, 0.1))",
            expected: true,
            conceptIds: ["initialization"],
          },
          {
            id: "optimizer-batch-average",
            label: "Mini-batch gradients are correct across signed states",
            expression:
              "str([batch_gradient(weight, targets) for weight, targets in [(0.0, [1.0, 3.0]), (2.0, [-1.0, 1.0]), (-1.0, [-2.0, 4.0])]])",
            expected: "[-4.0, 4.0, -4.0]",
            conceptIds: ["mini-batch"],
          },
          {
            id: "optimizer-sgd-step",
            label: "SGD scales the gradient by learning rate",
            expression: "sgd_step(4.0, 2.0, 0.1)",
            expected: 3.8,
            conceptIds: ["learning-rate"],
          },
          {
            id: "optimizer-momentum-state",
            label: "Momentum carries velocity into the next step",
            expression: "str(momentum_step(4.0, 1.0, 2.0, 0.1, 0.5))",
            expected: "(3.75, 2.5)",
            conceptIds: ["momentum"],
          },
          {
            id: "optimizer-reference-trace",
            label: "Reference rows expose gradient, state, weight, and loss",
            expression:
              "len(REFERENCE_TRACE) == 4 and REFERENCE_TRACE[0]['sgd_gradient'] == -4.0 and REFERENCE_TRACE[0]['velocity'] == -4.0 and REFERENCE_TRACE[-1]['sgd_loss'] < REFERENCE_TRACE[0]['sgd_loss'] and REFERENCE_TRACE[-1]['momentum_loss'] < REFERENCE_TRACE[0]['momentum_loss']",
            expected: true,
            conceptIds: ["learning-rate", "momentum"],
          },
          {
            id: "optimizer-adam-first-step",
            label: "Completed Adam update preserves both state moments",
            expression:
              "(lambda result: abs(result[0] - 3.9) < 1e-8 and abs(result[1] - 0.2) < 1e-12 and abs(result[2] - 0.004) < 1e-12)(adam_step(4.0, 0.0, 0.0, 2.0, 1, 0.1))",
            expected: true,
            conceptIds: ["adam"],
          },
          {
            id: "optimizer-adam-signed-updates",
            label: "Adam moves opposite positive and negative gradients",
            expression:
              "adam_step(4.0, 0.0, 0.0, 2.0, 1, 0.1)[0] < 4.0 and adam_step(4.0, 0.0, 0.0, -2.0, 1, 0.1)[0] > 4.0",
            expected: true,
            conceptIds: ["adam"],
          },
          {
            id: "optimizer-adam-stateful-second-step",
            label: "A changed gradient uses carried, bias-corrected Adam moments",
            expression:
              "(lambda first_step: (lambda second_step: str((round(second_step[0], 6), round(second_step[1], 6), round(second_step[2], 6))))(adam_step(first_step[0], first_step[1], first_step[2], -1.0, 2, 0.1)))(adam_step(4.0, 0.0, 0.0, 2.0, 1, 0.1))",
            expected: "(3.873366, 0.08, 0.004996)",
            conceptIds: ["adam"],
          },
          {
            id: "optimizer-adam-trace-loss",
            label: "The completed Adam trace carries state while loss falls",
            expression:
              "(lambda rows: len(rows) == 4 and rows[-1][2] != 0.0 and rows[-1][3] > 0.0 and rows[-1][5] < rows[0][5])(adam_trace())",
            expected: true,
            conceptIds: ["adam", "optimization-dynamics"],
          },
        ],
        1501,
        ["numpy"],
      ),
    ],
    resources: [
      interactive(
        "optimizer-grokking",
        "Grokking",
        "Google PAIR",
        "https://pair.withgoogle.com/explorables/grokking/",
        12,
        "optimizer-python-lab",
        "Inspect only after ordinary traces are understood. Treat the phase transition as an exceptional case, not a normal guarantee.",
        "S47",
      ),
      reading(
        "optimizer-pytorch-parameters",
        "Optimizing Model Parameters",
        "PyTorch",
        "https://docs.pytorch.org/tutorials/beginner/basics/optimization_tutorial.html",
        10,
        "optimizer-python-lab",
        "Read after the NumPy batch and optimizer-state checks; compare the framework loop without hiding the gradient, step size, or carried state.",
        "S86",
      ),
    ],
  },
  {
    id: "cluster-project",
    number: "16",
    moduleId: "representation",
    phase: "model",
    published: true,
    title: "Three objectives, three geometries",
    question: "What does a representation preserve, and why?",
    summary:
      "Contrast k-means clustering, PCA projection, and embeddings learned for a predictive objective.",
    durationMinutes: 60,
    revision: lessonRevision("cluster-project"),
    sourceIds: ["S52", "S87", "S13"],
    mechanism: {
      input: "Vectors plus a clustering, reconstruction, or predictive objective",
      process:
        "Optimize assignments and centroids, projection directions, or learned coordinates for that objective",
      output: "A geometry whose distances and directions reflect the chosen objective",
    },
    starterQuestions: [
      "Why can scaling change a k-means result?",
      "What information does PCA discard?",
      "When does embedding proximity support a semantic claim?",
    ],
    prerequisiteConceptIds: [
      "feature-scaling",
      "optimization-dynamics",
      "hidden-representation",
    ],
    outcomes: [
      {
        id: "cluster-objective-explanation",
        conceptId: "pca",
        text: "Discriminate clustering, reconstruction, and predictive objectives.",
        requiredEvidenceKinds: ["explanation"],
      },
      {
        id: "cluster-transfer-objective",
        conceptId: "embedding-objective",
        text: "Choose and defend an objective in a surface-different representation task.",
        requiredEvidenceKinds: ["transfer"],
      },
      {
        id: "cluster-code-step",
        conceptId: "k-means",
        text: "Execute one k-means step and one projection-reconstruction check.",
        requiredEvidenceKinds: ["code-check"],
      },
    ],
    teaching: {
      title: "Ask which objective created the geometry",
      introduction: [
        "A vector is an ordered list of numerical coordinates. A representation is the choice of coordinates used to describe an example, and geometry means the distances and directions among represented examples. Proximity has meaning only after you identify the objective and measurements that produced it.",
        "K-means, principal component analysis, and learned embeddings create geometry for different reasons. K-means alternates between assigning each point to its nearest centroid and replacing each centroid with the mean of its assigned points. Principal component analysis, or PCA, first centers each feature by subtracting its mean, then finds linear directions that retain as much variance as possible. A learned embedding places examples in coordinates adjusted by a training loss for a predictive or self-supervised task.",
        "Their boundaries matter. K-means uses distances, so feature scale, initial centroids, and outliers can change its result. PCA preserves high-variance linear structure, not labels or every detail; fewer dimensions create reconstruction error. Embedding distances inherit the examples, loss, architecture, and optimization. A two-dimensional display can distort a high-dimensional embedding, so a visible neighborhood is not a universal semantic fact.",
      ],
      vocabulary: [
        {
          term: "Representation",
          definition:
            "An ordered set of coordinates used to describe one example for a particular purpose.",
        },
        {
          term: "Centroid",
          definition:
            "The coordinate-wise arithmetic mean of all points currently assigned to one k-means cluster.",
        },
        {
          term: "Squared distance",
          definition:
            "The sum of squared coordinate differences between two points, used by standard k-means.",
        },
        {
          term: "Principal component",
          definition:
            "A unit direction chosen by PCA to retain as much remaining projected variance as possible.",
        },
        {
          term: "Projection",
          definition:
            "The coordinates obtained by expressing a centered point along selected directions.",
        },
        {
          term: "Embedding objective",
          definition:
            "The training loss whose signal determines which relationships a learned coordinate space tends to preserve.",
        },
      ],
      workedExample: {
        title: "Keep the points visible while three objectives treat them differently",
        setup:
          "Use four two-dimensional points: A = (0, -1), B = (2, 1), C = (8, 1), and D = (10, -1). Start k-means with centroid c1 = A and centroid c2 = D, and use squared Euclidean distance.",
        steps: [
          {
            label: "Compute the assignment state",
            explanation:
              "A has squared distances 0 to c1 and 100 to c2. B has 8 to c1 and 68 to c2, so A and B join cluster 1. C has 68 to c1 and 8 to c2, while D has 100 and 0, so C and D join cluster 2.",
          },
          {
            label: "Relocate both centroids",
            explanation:
              "The mean of A and B is c1 = ((0 + 2)/2, (-1 + 1)/2) = (1, 0). The mean of C and D is c2 = ((8 + 10)/2, (1 - 1)/2) = (9, 0). Assignments and centroids are separate intermediate states.",
          },
          {
            label: "Hold assignments fixed and move one point",
            explanation:
              "Move B from (2, 1) to (6, 1) without reassigning it. The first centroid becomes ((0 + 6)/2, (-1 + 1)/2) = (3, 0). Its horizontal coordinate moves right from 1 to 3 because a centroid is a mean.",
          },
          {
            label: "Center the original points for PCA",
            explanation:
              "Before the move, the feature mean is (5, 0). The centered points are (-5, -1), (-3, 1), (3, 1), and (5, -1). Horizontal variation is much larger than vertical variation, so the first principal direction is the horizontal axis.",
          },
          {
            label: "Project and reconstruct",
            explanation:
              "Keeping one principal component retains horizontal coordinates -5, -3, 3, and 5. Reconstructing adds the mean back and sets the discarded vertical coordinate to 0, so each point loses its original vertical value of -1 or 1.",
          },
          {
            label: "Change the objective, not the arithmetic",
            explanation:
              "An embedding trained to predict left-versus-right shelf membership may place A near B and C near D. One trained to predict top-versus-bottom position may instead place B near C. The task signal, not k-means or PCA, defines that learned proximity.",
          },
        ],
        takeaway:
          "Expose assignments, means, centered coordinates, projections, reconstructions, and training objectives separately; the same examples can support different valid geometries.",
      },
      misconceptions: [
        {
          misconception: "A cluster is a discovered class label.",
          correction:
            "K-means creates assignments that reduce within-cluster squared distance. It does not read labels or prove that a cluster is a real-world category.",
        },
        {
          misconception: "PCA keeps the most predictive information.",
          correction:
            "PCA keeps high-variance linear directions without using the prediction target. A low-variance feature can still be important for prediction.",
        },
        {
          misconception: "Nearby embedding points must have the same meaning.",
          correction:
            "Closeness reflects a particular training signal and data distribution. Interpretation requires checking the objective, original space, examples, and stability.",
        },
      ],
      summary: [
        "For k-means, hold assignments fixed before recomputing each centroid as the mean of its members.",
        "For PCA, distinguish centered input, retained projection, discarded coordinates, and reconstructed output.",
        "If one assigned point moves far right, its cluster mean must move right; no class label is created.",
      ],
      sourceIds: ["S52", "S87", "S13"],
    },
    blocks: [
      {
        id: "cluster-objectives-first",
        kind: "opening",
        heading: "Geometry follows an objective",
        sourceIds: ["S13", "S52", "S87"],
        body: [
          "A plot can show points near one another without saying why proximity matters. K-means, PCA, and learned embeddings each produce geometry under a different success criterion.",
          "The same rows can therefore produce different neighborhoods without any algorithm being internally inconsistent.",
        ],
        conceptIds: ["k-means", "pca", "embedding-objective"],
        tags: ["geometry", "objective", "distance", "representation"],
      },
      {
        id: "cluster-kmeans",
        kind: "worked-example",
        heading: "K-means alternates assignment and relocation",
        sourceIds: ["S52"],
        body: [
          "Given centroids, assign each point to its nearest centroid under squared distance. Given assignments, replace each centroid with the mean of its assigned points.",
          "Each step does not increase within-cluster squared distance, but different initial centroids can end at different local solutions. Feature scale and outliers can dominate Euclidean distance.",
        ],
        conceptIds: ["k-means"],
        tags: ["centroid", "assignment", "squared distance", "local minimum"],
      },
      {
        id: "cluster-pca",
        kind: "definition",
        heading: "PCA preserves variance through linear projection",
        sourceIds: ["S13"],
        body: [
          "After centering, the first principal direction is the unit direction with greatest projected variance. Keeping only a few directions gives the best linear reconstruction under squared error for that dimensionality.",
          "PCA does not use class labels and does not promise that the most variable direction is the most predictive one.",
        ],
        conceptIds: ["pca"],
        tags: ["projection", "variance", "centering", "reconstruction"],
      },
      {
        id: "cluster-embeddings",
        kind: "reading",
        heading: "Learned embeddings inherit their training signal",
        sourceIds: ["S87"],
        body: [
          "An embedding is a learned coordinate vector. Which items become close depends on the loss, positive and negative examples, architecture, and data used to train those coordinates.",
          "A two-dimensional projection of an embedding can distort original distances. Stable neighborhoods should be checked in the original space and across seeds before they support a claim.",
        ],
        conceptIds: ["embedding-objective"],
        tags: ["embedding", "training signal", "projection distortion", "seed"],
      },
      {
        id: "cluster-discriminate",
        kind: "checkpoint",
        heading: "Name what is optimized before interpreting the picture",
        sourceIds: ["S13", "S52", "S87"],
        body: [
          "K-means minimizes within-cluster distance, PCA minimizes linear reconstruction error when dimensions are dropped, and a learned embedding minimizes its authored training loss. None of these objectives automatically discovers a unique true grouping.",
        ],
        conceptIds: ["k-means", "pca", "embedding-objective"],
        tags: ["discrimination", "interpretation", "assumption"],
      },
    ],
    activities: [
      {
        id: "cluster-outlier-prediction",
        kind: "prediction",
        conceptIds: ["k-means"],
        evidenceKind: "prediction",
        renderer: "choice",
        checkpoint: {
          id: "cluster-outlier-prediction",
          prompt:
            "One fixed cluster has vertical coordinates 1, 4, and 7. Without changing assignments, the last point moves from 7 to 10. What is the centroid's new vertical coordinate?",
          options: [
            { id: "five", label: "5" },
            { id: "four", label: "4, the old centroid" },
            { id: "ten", label: "10, the moved point" },
            { id: "three", label: "3, the number of points" },
          ],
          correctOptionId: "five",
          supportedExplanation:
            "Correct. With assignments fixed, the new centroid coordinate is the mean: (1 + 4 + 10) / 3 = 5.",
          revisitExplanation:
            "Keep exactly the same three members, replace 7 with 10, add their vertical coordinates, and divide by three.",
        },
      },
      {
        id: "cluster-project-lab",
        kind: "visual-lab",
        labId: "cluster-project",
        conceptIds: ["k-means", "pca"],
        evidenceKind: "manipulation",
        title: "Stress one coordinate without changing the points",
        prompt:
          "Predict the centroid and principal-direction change, then rescale one feature while preserving every row and initialization.",
        invariant:
          "Rows, initialization, number of clusters, and algorithm steps remain fixed.",
        intervention: "Change only the scale applied to one coordinate.",
        control: {
          label: "Second-coordinate scale",
          min: 0.25,
          max: 4,
          step: 0.25,
          initial: 1,
          lowLabel: "compressed",
          highLabel: "dominant",
        },
      },
      responseActivity(
        "cluster-objective-explanation",
        "explanation",
        ["k-means", "pca", "embedding-objective"],
        "The same dataset shows one split under k-means and another pattern after PCA. Explain why this is not a contradiction, distinguish both objectives from a learned embedding, and name one observation that would challenge your interpretation.",
        "State each objective explicitly and use original-space distances or a replay as the check.",
        [
          {
            id: "cluster-kmeans-objective",
            label: "state the k-means objective",
            keywordGroups: [
              ["k-means", "centroid"],
              ["within-cluster", "nearest"],
              ["distance", "squared distance"],
            ],
          },
          {
            id: "cluster-pca-objective",
            label: "state the PCA objective",
            keywordGroups: [
              ["PCA", "principal"],
              ["variance", "reconstruction"],
              ["projection", "direction"],
            ],
          },
          {
            id: "cluster-embedding-objective",
            label: "tie embedding geometry to its training loss",
            keywordGroups: [
              ["embedding"],
              ["training", "learned"],
              ["loss", "objective", "positive", "negative"],
            ],
          },
          {
            id: "cluster-challenge",
            label: "name an original-space or stability challenge",
            keywordGroups: [
              ["original space", "original distance", "different seed", "rescale"],
              ["changes", "unstable", "does not hold"],
            ],
          },
        ],
        "You separated the three objectives and treated the displayed geometry as testable evidence.",
        "Do not compare pictures first. Write the quantity each method optimizes.",
      ),
      responseActivity(
        "cluster-library-transfer",
        "transfer",
        ["k-means", "pca", "embedding-objective"],
        "A library has books described by topic counts. It needs shelves with compact groups, a two-number catalog preview, and recommendations learned from borrowing pairs. Match k-means, PCA, and a learned embedding to the three jobs and justify each match.",
        "Use compactness, reconstruction, and predictive co-borrowing as three distinct criteria.",
        [
          {
            id: "library-shelves",
            label: "use k-means for compact shelf groups",
            keywordGroups: [["shelf", "group"], ["k-means"], ["centroid", "compact", "distance"]],
          },
          {
            id: "library-preview",
            label: "use PCA for the low-dimensional preview",
            keywordGroups: [["preview", "two-number", "two dimensional"], ["PCA"], ["variance", "reconstruct"]],
          },
          {
            id: "library-recommend",
            label: "use learned embeddings for co-borrowing prediction",
            keywordGroups: [
              ["recommend", "borrowing", "co-borrow"],
              ["embedding"],
              ["learn", "predict", "training objective"],
            ],
          },
          {
            id: "library-no-equivalence",
            label: "state that the resulting neighborhoods need not match",
            keywordGroups: [
              ["different", "need not", "not necessarily"],
              ["objective", "criterion", "loss"],
            ],
          },
        ],
        "You matched each representation to the job its objective actually supports.",
        "Assign one method to compact groups, one to linear reconstruction, and one to co-borrowing prediction.",
      ),
      {
        ...pythonLab(
        "cluster-python-lab",
        ["k-means", "pca", "embedding-objective"],
        "geometry_objectives.py",
        "PRIMM: Predict the assignments and new centroids before running. Run the working distance and projection code, investigate the reconstruction error, then complete nearest-centroid assignment. Modify one point or axis and explain which objective changes.",
        `def squared_distance(left, right):
    return sum((a - b) ** 2 for a, b in zip(left, right))


def assign_points(points, centroids):
    # Modify: return the index of the nearest centroid for every point.
    return None


def recompute_centroids(points, assignments, cluster_count):
    dimensions = len(points[0])
    totals = [[0.0] * dimensions for _ in range(cluster_count)]
    counts = [0] * cluster_count
    for point, cluster in zip(points, assignments):
        counts[cluster] += 1
        for dimension, value in enumerate(point):
            totals[cluster][dimension] += value
    return [
        tuple(value / counts[cluster] for value in totals[cluster])
        for cluster in range(cluster_count)
    ]


def project(point, unit_axis):
    return sum(value * axis_value for value, axis_value in zip(point, unit_axis))


def reconstruct(coordinate, unit_axis):
    return tuple(coordinate * axis_value for axis_value in unit_axis)


def dot(left, right):
    return sum(a * b for a, b in zip(left, right))


POINTS = [(0.0, 0.0), (0.0, 2.0), (8.0, 8.0), (10.0, 8.0)]
START = [(0.0, 0.0), (10.0, 10.0)]
`,
        [
          {
            id: "cluster-assignments",
            label: "Each point is assigned to its nearest centroid",
            expression: "str(assign_points(POINTS, START))",
            expected: "[0, 0, 1, 1]",
            conceptIds: ["k-means"],
          },
          {
            id: "cluster-centroids",
            label: "Centroids become assigned-point means",
            expression:
              "str(recompute_centroids(POINTS, assign_points(POINTS, START), 2))",
            expected: "[(0.0, 1.0), (9.0, 8.0)]",
            conceptIds: ["k-means"],
          },
          {
            id: "cluster-alternate-assignments",
            label: "Nearest-centroid assignment generalizes to a different geometry",
            expression:
              "str(assign_points([(9.0, 0.0), (1.0, 0.0), (6.0, 0.0)], [(0.0, 0.0), (10.0, 0.0)]))",
            expected: "[1, 0, 1]",
            conceptIds: ["k-means"],
          },
          {
            id: "cluster-pca-reconstruction",
            label: "A supplied unit-axis projection exposes perpendicular error",
            expression:
              "squared_distance((3.0, 1.0), reconstruct(project((3.0, 1.0), (1.0, 0.0)), (1.0, 0.0)))",
            expected: 1,
            conceptIds: ["pca"],
          },
          {
            id: "cluster-embedding-similarity",
            label: "A dot product is computed in the supplied coordinates",
            expression: "dot((1.0, 2.0, -1.0), (2.0, 0.5, 1.0))",
            expected: 2,
            conceptIds: ["embedding-objective"],
          },
        ],
        1601,
        ),
        evidenceConceptIds: ["k-means", "pca"],
      },
    ],
    resources: [
      interactive(
        "cluster-kmeans-explorable",
        "K-Means Explorable",
        "Independent interactive artifact",
        "https://k-means-explorable.vercel.app/",
        12,
        "cluster-python-lab",
        "Explore after the local objective comparison. Inspect initialization, scaling, outliers, and local minima without generalizing k-means geometry to every representation.",
        "S52",
      ),
      reading(
        "cluster-google-embeddings",
        "Embeddings: Obtaining embeddings",
        "Google for Developers",
        "https://developers.google.com/machine-learning/crash-course/embeddings/obtaining-embeddings",
        15,
        "cluster-objective-explanation",
        "Read after discriminating clustering, reconstruction, and predictive objectives; connect embedding geometry only to its training signal.",
        "S87",
      ),
    ],
  },
  {
    id: "convolution-field",
    number: "17",
    moduleId: "representation",
    phase: "model",
    published: true,
    title: "Reuse one detector across space",
    question: "What does convolution share, and what can each output see?",
    summary:
      "Compute a tiny convolution, grow its receptive field, and trace the direct gradient path in a residual block.",
    durationMinutes: 60,
    revision: lessonRevision("convolution-field"),
    sourceIds: ["S88", "S89", "S12"],
    mechanism: {
      input: "A spatial grid, a shared local kernel, and an optional residual branch",
      process:
        "Slide the same kernel across locations, compose local layers, and add the identity path to the learned branch",
      output: "Location-indexed features with controlled receptive fields and a direct residual route",
    },
    starterQuestions: [
      "Why is the same kernel applied at every location?",
      "How does depth enlarge a receptive field?",
      "What gradient route remains when a residual branch is flat?",
    ],
    prerequisiteConceptIds: [
      "hidden-representation",
      "backpropagation",
      "nonlinear-composition",
    ],
    outcomes: [
      {
        id: "convolution-explain-sharing",
        conceptId: "weight-sharing",
        text: "Explain how sharing changes parameter count and spatial reuse.",
        requiredEvidenceKinds: ["explanation"],
      },
      {
        id: "convolution-transfer-locality",
        conceptId: "receptive-field",
        text: "Transfer locality and residual-path reasoning to a non-image signal.",
        requiredEvidenceKinds: ["transfer"],
      },
      {
        id: "convolution-code-kernel",
        conceptId: "convolution",
        text: "Compute a two-dimensional convolution and residual derivative in code.",
        requiredEvidenceKinds: ["code-check"],
      },
    ],
    teaching: {
      title: "Trace one shared detector across locations and layers",
      introduction: [
        "An image or time series can be stored as a grid of numbers. A patch is a local window, and a kernel is a small set of learned weights with the same shape. At one output location, convolution multiplies matching patch and kernel entries and adds the products. The result is an activation. Many libraries technically use cross-correlation, but the course follows the standard convention of calling it convolution.",
        "Weight sharing reuses the same kernel at every location. The kernel does not learn again when it moves; only the patch changes. Stride is how far the window moves, while padding adds values around the boundary. With both fixed, moving a pattern usually moves its matching activation. This behavior can fail at boundaries or when later operations discard location.",
        "A receptive field is the set of input positions that can possibly influence one later activation. With stride 1, no dilation, and width-3 kernels, one layer sees three positions, two stacked layers can see five, and three can see seven. A residual block adds an identity route: y = x + F(x), where F is a learned branch. Its derivative is dy/dx = 1 + dF/dx, exposing a direct value and gradient path without guaranteeing that every deep network will train well.",
      ],
      vocabulary: [
        {
          term: "Patch",
          definition:
            "The local group of input values aligned with a kernel at one output location.",
        },
        {
          term: "Kernel",
          definition:
            "A small shared array of weights multiplied with each local patch.",
        },
        {
          term: "Activation",
          definition:
            "The numerical output produced at a location after applying the local weighted calculation.",
        },
        {
          term: "Weight sharing",
          definition:
            "Reusing exactly the same kernel parameters at multiple spatial or temporal locations.",
        },
        {
          term: "Receptive field",
          definition:
            "The input positions that have a computational path to one selected later activation.",
        },
        {
          term: "Residual path",
          definition:
            "A direct identity route that adds an input x to a learned transformation F(x).",
        },
      ],
      workedExample: {
        title: "Slide one kernel, shift the pattern, and preserve the boundaries",
        setup:
          "Use the one-dimensional input [0, 1, 2, 1, 0], kernel [1, 2, 1], stride 1, and valid padding, which means no added boundary values. Each output is the dot product of one width-3 patch and the fixed kernel.",
        steps: [
          {
            label: "List the valid patches",
            explanation:
              "The kernel fits at three locations. The patches are [0, 1, 2], [1, 2, 1], and [2, 1, 0]. Writing them first separates movement of the window from the shared arithmetic.",
          },
          {
            label: "Compute every activation",
            explanation:
              "The outputs are 0*1 + 1*2 + 2*1 = 4, then 1*1 + 2*2 + 1*1 = 6, then 2*1 + 1*2 + 0*1 = 4. The complete output is [4, 6, 4].",
          },
          {
            label: "Move only the input pattern",
            explanation:
              "Shift the pattern one cell right to obtain [0, 0, 1, 2, 1]. Keep the kernel, stride, and padding unchanged. The new patches are [0, 0, 1], [0, 1, 2], and [1, 2, 1].",
          },
          {
            label: "Reuse the same kernel",
            explanation:
              "The new activations are 1, 4, and 6. The strongest match moved from output position 2 to output position 3. No weight update occurred; the matching patch simply appeared one location later.",
          },
          {
            label: "Grow the possible influence",
            explanation:
              "If a second width-3, stride-1 layer reads the first layer, one of its activations can combine three neighboring first-layer activations whose combined input span is five positions. A third such layer expands that span to seven.",
          },
          {
            label: "Expose the residual boundary",
            explanation:
              "For x = 3 and F(x) = -1, the block output is y = 2. If the learned branch is locally flat so dF/dx = 0, then dy/dx = 1 + 0 = 1: the identity route still carries a gradient.",
          },
        ],
        takeaway:
          "Kernel values, input patches, output locations, receptive-field reach, and the residual identity route are distinct states that should never be collapsed into one vague feature story.",
      },
      misconceptions: [
        {
          misconception: "Each location has its own separately learned kernel.",
          correction:
            "Standard convolution shares one kernel across locations. Different patches create different activations while the kernel parameters stay fixed.",
        },
        {
          misconception: "Every point inside a receptive field affects the output equally.",
          correction:
            "A receptive field marks possible computational influence. Actual influence depends on learned weights, nonlinearities, and the current input.",
        },
        {
          misconception: "A residual connection makes deep training automatically stable.",
          correction:
            "It provides a direct route for values and gradients, but optimization can still fail because of data, objectives, scales, or other architecture choices.",
        },
      ],
      summary: [
        "At each location, identify the patch, multiply by the unchanged kernel, and add the products.",
        "Keep stride, padding, and kernel fixed when testing whether a translated pattern produces a translated response.",
        "When the same pattern moves one valid cell right, its matching activation should also move right rather than trigger new learning.",
      ],
      sourceIds: ["S88", "S89", "S12"],
    },
    blocks: [
      {
        id: "convolution-local-rule",
        kind: "opening",
        heading: "One local rule visits every valid location",
        sourceIds: ["S88"],
        body: [
          "A convolution output at one location is the sum of elementwise products between a local input patch and a kernel. Moving one location changes the patch but reuses the same kernel values.",
          "Sharing lets one learned pattern detector operate across space with fewer parameters than a separate detector at every position.",
        ],
        conceptIds: ["convolution", "weight-sharing"],
        tags: ["kernel", "patch", "local", "shared parameter"],
      },
      {
        id: "convolution-manual",
        kind: "worked-example",
        heading: "Compute the patch before naming the feature",
        sourceIds: ["S88"],
        body: [
          "For patch [[1, 2], [0, 1]] and kernel [[1, 0], [0, -1]], the output is 1 * 1 + 2 * 0 + 0 * 0 + 1 * -1 = 0.",
          "The arithmetic is known. Calling the result an edge, texture, or object part requires evidence from learned behavior and interventions; the activation alone does not supply that meaning.",
        ],
        conceptIds: ["convolution"],
        tags: ["manual trace", "activation", "interpretation"],
      },
      {
        id: "convolution-receptive-field",
        kind: "definition",
        heading: "Receptive field tracks possible influence",
        sourceIds: ["S12", "S88"],
        body: [
          "With stride 1 and no dilation, each additional width-3 convolution expands the receptive field by two positions. Three such layers give a width-7 receptive field.",
          "Receptive field says which inputs can influence an output through the graph. It does not say every input has equal actual influence.",
        ],
        conceptIds: ["receptive-field", "convolution"],
        tags: ["depth", "stride", "dilation", "possible influence"],
      },
      {
        id: "convolution-residual",
        kind: "worked-example",
        heading: "A residual block preserves a direct route",
        sourceIds: ["S89"],
        body: [
          "A residual block computes y = x + F(x). Its derivative is dy/dx = 1 + dF/dx, so the identity term provides a direct route for values and gradients.",
          "Residual paths ease optimization; they do not make every deep model stable or force the learned branch to be small.",
        ],
        conceptIds: ["residual-path", "backpropagation"],
        tags: ["identity", "skip connection", "gradient path"],
      },
      {
        id: "convolution-controls",
        kind: "checkpoint",
        heading: "Separate kernel, location, and architecture",
        sourceIds: ["S88", "S89"],
        body: [
          "To test spatial reuse, hold the kernel fixed and move the same pattern. To test receptive field, hold weights fixed and perturb an input at a known distance. To test the residual route, compare the same branch with and without the identity addition.",
        ],
        conceptIds: ["weight-sharing", "receptive-field", "residual-path"],
        tags: ["intervention", "control", "ablation"],
      },
    ],
    activities: [
      {
        id: "convolution-shift-prediction",
        kind: "prediction",
        conceptIds: ["convolution", "weight-sharing"],
        evidenceKind: "prediction",
        renderer: "choice",
        checkpoint: {
          id: "convolution-shift-prediction",
          prompt:
            "In a one-dimensional audio signal with stride 1, the same click pattern moves two samples left. The shared kernel and padding are unchanged, and both positions stay inside the valid region. What should happen?",
          options: [
            { id: "move", label: "The matching activation moves two positions left" },
            { id: "vanish", label: "All activations become zero" },
            { id: "weights", label: "A new kernel is learned immediately" },
            { id: "same-cell", label: "The activation must stay in the old cell" },
          ],
          correctOptionId: "move",
          supportedExplanation:
            "Correct. Reusing the same detector at every valid location makes the corresponding response follow the click two positions left.",
          revisitExplanation:
            "Keep kernel, stride, and padding fixed, then locate the new patch containing the unchanged click pattern.",
        },
      },
      {
        id: "convolution-field-lab",
        kind: "visual-lab",
        labId: "convolution-field",
        conceptIds: ["convolution", "weight-sharing", "receptive-field"],
        evidenceKind: "manipulation",
        title: "Move one pattern under a fixed kernel",
        prompt:
          "Predict the output location, then translate only the input pattern while preserving kernel values, padding, and stride.",
        invariant: "Kernel values, stride, padding, and input pattern remain fixed.",
        intervention: "Translate the pattern across the input grid.",
        control: {
          label: "Pattern position",
          min: 0,
          max: 4,
          step: 1,
          initial: 1,
          lowLabel: "left",
          highLabel: "right",
        },
      },
      responseActivity(
        "convolution-sharing-explanation",
        "explanation",
        ["convolution", "weight-sharing", "receptive-field"],
        "Explain why a translated pattern moves a convolution response instead of requiring a new detector. Include the nearest misconception about receptive fields and a perturbation that would falsify spatial reuse.",
        "Connect local patches, the same kernel, output location, possible influence, and a controlled shift.",
        [
          {
            id: "convolution-local-patch",
            label: "identify the changed local patch",
            keywordGroups: [["patch", "local region"], ["moves", "translated", "shifted"]],
          },
          {
            id: "convolution-same-kernel",
            label: "state that the same kernel is reused",
            keywordGroups: [["same", "shared", "reuse"], ["kernel", "weights", "detector"]],
          },
          {
            id: "convolution-field-boundary",
            label: "distinguish possible receptive-field influence from equal influence",
            keywordGroups: [
              ["receptive field"],
              ["can influence", "possible influence"],
              ["not equal", "not every", "does not mean"],
            ],
          },
          {
            id: "convolution-falsifier",
            label: "state a fixed-kernel translation test",
            keywordGroups: [
              ["hold", "fixed", "same kernel"],
              ["translate", "shift", "move"],
              ["response does not move", "different response", "fails"],
            ],
          },
        ],
        "You connected weight sharing to the translated response and bounded the receptive-field claim.",
        "Follow the same kernel from one input patch to the next, then separate possible from actual influence.",
      ),
      responseActivity(
        "convolution-audio-transfer",
        "transfer",
        ["convolution", "receptive-field", "residual-path"],
        "An audio model scans a waveform for a short click pattern. Explain how convolution detects the click at different times, how stacked layers enlarge temporal context, and how y = x + F(x) preserves a direct signal and gradient route.",
        "Map image position to time, spatial patch to waveform window, and the skip connection to the unchanged waveform path.",
        [
          {
            id: "audio-shared-click",
            label: "reuse one kernel across time",
            keywordGroups: [
              ["click", "pattern"],
              ["same", "shared"],
              ["kernel", "filter"],
              ["time", "window"],
            ],
          },
          {
            id: "audio-temporal-field",
            label: "connect stacked layers to wider temporal context",
            keywordGroups: [
              ["stack", "deeper", "layers"],
              ["receptive field", "context"],
              ["wider", "longer", "more time"],
            ],
          },
          {
            id: "audio-residual-value",
            label: "identify the direct signal path",
            keywordGroups: [["x + F(x)", "residual", "skip"], ["direct", "identity"], ["signal", "waveform"]],
          },
          {
            id: "audio-residual-gradient",
            label: "identify the direct gradient term",
            keywordGroups: [["gradient", "derivative"], ["1", "identity", "direct route"]],
          },
        ],
        "You transferred locality, field growth, and the residual route from space to time.",
        "Replace the image patch with a waveform window and preserve the same three mechanisms.",
      ),
      pythonLab(
        "convolution-python-lab",
        ["convolution", "weight-sharing", "receptive-field", "residual-path"],
        "convolution_trace.py",
        "PRIMM: Predict the four output cells before running. Run the receptive-field and residual specimens, investigate their arithmetic, then complete the shared-kernel accumulation. The check also applies your function to a different rectangular image so the operation, not one memorized grid, must transfer. Modify one image cell and identify exactly which outputs can change.",
        `# This is the unflipped cross-correlation convention that deep-learning
# libraries commonly call convolution.
def conv2d_valid(image, kernel):
    output_height = len(image) - len(kernel) + 1
    output_width = len(image[0]) - len(kernel[0]) + 1
    output = []
    for row in range(output_height):
        output_row = []
        for column in range(output_width):
            # Modify: accumulate patch values times the same kernel values.
            value = None
            output_row.append(value)
        output.append(output_row)
    return output


def receptive_field_width(kernel_width, layer_count):
    return 1 + layer_count * (kernel_width - 1)


def residual_forward(value, branch_value):
    return value + branch_value


def residual_backward(upstream_gradient, branch_derivative):
    return upstream_gradient * (1.0 + branch_derivative)


IMAGE = [
    [1.0, 2.0, 0.0],
    [0.0, 1.0, 3.0],
    [2.0, 1.0, 0.0],
]
KERNEL = [
    [1.0, 0.0],
    [0.0, -1.0],
]
`,
        [
          {
            id: "convolution-manual-output",
            label:
              "The shared accumulation transfers to a second image and kernel",
            expression:
              "str((conv2d_valid(IMAGE, KERNEL), conv2d_valid([[1.0, 2.0, 3.0], [4.0, 5.0, 6.0]], [[0.0, 1.0], [1.0, 0.0]])))",
            expected:
              "([[0.0, -1.0], [-1.0, 1.0]], [[6.0, 8.0]])",
            conceptIds: ["convolution", "weight-sharing"],
          },
          {
            id: "convolution-field-width",
            label: "Three width-three layers see seven input positions",
            expression: "receptive_field_width(3, 3)",
            expected: 7,
            conceptIds: ["receptive-field"],
          },
          {
            id: "convolution-residual-value",
            label: "Residual forward path adds identity and branch",
            expression: "residual_forward(3.0, -0.5)",
            expected: 2.5,
            conceptIds: ["residual-path"],
          },
          {
            id: "convolution-residual-gradient",
            label: "A flat branch leaves the direct gradient route",
            expression: "residual_backward(2.0, 0.0)",
            expected: 2,
            conceptIds: ["residual-path", "backpropagation"],
          },
        ],
        1701,
      ),
    ],
    resources: [
      interactive(
        "convolution-cnn-explainer",
        "CNN Explainer",
        "Georgia Tech and Oregon State University",
        "https://poloclub.github.io/cnn-explainer/",
        15,
        "convolution-field-lab",
        "Explore after the controlled local convolution; change one visible element at a time and keep kernel sharing distinct from receptive-field growth.",
        "S88",
      ),
      video(
        "convolution-resnet-video",
        "C4W2L04 Why ResNets Work",
        "DeepLearningAI",
        "https://www.youtube.com/watch?v=RYth6EbBUqM",
        10,
        "convolution-audio-transfer",
        "After transferring the mechanism to audio, watch the 9:12 residual-path explanation and map its identity route back to the local arithmetic.",
        "S89",
      ),
    ],
  },
  {
    id: "attention-routing",
    number: "18",
    moduleId: "representation",
    phase: "model",
    published: true,
    title: "Route information with attention",
    question: "Where did this token's new information come from?",
    summary:
      "Compute a tiny query-key-softmax-value pass while separating inference, training, and causal explanation.",
    durationMinutes: 60,
    revision: lessonRevision("attention-routing"),
    sourceIds: ["S90", "S91", "S97", "S103", "S12"],
    mechanism: {
      input:
        "Position-aware token representations transformed into queries, keys, and values",
      process:
        "Score query-key compatibility, normalize allowed scores, and mix value vectors with those weights",
      output: "A context-dependent representation for each query position",
    },
    starterQuestions: [
      "Why are keys used for weights but values used for the output?",
      "How is token position represented separately from a causal mask?",
      "Why are attention weights not a complete explanation?",
    ],
    prerequisiteConceptIds: [
      "convolution",
      "embedding-objective",
      "backpropagation",
    ],
    outcomes: [
      {
        id: "attention-explain-routing",
        conceptId: "qkv",
        text: "Explain the query-key-softmax-value route for one output.",
        requiredEvidenceKinds: ["explanation"],
      },
      {
        id: "attention-transfer-routing",
        conceptId: "attention",
        text: "Transfer weighted routing and its interpretation boundary to another domain.",
        requiredEvidenceKinds: ["transfer"],
      },
      {
        id: "attention-code-pass",
        conceptId: "attention",
        text: "Complete the value-weighted sum and verify the supplied softmax and causal mask.",
        requiredEvidenceKinds: ["code-check"],
      },
    ],
    teaching: {
      title: "Separate matching, routing, and interpretation in attention",
      introduction: [
        "Self-attention builds each token representation by routing information from allowed positions. For one receiving position, a query vector q describes what it is matching. Each source has a key vector k for matching and a value vector v containing information to route. A vector is an ordered list of numbers. These vectors come from learned projections, but their weights are fixed during this inference pass.",
        "The mechanism has visible intermediate states. First, a query-key dot product multiplies corresponding coordinates and adds them to form a compatibility score. Scaled dot-product attention divides that score by the square root of d_k, where d_k is the number of key coordinates. A causal mask then removes forbidden future positions. Softmax exponentiates the remaining scores and divides by their sum, producing nonnegative attention weights that add to 1. Finally, those weights multiply value vectors, which are added to form the routed output.",
        "Several boundaries prevent overclaiming. Keys determine routing weights; values supply content. A causal mask controls available positions but does not encode their full order. This forward pass changes representations, not parameters; training also requires a loss, backpropagation, and optimizer steps. An attention weight is routing, not proof that one token caused a final prediction. Causal claims require intervention and measured output change.",
      ],
      vocabulary: [
        {
          term: "Query",
          definition:
            "A vector q from the receiving position that is compared with candidate keys.",
        },
        {
          term: "Key",
          definition:
            "A vector k from a candidate source position that helps determine its routing weight.",
        },
        {
          term: "Value",
          definition:
            "A vector v containing the source information that is multiplied by an attention weight.",
        },
        {
          term: "Scaled dot-product score",
          definition:
            "A query-key dot product divided by the square root of the key dimension d_k.",
        },
        {
          term: "Softmax",
          definition:
            "A normalization that converts allowed finite scores into positive weights summing to 1.",
        },
        {
          term: "Causal mask",
          definition:
            "An information boundary that gives unavailable future positions zero weight before left-to-right prediction.",
        },
      ],
      workedExample: {
        title: "Route two values from equal scores while excluding the future",
        setup:
          "For one receiving token, use q = [1, 0]. Two allowed source positions have k1 = [1, 0], k2 = [1, 0], v1 = [2, 0], and v2 = [0, 4]. A third future position has a high raw match but is blocked by a causal mask. The key dimension d_k is 2.",
        steps: [
          {
            label: "Freeze the inference state",
            explanation:
              "Treat q, all keys, all values, and the projection parameters that produced them as fixed. Computing attention from these vectors is a forward pass; no gradient or optimizer update appears in this state.",
          },
          {
            label: "Compute the allowed raw matches",
            explanation:
              "The dot products are q dot k1 = 1*1 + 0*0 = 1 and q dot k2 = 1*1 + 0*0 = 1. Equal keys relative to this query produce equal raw scores.",
          },
          {
            label: "Scale and apply the mask",
            explanation:
              "Dividing by sqrt(2) gives two allowed scores of approximately 0.707. The future position's score is replaced by negative infinity before softmax, regardless of how large its unmasked match was.",
          },
          {
            label: "Normalize the allowed scores",
            explanation:
              "Both allowed exponentials are exp(0.707). Each is divided by their sum, 2*exp(0.707), so the weights are 0.5 and 0.5. The masked future position receives weight 0.",
          },
          {
            label: "Mix values, not keys",
            explanation:
              "The output is 0.5*v1 + 0.5*v2 = 0.5*[2, 0] + 0.5*[0, 4] = [1, 2]. Keys affected the weights; the two value vectors supplied the output coordinates.",
          },
          {
            label: "Stop at the interpretation boundary",
            explanation:
              "The vector [1, 2] is one attention output that later residual, normalization, and feed-forward operations can transform. The equal weights describe this route only; they do not prove equal causal importance to a final model decision.",
          },
        ],
        takeaway:
          "A trustworthy attention trace shows fixed projections, query-key scores, masking, softmax denominators, value-weighted sums, and where the inference and explanation claims stop.",
      },
      misconceptions: [
        {
          misconception: "The output is a weighted sum of keys.",
          correction:
            "Keys participate in score calculation. The normalized weights multiply values, and those weighted values are summed into the output.",
        },
        {
          misconception: "Running attention teaches the model which token matters.",
          correction:
            "Inference uses already learned parameters. Learning requires a loss, backward derivatives, and optimizer updates across training examples.",
        },
        {
          misconception: "The largest attention weight is the model's explanation.",
          correction:
            "It is a routing value inside one component. A causal interpretation needs a controlled change to that route and evidence about the resulting output.",
        },
      ],
      summary: [
        "Compute query-key compatibility only for allowed positions, then apply scaling and masking before normalization.",
        "Softmax gives equal weights to equal finite scores because their exponentials and denominator contributions are equal.",
        "With exactly two allowed equal scores, the next prediction should use weights 0.5 and 0.5, without implying training or causal proof.",
      ],
      sourceIds: ["S90", "S91", "S97", "S103", "S12"],
    },
    blocks: [
      {
        id: "attention-inference-scope",
        kind: "opening",
        heading: "This lesson traces inference, not training",
        sourceIds: ["S90", "S91"],
        body: [
          "During this forward pass, query, key, and value projection parameters are already fixed. The model computes new token representations; it does not update its weights.",
          "Training would add a loss, backpropagate through these operations, and apply optimizer updates across examples. A visible attention pass must not be described as the model learning.",
          "Self-attention over content vectors has no inherent token-order signal. Transformers therefore encode position in the input representations or attention computation, for example with positional embeddings, rotary encodings, or position biases. A causal mask only blocks unavailable positions; it is not by itself a full representation of position.",
        ],
        conceptIds: ["attention", "transformer", "training-versus-inference"],
        tags: [
          "inference",
          "training",
          "fixed weights",
          "forward pass",
          "position",
        ],
      },
      {
        id: "attention-qkv",
        kind: "worked-example",
        heading: "Queries select; values supply content",
        sourceIds: ["S103", "S90"],
        body: [
          "For one token, its query is compared with each allowed key. Scaled dot products become scores; softmax converts them into nonnegative weights summing to one.",
          "The output is the weighted sum of value vectors, not key vectors. A key helps determine how much to route; its paired value supplies what is routed.",
        ],
        conceptIds: ["attention", "qkv"],
        tags: ["query", "key", "value", "dot product", "softmax"],
      },
      {
        id: "attention-mask",
        kind: "definition",
        heading: "A causal mask limits available positions",
        sourceIds: ["S90", "S91"],
        body: [
          "In left-to-right inference, the causal mask removes future positions before softmax. Their effective score is negative infinity, so their normalized weight is zero.",
          "The mask encodes an information constraint. It is separate from the learned compatibility scores among positions that remain allowed.",
        ],
        conceptIds: ["attention", "transformer"],
        tags: ["causal mask", "future token", "information constraint"],
      },
      {
        id: "attention-block",
        kind: "reading",
        heading: "A transformer block contains more than attention",
        sourceIds: ["S90", "S91"],
        body: [
          "Multi-head attention runs several learned routing projections, then combines their outputs. Residual paths, normalization, and a position-wise feed-forward network transform the representation further.",
          "Therefore an attention matrix is one intermediate state, not the whole transformer computation.",
        ],
        conceptIds: ["transformer", "residual-path"],
        tags: ["multi-head", "feed-forward", "normalization", "residual"],
      },
      {
        id: "attention-not-explanation",
        kind: "checkpoint",
        heading: "Attention weight is not causal proof",
        sourceIds: ["S97"],
        body: [
          "A large attention weight shows strong routing under this head and input. It does not by itself prove that the attended token caused the final prediction or expresses the model's reason.",
          "Trace ML therefore treats a route ablation as an authored causal test: change one route while holding the comparison fixed, then measure whether the output changes. The test can supply intervention evidence; the original attention weight cannot.",
        ],
        conceptIds: ["attention", "transformer"],
        tags: ["interpretability", "causality", "ablation", "intervention"],
      },
    ],
    activities: [
      {
        id: "attention-equal-score-prediction",
        kind: "prediction",
        conceptIds: ["attention", "qkv"],
        evidenceKind: "prediction",
        renderer: "choice",
        checkpoint: {
          id: "attention-equal-score-prediction",
          prompt:
            "One query has the same finite score for three allowed keys, with no other allowed positions. What weights does softmax assign?",
          options: [
            { id: "thirds", label: "1/3, 1/3, and 1/3" },
            { id: "halves", label: "0.5, 0.5, and 0" },
            { id: "one-hot", label: "1, 0, and 0" },
            { id: "train", label: "It updates the model weights" },
          ],
          correctOptionId: "thirds",
          supportedExplanation:
            "Correct. The three equal scores have equal exponentials, and each exponential is one of three equal terms in the denominator, so every weight is 1/3.",
          revisitExplanation:
            "Write one identical exponential for each of the three scores, add all three in the denominator, and divide each term by that sum.",
        },
      },
      {
        id: "attention-routing-lab",
        kind: "visual-lab",
        labId: "attention-routing",
        conceptIds: ["attention", "qkv"],
        evidenceKind: "manipulation",
        title: "Change one key match and trace the routed value",
        prompt:
          "Predict which value contributes more, then vary one query-key score while preserving values, the mask, and every other score.",
        invariant:
          "Value vectors, causal mask, query position, and all other scores remain fixed.",
        intervention: "Change only one query-key compatibility score.",
        control: {
          label: "Selected key score",
          min: -2,
          max: 2,
          step: 0.25,
          initial: 0,
          lowLabel: "routes less",
          highLabel: "routes more",
        },
      },
      responseActivity(
        "attention-routing-explanation",
        "explanation",
        ["attention", "qkv", "transformer"],
        "Explain how increasing one allowed query-key score changes the output representation. Then explain why the resulting larger attention weight is not enough to claim that token caused the final prediction, and name a controlled test.",
        "Trace score, softmax weight, value mixture, later paths, and an ablation or replacement.",
        [
          {
            id: "attention-score-weight",
            label: "connect compatibility score to softmax weight",
            keywordGroups: [
              ["query", "key", "score"],
              ["softmax", "normalize"],
              ["weight", "larger", "increase"],
            ],
          },
          {
            id: "attention-value-mixture",
            label: "connect the weight to the value mixture",
            keywordGroups: [["value"], ["weighted sum", "mixture", "contribution"], ["output", "representation"]],
          },
          {
            id: "attention-causal-boundary",
            label: "deny a complete causal explanation from weights alone",
            keywordGroups: [
              ["attention weight"],
              ["not", "alone", "insufficient"],
              ["cause", "explanation", "reason"],
            ],
          },
          {
            id: "attention-intervention",
            label: "propose a controlled route intervention",
            keywordGroups: [
              ["ablate", "remove", "replace", "intervene"],
              ["hold", "control", "same"],
              ["output", "prediction", "change"],
            ],
          },
        ],
        "You traced information routing while keeping the causal claim narrower than the visualization.",
        "Follow score to softmax to value mixture, then ask what an intervention would need to hold fixed.",
      ),
      responseActivity(
        "attention-dispatch-transfer",
        "transfer",
        ["attention", "qkv"],
        "A dispatcher has one request, three depot descriptions, and three depot payloads containing available inventory. Map request, descriptions, and payloads to query, keys, and values. Explain the weighted response and why a high routing weight does not prove the depot caused the final delivery outcome.",
        "Map all three roles, normalization, content mixing, and the downstream causal boundary.",
        [
          {
            id: "dispatch-query",
            label: "map the request to the query",
            keywordGroups: [["request"], ["query"]],
          },
          {
            id: "dispatch-keys",
            label: "map depot descriptions to keys",
            keywordGroups: [["description", "depot description"], ["key", "keys"]],
          },
          {
            id: "dispatch-values",
            label: "map inventory payloads to values",
            keywordGroups: [["inventory", "payload"], ["value", "values"]],
          },
          {
            id: "dispatch-weighted-boundary",
            label: "describe normalized mixing without claiming delivery causality",
            keywordGroups: [
              ["softmax", "normalize", "weights"],
              ["weighted", "mix", "sum"],
              ["not prove", "does not prove", "not cause"],
              ["delivery", "outcome"],
            ],
          },
        ],
        "You transferred the routing mechanism and preserved the distinction between an intermediate weight and a final cause.",
        "Assign request, lookup description, and routed content to three different Q-K-V roles.",
      ),
      {
        ...pythonLab(
        "attention-python-lab",
        ["attention", "qkv", "transformer", "training-versus-inference"],
        "attention_inference.py",
        "PRIMM: Predict the equal-score mixture before running. Run the working softmax and causal mask, investigate the weights, then complete the value-weighted sum. The check routes two different value sets so one memorized output cannot pass. Modify one key score and trace the output change. This isolated inference pass assumes position information was already supplied; it performs no training update.",
        `from math import exp, log


def softmax(scores):
    maximum = max(scores)
    numerators = [exp(score - maximum) for score in scores]
    denominator = sum(numerators)
    return [value / denominator for value in numerators]


def causal_scores(scores, query_position):
    return [
        score if key_position <= query_position else float("-inf")
        for key_position, score in enumerate(scores)
    ]


def scalar_attention(query, keys, values):
    scores = [query * key for key in keys]
    weights = softmax(scores)
    # Modify: return weights and their weighted sum of values.
    output = None
    return weights, output


LOG_THREE = log(3.0)
`,
        [
          {
            id: "attention-softmax-equal",
            label: "Equal scores produce equal normalized weights",
            expression:
              "str([round(value, 6) for value in softmax([0.0, 0.0])])",
            expected: "[0.5, 0.5]",
            conceptIds: ["attention"],
          },
          {
            id: "attention-weighted-output",
            label: "Q-K scores route two different sets of paired values",
            expression:
              "str(((lambda result: ([round(value, 6) for value in result[0]], round(result[1], 6)))(scalar_attention(1.0, [0.0, LOG_THREE], [2.0, 10.0])), (lambda result: ([round(value, 6) for value in result[0]], round(result[1], 6)))(scalar_attention(2.0, [0.0, 0.0], [3.0, -1.0]))))",
            expected:
              "(([0.25, 0.75], 8.0), ([0.5, 0.5], 1.0))",
            conceptIds: ["qkv"],
          },
          {
            id: "attention-causal-mask",
            label: "Future positions receive no normalized weight",
            expression:
              "str([round(value, 6) for value in softmax(causal_scores([0.0, 0.0, 0.0], 1))])",
            expected: "[0.5, 0.5, 0.0]",
            conceptIds: ["attention"],
          },
          {
            id: "attention-no-training",
            label: "Completed inference returns an output without mutating inputs",
            expression:
              "str((lambda keys, values: (lambda result: (round(result[1], 6), keys, values))(scalar_attention(1.0, keys, values)))([0.0, LOG_THREE], [2.0, 10.0]))",
            expected:
              "(8.0, [0.0, 1.0986122886681098], [2.0, 10.0])",
            conceptIds: ["training-versus-inference"],
          },
        ],
        1801,
        ),
        evidenceConceptIds: ["attention", "qkv", "training-versus-inference"],
      },
    ],
    resources: [
      interactive(
        "attention-transformer-explainer",
        "Transformer Explainer: LLM Transformer Model Visually Explained",
        "Georgia Institute of Technology",
        "https://poloclub.github.io/transformer-explainer/",
        10,
        "attention-routing-explanation",
        "Explore after the local Q-K-softmax-V explanation; inspect routing while keeping attention weights narrower than a causal explanation.",
        "S90",
      ),
      reading(
        "attention-google-transformers",
        "LLMs: What's a large language model?",
        "Google for Developers",
        "https://developers.google.com/machine-learning/crash-course/llm/transformers?hl=en",
        15,
        "attention-python-lab",
        "Read after computing the local inference pass; map the larger architecture back to the authored attention route without treating this as an LLM engineering lesson.",
        "S91",
      ),
    ],
  },
  {
    id: "q-learning",
    number: "19",
    moduleId: "systems",
    phase: "learn",
    published: true,
    title: "Learn from delayed consequences",
    question: "How does a reward update an earlier decision?",
    summary:
      "Separate bandits from stateful decisions, compute a Bellman target, and execute a tabular Q-learning update.",
    durationMinutes: 60,
    revision: lessonRevision("q-learning"),
    sourceIds: ["S92", "S93", "S98", "S09"],
    mechanism: {
      input: "A state, action, observed reward, next state, and current Q table",
      process:
        "Bootstrap a target from immediate reward plus discounted best next-state value, then move the selected entry toward it",
      output:
        "An updated estimate of expected discounted return for one state-action pair",
    },
    starterQuestions: [
      "When is a bandit enough, and when is an MDP required?",
      "Why is reward not a supervised label?",
      "What changes when the next state is terminal?",
    ],
    prerequisiteConceptIds: [
      "optimization-dynamics",
      "decision-cost",
      "probability-baseline",
    ],
    outcomes: [
      {
        id: "q-explain-bootstrap",
        conceptId: "bellman-update",
        text: "Explain how immediate reward and next-state value form a Q-learning target.",
        requiredEvidenceKinds: ["explanation"],
      },
      {
        id: "q-transfer-mdp",
        conceptId: "mdp",
        text: "Map a surface-different sequential decision problem into states, actions, rewards, and transitions.",
        requiredEvidenceKinds: ["transfer"],
      },
      {
        id: "q-code-update",
        conceptId: "q-learning",
        text: "Complete terminal-aware Bellman targets and verify the supplied tabular update.",
        requiredEvidenceKinds: ["code-check"],
      },
    ],
    teaching: {
      title: "Trace immediate reward, future value, and the terminal boundary",
      introduction: [
        "Reinforcement learning studies an agent that acts and then observes consequences. A state, written s, summarizes the current decision situation. An action a is a choice available in that state. After acting, the environment supplies a reward r and a next state s_prime. A Markov decision process, or MDP, models these states, actions, transition behavior, and rewards. The Markov boundary says the current state contains the information the model uses to describe what happens next.",
        "Q-learning stores or approximates Q(s, a), an estimate of the expected discounted return for taking action a in state s and then following an optimal target policy. Its update is off-policy: the target uses max_a Q(s_prime, a), while the behavior policy collecting experience may still explore instead of acting greedily. Return means accumulated future rewards. The discount factor gamma lies between 0 and 1 and scales later value relative to immediate reward. For a nonterminal transition, the target is r + gamma * max_a Q(s_prime, a): observed reward plus the best current next-state estimate. Using an estimate inside a target is called bootstrapping.",
        "The update exposes one more state. The temporal-difference error is target - current Q(s, a). With learning rate alpha, the new entry is current Q + alpha * error; only the visited state-action entry changes in a table. A terminal transition ends the episode, so no next decision exists and the future-value term must be omitted. This is also the boundary from a stationary context-free bandit: a bandit repeats one decision context, while an MDP represents actions that change future states and opportunities.",
      ],
      vocabulary: [
        {
          term: "State",
          definition:
            "The information s used to describe the current decision situation before an action.",
        },
        {
          term: "Action",
          definition:
            "A choice a available to the agent in a state.",
        },
        {
          term: "Reward",
          definition:
            "A numerical consequence r observed after a transition, not a correct-action label for every state.",
        },
        {
          term: "Q value",
          definition:
            "An estimate Q(s, a) of expected discounted return for one state-action pair.",
        },
        {
          term: "Bellman target",
          definition:
            "The immediate reward plus discounted best next-state value, except at a terminal transition.",
        },
        {
          term: "Temporal-difference error",
          definition:
            "The Bellman target minus the current Q estimate for the visited state-action pair.",
        },
      ],
      workedExample: {
        title: "Update one warehouse decision and then cross the terminal boundary",
        setup:
          "A warehouse agent in state s = low stock chooses action a = order. It receives reward r = 2 and reaches state s_prime = stocked. Use gamma = 0.9, current Q(s, a) = 1, best next-state Q value = 5, and learning rate alpha = 0.5.",
        steps: [
          {
            label: "Record the complete transition",
            explanation:
              "The observed tuple is (s = low stock, a = order, r = 2, s_prime = stocked, terminal = false). Keeping the terminal flag explicit prevents an unavailable future state from entering the calculation.",
          },
          {
            label: "Form the nonterminal target",
            explanation:
              "Because another decision follows, target = r + gamma * max_a Q(s_prime, a) = 2 + 0.9*5 = 6.5. The value 5 is an existing estimate, not an observed reward.",
          },
          {
            label: "Measure the prediction error",
            explanation:
              "The temporal-difference error is target - current Q(s, a) = 6.5 - 1 = 5.5. Its positive sign says the visited entry currently underestimates this target.",
          },
          {
            label: "Move the visited entry",
            explanation:
              "New Q(s, a) = 1 + 0.5*5.5 = 3.75. The update moves halfway toward 6.5. Other actions and states remain unchanged because this transition supplied no direct update for them.",
          },
          {
            label: "Change only the terminal flag",
            explanation:
              "Now suppose the same action receives reward 2 and ends the episode. There is no s_prime decision to value, so the target is exactly r = 2. Adding 0.9*5 would invent consequences after termination.",
          },
          {
            label: "Update at termination",
            explanation:
              "If the terminal transition's current Q is 1 and alpha remains 0.5, its temporal-difference error is 2 - 1 = 1 and its new Q is 1 + 0.5*1 = 1.5. The target is 2 even though the partial update stops at 1.5.",
          },
        ],
        takeaway:
          "Keep reward, next-state estimate, terminal flag, target, temporal-difference error, and updated table entry visible as separate quantities.",
      },
      misconceptions: [
        {
          misconception: "Reward is the correct action label.",
          correction:
            "Reward evaluates an experienced consequence. The learner must estimate how current actions affect both immediate and later rewards under transitions.",
        },
        {
          misconception: "The largest next-state Q value is always added.",
          correction:
            "It is included only for a nonterminal transition. At episode termination there is no next action, so the target equals the observed reward.",
        },
        {
          misconception: "One update changes the entire Q table.",
          correction:
            "Tabular Q-learning changes the visited state-action entry. Other entries change only when their own transitions are updated.",
        },
      ],
      summary: [
        "Write the transition and terminal flag before deciding whether a next-state value exists.",
        "For a continuing transition, combine immediate reward with gamma times the best current next-state estimate.",
        "For a terminal transition with reward 2, the Bellman target is 2, not 6.5 or the partially updated Q value.",
      ],
      sourceIds: ["S92", "S93", "S98", "S09"],
    },
    blocks: [
      {
        id: "q-bandit-boundary",
        kind: "opening",
        heading: "A bandit has actions but no changing state",
        sourceIds: ["S98"],
        body: [
          "In the stationary, context-free multi-armed bandit used here, each action produces a reward and the next choice faces the same decision context. Contextual and nonstationary bandits relax those assumptions. The central tension is exploring uncertain actions versus exploiting the best current estimate.",
          "When an action changes what can happen next, the missing state and transition matter. That is the boundary where a Markov decision process is needed.",
        ],
        conceptIds: ["bandit", "mdp"],
        tags: ["action", "reward", "exploration", "state"],
      },
      {
        id: "q-mdp",
        kind: "definition",
        heading: "An MDP makes consequences explicit",
        sourceIds: ["S92"],
        body: [
          "An MDP specifies states, available actions, transition behavior, rewards, and a discount factor. The Markov assumption says the current state contains the information used to model the next transition.",
          "A reward evaluates an observed transition. It is not a correct-action label supplied for every state.",
        ],
        conceptIds: ["mdp"],
        tags: ["transition", "discount", "Markov", "reward versus label"],
      },
      {
        id: "q-bellman-target",
        kind: "worked-example",
        heading: "Bootstrap from the next state",
        sourceIds: ["S93"],
        body: [
          "Suppose a transition gives reward 2, discount 0.9, and the largest next-state Q value is 5. The Q-learning target is 2 + 0.9 * 5 = 6.5.",
          "If the transition ends the episode, there is no future term and the target is only the observed reward.",
        ],
        conceptIds: ["bellman-update", "q-learning"],
        tags: ["target", "bootstrap", "terminal", "discounted return"],
      },
      {
        id: "q-update",
        kind: "worked-example",
        heading: "Move one estimate toward the target",
        sourceIds: ["S93"],
        body: [
          "For current Q = 1, target 6.5, and learning rate 0.5, the temporal-difference error is 5.5 and the updated Q is 1 + 0.5 * 5.5 = 3.75.",
          "Only the visited state-action entry changes in tabular Q-learning. Unvisited estimates do not become correct by association.",
        ],
        conceptIds: ["bellman-update", "q-learning"],
        tags: ["TD error", "learning rate", "table", "off-policy"],
      },
      {
        id: "q-limits",
        kind: "checkpoint",
        heading: "The reward definition is part of the system",
        sourceIds: ["S92", "S93"],
        body: [
          "From experienced rewards and transitions, Q-learning updates action-value estimates so policy behavior can seek to maximize expected discounted return. It does not optimize the environment's reward function or transition dynamics. Sparse feedback, unsafe exploration, hidden state, changing dynamics, or a misspecified reward can make a numerically correct update produce unwanted behavior.",
        ],
        conceptIds: ["mdp", "q-learning"],
        tags: ["reward design", "hidden state", "safety", "nonstationarity"],
      },
    ],
    activities: [
      {
        id: "q-terminal-prediction",
        kind: "prediction",
        conceptIds: ["bellman-update", "q-learning"],
        evidenceConceptIds: ["bellman-update"],
        evidenceKind: "prediction",
        renderer: "choice",
        checkpoint: {
          id: "q-terminal-prediction",
          prompt:
            "A transition ends the episode with reward -3. The discount is 0.8 and the largest listed next-state Q value is 7. What is the Q-learning target?",
          options: [
            { id: "negative-three", label: "-3" },
            { id: "two-point-six", label: "2.6: -3 + 0.8 * 7" },
            { id: "seven", label: "7" },
            { id: "zero", label: "0" },
          ],
          correctOptionId: "negative-three",
          supportedExplanation:
            "Correct. Because the transition is terminal, no future decision exists and the target is the observed reward, -3. The listed next-state estimate is not used.",
          revisitExplanation:
            "Check the terminal flag before using gamma or any next-state Q value. A terminal target contains only the immediate reward.",
        },
      },
      {
        id: "q-learning-lab",
        kind: "visual-lab",
        labId: "q-learning",
        conceptIds: ["bellman-update", "q-learning"],
        evidenceKind: "manipulation",
        title: "Change delayed value while preserving the transition",
        prompt:
          "Predict the target, then vary only the best next-state value while holding reward, discount, terminal flag, and current Q fixed.",
        invariant:
          "Immediate reward, discount, terminal flag, current Q, and learning rate remain fixed.",
        intervention: "Change only the estimated best value of the next state.",
        control: {
          label: "Best next-state Q",
          min: -2,
          max: 8,
          step: 0.5,
          initial: 2,
          lowLabel: "poor future",
          highLabel: "valuable future",
        },
      },
      responseActivity(
        "q-bootstrap-explanation",
        "explanation",
        ["mdp", "bellman-update", "q-learning"],
        "Explain why increasing the best next-state Q raises a nonterminal target but cannot affect a terminal target. Distinguish reward from a supervised label and state a transition that would falsify your account.",
        "Use reward, discount, next-state value, terminal handling, and one controlled comparison.",
        [
          {
            id: "q-nonterminal-target",
            label: "state the nonterminal Bellman target",
            keywordGroups: [
              ["reward"],
              ["discount", "gamma"],
              ["next-state", "next state", "future"],
              ["add", "plus", "target"],
            ],
          },
          {
            id: "q-terminal-boundary",
            label: "remove future value at a terminal state",
            keywordGroups: [["terminal", "ends"], ["no future", "zero future", "reward only"]],
          },
          {
            id: "q-reward-not-label",
            label: "distinguish reward from a correct-action label",
            keywordGroups: [
              ["reward"],
              ["transition", "outcome", "consequence"],
              ["not", "unlike"],
              ["label", "correct action"],
            ],
          },
          {
            id: "q-falsifier",
            label: "state a terminal or discount-zero falsifier",
            keywordGroups: [
              ["terminal", "discount zero", "gamma zero"],
              ["next-state value", "future value"],
              ["changes target", "affects target", "would change"],
            ],
          },
        ],
        "You traced the bootstrap term, its terminal boundary, and the difference between consequence and label.",
        "Write separate target equations for continuing and terminal transitions.",
      ),
      responseActivity(
        "q-inventory-transfer",
        "transfer",
        ["bandit", "mdp", "bellman-update"],
        "A warehouse chooses how many units to reorder. The choice changes tomorrow's inventory, storage cost, and stockout risk. Explain why this is not a context-free bandit, then define a state, an action, a reward, and the future term in one Bellman target.",
        "Make the changing inventory state and delayed consequence explicit.",
        [
          {
            id: "inventory-not-bandit",
            label: "explain that the action changes later decisions",
            keywordGroups: [
              ["reorder", "action"],
              ["tomorrow", "future", "next"],
              ["inventory", "state"],
              ["changes", "affects"],
            ],
          },
          {
            id: "inventory-action",
            label: "define the reorder quantity as the action",
            keywordGroups: [["reorder", "order quantity", "units"], ["action"]],
          },
          {
            id: "inventory-reward",
            label: "define reward from cost or service outcomes",
            keywordGroups: [
              ["reward"],
              ["storage cost", "stockout", "service", "profit", "cost"],
            ],
          },
          {
            id: "inventory-future",
            label: "include discounted best next-state value",
            keywordGroups: [
              ["discount", "gamma"],
              ["next inventory", "next state", "tomorrow"],
              ["Q", "value", "future"],
            ],
          },
        ],
        "You represented the warehouse as a stateful decision process with delayed consequences.",
        "The key question is whether today's action changes tomorrow's decision state.",
      ),
      pythonLab(
        "q-learning-python-lab",
        ["bandit", "mdp", "bellman-update", "q-learning"],
        "q_update.py",
        "PRIMM: Predict both terminal and nonterminal targets before running. Run the working bandit mean and table lookup, investigate the temporal-difference error, then complete the Bellman target. Modify discount and explain the changed update.",
        `def update_bandit_mean(old_mean, old_count, reward):
    new_count = old_count + 1
    new_mean = old_mean + (reward - old_mean) / new_count
    return new_mean, new_count


def bellman_target(reward, discount, next_values, terminal):
    # Modify: terminal uses reward only; otherwise bootstrap from max next value.
    return None


def q_update(current_q, target, learning_rate):
    td_error = target - current_q
    return current_q + learning_rate * td_error


def update_table(table, state, action, reward, next_state,
                 discount, learning_rate, terminal=False):
    next_values = [] if terminal else list(table[next_state].values())
    target = bellman_target(reward, discount, next_values, terminal)
    table[state][action] = q_update(table[state][action], target, learning_rate)
    return table[state][action]
`,
        [
          {
            id: "q-bandit-mean",
            label: "Bandit estimate averages observed rewards",
            expression: "str(update_bandit_mean(4.0, 3, 8.0))",
            expected: "(5.0, 4)",
            conceptIds: ["bandit"],
          },
          {
            id: "q-bellman-continuing",
            label:
              "Continuing targets use each supplied reward, discount, and next value",
            expression:
              "str([bellman_target(2.0, 0.9, [3.0, 5.0], False), bellman_target(-1.0, 0.25, [8.0, -4.0], False), bellman_target(4.0, 0.5, [-2.0, -6.0], False)])",
            expected: "[6.5, 1.0, 3.0]",
            conceptIds: ["bellman-update"],
          },
          {
            id: "q-bellman-terminal",
            label: "Terminal target excludes future value",
            expression: "bellman_target(2.0, 0.9, [100.0], True)",
            expected: 2,
            conceptIds: ["mdp", "bellman-update"],
          },
          {
            id: "q-table-update",
            label: "Scalar Q update moves halfway toward the target",
            expression: "q_update(1.0, 6.5, 0.5)",
            expected: 3.75,
            conceptIds: ["q-learning"],
          },
          {
            id: "q-table-mutation",
            label: "Continuing update mutates the selected table entry",
            expression:
              "str((lambda table: (update_table(table, 's', 'a', 2.0, 'next', 0.9, 0.5), table['s']['a']))({'s': {'a': 1.0}, 'next': {'left': 3.0, 'right': 5.0}}))",
            expected: "(3.75, 3.75)",
            conceptIds: ["bellman-update", "q-learning"],
          },
          {
            id: "q-terminal-table-mutation",
            label: "Terminal table update uses reward without a next-state lookup",
            expression:
              "str((lambda table: (update_table(table, 's', 'a', 2.0, 'missing', 0.9, 0.5, True), table['s']['a']))({'s': {'a': 4.0}}))",
            expected: "(3.0, 3.0)",
            conceptIds: ["mdp", "bellman-update", "q-learning"],
          },
        ],
        1901,
      ),
    ],
    resources: [
      reading(
        "q-learning-berkeley-mdp",
        "4.1 Markov Decision Processes",
        "UC Berkeley CS 188",
        "https://inst.eecs.berkeley.edu/~cs188/textbook/mdp/markov-decision-processes.html",
        10,
        "q-inventory-transfer",
        "Read after the warehouse transfer and compare state, action, transition, reward, and discount with the authored inventory process.",
        "S92",
      ),
      reading(
        "q-learning-hugging-face",
        "Introducing Q-Learning",
        "Hugging Face",
        "https://huggingface.co/learn/deep-rl-course/unit2/q-learning",
        8,
        "q-learning-python-lab",
        "Read after the terminal-aware table update passes and compare the Bellman target with the local code trace.",
        "S93",
      ),
    ],
  },
  {
    id: "shift-monitor",
    number: "20",
    moduleId: "systems",
    phase: "build",
    published: true,
    title: "Diagnose the deployed system",
    question: "Which part of the pipeline failed after deployment?",
    summary:
      "Complete a fixed capstone diagnosis spanning distribution shift, operational-slice reliability, fairness metrics, delayed outcomes, and monitoring.",
    durationMinutes: 65,
    revision: lessonRevision("shift-monitor"),
    sourceIds: ["S94", "S95", "S99", "S01", "S106", "S107"],
    mechanism: {
      input:
        "Versioned model, deployment inputs, decisions, delayed outcomes, and operational slices",
      process:
        "Compare live distributions and error slices with a reference, then localize evidence across data, objective, optimization, evaluation, and operations",
      output: "A bounded diagnosis, mitigation, and monitored verification plan",
    },
    starterQuestions: [
      "Which signals can detect shift before labels arrive?",
      "Why can an overall metric hide an operational-slice failure?",
      "What do demographic parity and equality of opportunity compare?",
    ],
    prerequisiteConceptIds: [
      "pipeline",
      "generalization",
      "decision-threshold",
      "calibration",
      "decision-cost",
    ],
    outcomes: [
      {
        id: "shift-capstone-explanation",
        conceptId: "system-diagnosis",
        text: "Explain the authored deployment failure from linked monitoring evidence.",
        requiredEvidenceKinds: ["explanation"],
      },
      {
        id: "shift-transfer-plan",
        conceptId: "monitoring",
        text: "Transfer the diagnosis protocol to a surface-different deployed model.",
        requiredEvidenceKinds: ["transfer"],
      },
      {
        id: "shift-fairness-outcome",
        conceptId: "fairness",
        text: "Compute group selection and true-positive rates, then explain why different fairness metrics can support different conclusions.",
        requiredEvidenceKinds: ["explanation"],
      },
      {
        id: "shift-code-monitor",
        conceptId: "monitoring",
        text: "Pin deployment identity, compute input drift and operational-slice error rates, and enforce explicit reliability release gates.",
        requiredEvidenceKinds: ["code-check"],
      },
    ],
    teaching: {
      title: "Localize a deployment failure before changing the model",
      introduction: [
        "A deployed machine-learning system is more than model parameters. It includes an artifact, which is the exact packaged model; preprocessing code that converts raw inputs into model features; a decision threshold that turns a score into an action; and serving code that executes the pipeline. Deployment monitoring compares this live system with a reference period. Distribution shift means the statistical pattern of live inputs or outcomes differs from that reference.",
        "Different evidence arrives at different times. Immediate monitors can check schemas, missing values, feature distributions, score distributions, model identity, latency, and decision rates. Outcome metrics such as accuracy or false-negative rate require reliable labels and may arrive later. A false negative is an actually positive case predicted negative. A slice is a named subset, such as day parcels or night parcels, examined separately because one overall average can hide a serious local failure.",
        "Fairness asks how a model's decisions and errors are distributed across stakeholder groups in a particular use context. Demographic parity compares how often groups receive the positive decision, while equality of opportunity compares how often actually positive cases receive that decision. These metrics answer different questions, and neither one alone decides whether the system's consequences are acceptable.",
        "Diagnosis begins by listing what changed and what remained fixed. An input alert establishes change but not root cause; the cause might be data collection, preprocessing, serving, model behavior, or delayed-label quality. Pinning versions narrows the search. A mitigation limits harm while evidence is gathered, and a release gate is a measurable condition that must pass before automation resumes. Retraining is only one possible response and should not precede checks of the measurement and evaluation boundaries.",
      ],
      vocabulary: [
        {
          term: "Model artifact",
          definition:
            "The exact immutable package of learned parameters and model structure used for a deployment.",
        },
        {
          term: "Preprocessing",
          definition:
            "The code and rules that transform raw deployment inputs into the features expected by the model.",
        },
        {
          term: "Distribution shift",
          definition:
            "A measurable difference between reference and live input, prediction, or outcome distributions.",
        },
        {
          term: "Operational slice",
          definition:
            "A deployment subset defined by conditions such as device, site, or time and evaluated separately.",
        },
        {
          term: "False-negative rate",
          definition:
            "False negatives divided by all actually positive cases in the evaluated group.",
        },
        {
          term: "Demographic parity",
          definition:
            "A group comparison that asks whether each group receives the model's positive decision at the same rate.",
        },
        {
          term: "Equality of opportunity",
          definition:
            "A group comparison that asks whether actually positive cases receive the model's positive decision at the same true-positive rate.",
        },
        {
          term: "Release gate",
          definition:
            "A predeclared measurable condition that must pass before a system change or automation is released.",
        },
      ],
      workedExample: {
        title: "Diagnose the fixed Scanner B incident one evidence layer at a time",
        setup:
          `A package-damage model moves from mostly bright Scanner A images to a night facility using Scanner B. Model ${CAPSTONE_INCIDENT.model.version}, artifact ${CAPSTONE_ARTIFACT_DISPLAY_ID}, training trace ${CAPSTONE_TRAINING_DISPLAY_ID}, serving code ${CAPSTONE_INCIDENT.model.servingCodeVersion}, preprocessing ${CAPSTONE_INCIDENT.model.preprocessingVersion}, and threshold ${CAPSTONE_INCIDENT.model.decisionThreshold.toFixed(2)} are pinned.`,
        steps: [
          {
            label: "Verify system identity",
            explanation:
              `The artifact, training trace, serving code, preprocessing version, and threshold are unchanged between reference and live observations. This does not prove correct behavior, but it makes an unexplained new optimizer update or model replacement an unsupported first hypothesis.`,
          },
          {
            label: "Read immediate input evidence",
            explanation:
              `Mean brightness falls from ${CAPSTONE_INCIDENT.metrics.referenceBrightnessMean.toFixed(2)} to ${CAPSTONE_INCIDENT.metrics.liveBrightnessMean.toFixed(2)}, a shift of ${CAPSTONE_INCIDENT.metrics.brightnessMeanShift.toFixed(2)} that exceeds the ${CAPSTONE_INCIDENT.alertThresholds.brightnessMeanShift.toFixed(2)} alert threshold. Missing barcodes rise from ${(CAPSTONE_INCIDENT.reference.missingBarcodeRate * 100).toFixed(0)} percent to ${(CAPSTONE_INCIDENT.live.missingBarcodeRate * 100).toFixed(0)} percent.`,
          },
          {
            label: "Add delayed outcome evidence",
            explanation:
              `When reviewed labels arrive, accuracy falls from ${(CAPSTONE_INCIDENT.reference.accuracy * 100).toFixed(0)} percent to ${(CAPSTONE_INCIDENT.metrics.liveAccuracy * 100).toFixed(0)} percent. This confirms outcome degradation, while the earlier input monitors show that measurement changes were already visible before labels.`,
          },
          {
            label: "Expose the slice boundary",
            explanation:
              `Day false-negative rate is 8/(72 + 8) = ${(CAPSTONE_INCIDENT.metrics.dayFalseNegativeRate * 100).toFixed(0)} percent. Night false-negative rate is 6/(14 + 6) = ${(CAPSTONE_INCIDENT.metrics.nightFalseNegativeRate * 100).toFixed(0)} percent. The ${(CAPSTONE_INCIDENT.metrics.falseNegativeRateGap * 100).toFixed(0)}-point gap exceeds the ${(CAPSTONE_INCIDENT.alertThresholds.falseNegativeRateGap * 100).toFixed(0)}-point alert threshold and would be blurred by one aggregate.`,
          },
          {
            label: "Localize the first investigation",
            explanation:
              "Scanner conditions, brightness, and barcode missingness changed while the model and software identities stayed pinned. The first investigation should therefore compare deployment data and preprocessing for Scanner B, then replay the frozen model on matched scanner slices.",
          },
          {
            label: "Mitigate and define verification",
            explanation:
              `Pause unsupported night automation, preserve logs, validate Scanner B inputs, and collect reviewed night labels. The current overall false-negative rate of ${(CAPSTONE_INCIDENT.metrics.overallFalseNegativeRate * 100).toFixed(0)} percent fails its ${(CAPSTONE_INCIDENT.releaseGates.overallFalseNegativeRate * 100).toFixed(0)} percent gate, and the ${(CAPSTONE_INCIDENT.metrics.nightFalseNegativeRate * 100).toFixed(0)} percent night rate fails its ${(CAPSTONE_INCIDENT.releaseGates.nightFalseNegativeRate * 100).toFixed(0)} percent gate.`,
          },
        ],
        takeaway:
          "Identity evidence narrows what could have changed; immediate inputs detect the incident early; delayed labels and slices quantify harm; gates define what recovery must demonstrate.",
      },
      misconceptions: [
        {
          misconception: "A drift alert proves the model parameters failed.",
          correction:
            "An alert proves a monitored distribution changed. Root cause still requires identity checks, pipeline replay, slice evaluation, and incident context.",
        },
        {
          misconception: "Good overall accuracy or one matched group metric means the deployment is fair and reliable.",
          correction:
            "An aggregate can hide a smaller slice, and equality on one fairness metric can coexist with a gap on another. Inspect relevant group confusion matrices, label quality, exposure, and consequences.",
        },
        {
          misconception: "Retraining should be the first response to production degradation.",
          correction:
            "First contain harm and verify data collection, preprocessing, serving identity, labels, and evaluation coverage. Retrain only when evidence shows parameters should change.",
        },
      ],
      summary: [
        "Separate fixed system identity from changed observations before proposing a cause.",
        "Use immediate input monitors for early detection and delayed labeled slices for outcome and reliability evidence.",
        "Compute selection rates and true-positive rates separately before making a demographic-parity or equality-of-opportunity claim.",
        "When scanner measurements move sharply while the artifact and pipeline versions remain pinned, investigate deployment data and preprocessing first.",
      ],
      sourceIds: ["S94", "S95", "S99", "S01", "S106", "S107"],
    },
    blocks: [
      {
        id: "shift-fixed-capstone",
        kind: "opening",
        heading: "Capstone incident: the model did not change",
        sourceIds: ["S99", "S94"],
        body: [
          `A fixed package-damage model was trained mostly on bright images from Scanner A. The rollout fixture pins model version ${CAPSTONE_INCIDENT.model.version}, artifact ${CAPSTONE_ARTIFACT_DISPLAY_ID}, training trace ${CAPSTONE_TRAINING_DISPLAY_ID}, serving code ${CAPSTONE_INCIDENT.model.servingCodeVersion}, preprocessing ${CAPSTONE_INCIDENT.model.preprocessingVersion}, and threshold ${CAPSTONE_INCIDENT.model.decisionThreshold.toFixed(2)}. At the new night facility, Scanner B produces darker images and a rising missing-barcode rate.`,
          "No lesson, incident detail, or diagnosis branch is generated at runtime. The evidence below is the authored capstone case.",
        ],
        conceptIds: ["distribution-shift", "system-diagnosis"],
        tags: ["capstone", "deployment", "scanner", "fixed case"],
      },
      {
        id: "shift-observations",
        kind: "worked-example",
        heading: "Link each observation to a pipeline layer",
        sourceIds: ["S94", "S95"],
        body: [
          `Input brightness mean moves from ${CAPSTONE_INCIDENT.metrics.referenceBrightnessMean.toFixed(2)} to ${CAPSTONE_INCIDENT.metrics.liveBrightnessMean.toFixed(2)} and missing barcodes rise from ${(CAPSTONE_INCIDENT.reference.missingBarcodeRate * 100).toFixed(0)}% to ${(CAPSTONE_INCIDENT.live.missingBarcodeRate * 100).toFixed(0)}%. Delayed labels later show accuracy falling from ${(CAPSTONE_INCIDENT.reference.accuracy * 100).toFixed(0)}% to ${(CAPSTONE_INCIDENT.metrics.liveAccuracy * 100).toFixed(0)}%. False-negative rate is ${(CAPSTONE_INCIDENT.metrics.dayFalseNegativeRate * 100).toFixed(0)}% for day parcels and ${(CAPSTONE_INCIDENT.metrics.nightFalseNegativeRate * 100).toFixed(0)}% for night parcels.`,
          `The incident fixture keeps artifact ${CAPSTONE_ARTIFACT_DISPLAY_ID}, training trace ${CAPSTONE_TRAINING_DISPLAY_ID}, threshold ${CAPSTONE_INCIDENT.model.decisionThreshold.toFixed(2)}, serving code ${CAPSTONE_INCIDENT.model.servingCodeVersion}, and preprocessing ${CAPSTONE_INCIDENT.model.preprocessingVersion} pinned across the reference and live observations. This evidence first implicates deployment inputs, the measurement path, and operational-slice reliability, not a new optimizer failure.`,
        ],
        conceptIds: [
          "distribution-shift",
          "monitoring",
          "system-diagnosis",
        ],
        tags: ["input drift", "missingness", "accuracy", "false negative rate"],
      },
      {
        id: "shift-fairness",
        kind: "worked-example",
        heading: "Fairness metrics compare different parts of each group",
        sourceIds: ["S95", "S106", "S107"],
        body: [
          "An overall metric averages across the deployment mixture. The day and night scanner slices can expose an operational reliability failure while the aggregate moves only modestly, but that gap alone does not establish a fairness harm.",
          "Within each stakeholder group, a confusion matrix counts four outcomes. A true positive (TP) is an actually positive case predicted positive; a false negative (FN) is actually positive but predicted negative; a false positive (FP) is actually negative but predicted positive; and a true negative (TN) is actually negative and predicted negative. Selection rate is (TP + FP) divided by all four counts. True-positive rate is TP / (TP + FN).",
          "Consider two groups of 100 cases. Group A has TP = 40, FN = 10, FP = 10, and TN = 40, so its selection rate is (40 + 10) / 100 = 50% and its true-positive rate is 40 / (40 + 10) = 80%. Group B has TP = 20, FN = 20, FP = 0, and TN = 60, so its selection rate is 20% and its true-positive rate is 50%. The 30-point selection-rate gap violates demographic parity, and the 30-point true-positive-rate gap violates equality of opportunity.",
          "The metrics can trade off. To raise Group B's true-positive rate from 50% to 80% with 40 actually positive cases, 12 false negatives would need to become true positives, giving TP = 32 and FN = 8. Selection would then be at least 32%. Reaching Group A's 50% selection rate as well could, for example, add 18 false positives, giving FP = 18, TN = 42, and a 30% false-positive rate. Group A's false-positive rate is 10 / 50 = 20%, so matching the first two metrics would leave a 10-point false-positive-rate gap.",
          "Metric choice therefore requires the decision's purpose, affected stakeholders, error costs, group definitions, and label quality. Demographic parity can be computed from decisions and group membership before outcomes arrive; equality of opportunity requires trustworthy outcome labels. Equalizing one metric does not by itself establish fairness.",
        ],
        conceptIds: ["fairness", "monitoring"],
        tags: ["confusion matrix", "demographic parity", "equality of opportunity", "tradeoff"],
      },
      {
        id: "shift-monitoring-layers",
        kind: "reading",
        heading: "Monitor before and after outcomes arrive",
        sourceIds: ["S94"],
        body: [
          "Immediate monitors can track schema, missingness, feature distributions, model version, latency, score distributions, decision rates, and pre-label selection-rate parity when reliable group membership is available. Outcome-dependent performance and fairness measures such as false-negative-rate parity or equality of opportunity require reliable labels, which may arrive later.",
          "A drift alert is evidence that behavior or inputs changed, not proof of the root cause. Diagnosis combines monitors with controlled replay, slice evaluation, and incident context.",
        ],
        conceptIds: ["distribution-shift", "monitoring", "system-diagnosis"],
        tags: ["label delay", "schema", "score drift", "root cause"],
      },
      {
        id: "shift-response",
        kind: "checkpoint",
        heading: "Mitigate, verify, and keep the boundary visible",
        sourceIds: ["S99", "S94"],
        body: [
          "The authored response is to pause unsupported night automation, preserve logs, validate Scanner B preprocessing, collect reviewed night labels, compare the frozen model on matched scanner slices, and release only after overall and night false-negative gates pass.",
          "Retraining is not the first automatic answer. Repair the measurement path and evaluation coverage before choosing whether model parameters must change.",
        ],
        conceptIds: ["monitoring", "system-diagnosis"],
        tags: ["mitigation", "rollback", "replay", "release gate"],
      },
    ],
    activities: [
      {
        id: "shift-first-diagnosis-prediction",
        kind: "prediction",
        conceptIds: ["distribution-shift", "system-diagnosis"],
        evidenceKind: "prediction",
        renderer: "choice",
        checkpoint: {
          id: "shift-first-diagnosis-prediction",
          prompt:
            "A deployed vibration model keeps the same artifact, serving code, preprocessing version, and threshold. After a factory replaces its accelerometer, mean amplitude changes from 0.8 to 7.6 and missing readings rise from 4% to 18%. Which layer should be investigated first?",
          options: [
            { id: "data", label: "Sensor units, deployment data, and preprocessing" },
            { id: "optimizer", label: "The optimizer used during old training" },
            { id: "attention", label: "An unrelated attention mechanism" },
            { id: "course", label: "Replace the diagnosis with new course material" },
          ],
          correctOptionId: "data",
          supportedExplanation:
            "Correct. The hardware change, shifted amplitude scale, and increased missingness point first to sensor units, incoming data, and preprocessing while the deployed software identity remains fixed.",
          revisitExplanation:
            "List changed and fixed evidence separately. Investigate the replaced sensor and its measurement path before mechanisms that did not change.",
        },
      },
      {
        id: "shift-monitor-lab",
        kind: "visual-lab",
        labId: "shift-monitor",
        conceptIds: ["distribution-shift", "monitoring"],
        evidenceConceptIds: ["distribution-shift", "monitoring"],
        evidenceKind: "manipulation",
        title: "Change positive-case mix under frozen slice rates",
        prompt:
          `Predict aggregate FNR, then change what fraction of a fixed ${CAPSTONE_INCIDENT.metrics.totalActualPositiveSupport} actual-positive evaluation cases comes from the Scanner B night slice.`,
        invariant:
          `Total actual-positive support, model ${CAPSTONE_INCIDENT.model.version}, artifact ${CAPSTONE_ARTIFACT_DISPLAY_ID}, training trace ${CAPSTONE_TRAINING_DISPLAY_ID}, threshold ${CAPSTONE_INCIDENT.model.decisionThreshold.toFixed(2)}, serving code ${CAPSTONE_INCIDENT.model.servingCodeVersion}, preprocessing ${CAPSTONE_INCIDENT.model.preprocessingVersion}, per-slice false-negative rates, and label definition remain fixed.`,
        intervention:
          "Reallocate only the fixed actual-positive support between day and night slices; no overall parcel share is implied.",
        control: {
          label: "Night share among actual positives",
          min: 0,
          max: 1,
          step: 0.1,
          initial:
            CAPSTONE_INCIDENT.metrics.nightShareAmongActualPositives,
          lowLabel: "all day positives",
          highLabel: "all night positives",
        },
      },
      responseActivity(
        "shift-capstone-diagnosis",
        "explanation",
        ["distribution-shift", "monitoring", "system-diagnosis"],
        "Diagnose the fixed Scanner B incident. Build the causal evidence chain, reject optimizer failure as the first explanation, identify the hidden night-slice reliability failure, and state a controlled result that would challenge the data-shift diagnosis.",
        "Use the pinned deployment identity, changed input measurements, delayed outcome slices, and a matched replay.",
        [
          {
            id: "shift-input-evidence",
            label: "identify brightness and missingness shift",
            keywordGroups: [
              ["brightness", "darker"],
              ["missing", "barcode"],
              ["shift", "changed", "moved"],
            ],
          },
          {
            id: "shift-fixed-model",
            label: "use frozen model evidence against optimizer failure",
            keywordGroups: [
              ["artifact", "model version", "hash"],
              ["unchanged", "frozen", "same"],
              ["optimizer", "training"],
            ],
          },
          {
            id: "shift-slice-reliability",
            label: "identify the night-slice false-negative reliability gap",
            keywordGroups: [
              ["night"],
              ["false negative", "missed damage"],
              ["30%", "higher", "gap"],
            ],
          },
          {
            id: "shift-challenge",
            label: "state a matched scanner or preprocessing replay",
            keywordGroups: [
              ["matched", "same parcels", "replay", "control"],
              ["Scanner A", "Scanner B", "preprocessing", "brightness correction"],
              ["no difference", "gap remains", "would challenge", "does not recover"],
            ],
          },
        ],
        "You localized the incident from changed measurements to an operational-slice reliability failure and proposed a test that could overturn the diagnosis.",
        "Order the evidence by time: pinned deployment identity, immediate input drift, then delayed operational-slice outcomes.",
      ),
      responseActivity(
        "shift-clinic-fairness-explanation",
        "explanation",
        ["fairness", "monitoring"],
        "A fixed clinic referral model has these reviewed outcomes. Group East: TP = 27, FN = 3, FP = 15, TN = 55. Group West: TP = 36, FN = 24, FP = 4, TN = 36. Compute each group's selection rate and true-positive rate. State what demographic parity and equality of opportunity compare, report which observed gap is smaller and which is larger without assuming a fairness tolerance, then explain one threshold tradeoff and one reason these two metrics alone cannot settle whether the system is fair.",
        "Use all four confusion-matrix counts for selection rate, only actually positive cases for true-positive rate, and keep the metric calculation separate from the stakeholder judgment.",
        [
          {
            id: "clinic-selection-rates",
            label: "compute East and West selection rates as 42% and 40%",
            keywordGroups: [
              ["42%", "0.42", "42 percent"],
              ["40%", "0.40", "40 percent"],
              ["selection", "positive decision", "referred"],
            ],
          },
          {
            id: "clinic-true-positive-rates",
            label: "compute East and West true-positive rates as 90% and 60%",
            keywordGroups: [
              ["90%", "0.9", "90 percent"],
              ["60%", "0.6", "60 percent"],
              ["true positive", "TPR", "actually positive"],
            ],
          },
          {
            id: "clinic-demographic-parity",
            label: "report the two-point selection-rate gap as smaller than the 30-point true-positive-rate gap",
            keywordGroups: [
              ["demographic parity"],
              ["selection", "positive decision"],
              ["2", "two"],
              ["smaller", "less", "30", "thirty"],
            ],
          },
          {
            id: "clinic-equality-opportunity",
            label: "identify the 30-point true-positive-rate gap as unequal opportunity",
            keywordGroups: [
              ["equality of opportunity"],
              ["true positive", "TPR", "actually positive"],
              ["30", "thirty", "gap", "not equal"],
            ],
          },
          {
            id: "clinic-tradeoff-boundary",
            label: "connect a threshold change to another error and preserve the stakeholder-context boundary",
            keywordGroups: [
              ["threshold", "lower", "raise", "change"],
              ["false positive", "false negative", "FP", "FN", "error"],
              ["stakeholder", "consequence", "context", "label", "group definition"],
            ],
          },
        ],
        "You computed both group comparisons, compared their observed gaps without inventing a fairness tolerance, and kept the metric tradeoff separate from the final fairness judgment.",
        "Recompute selection from every case and true-positive rate from actually positive cases, then name what a threshold changes and what stakeholder evidence is still missing.",
      ),
      responseActivity(
        "shift-water-transfer",
        "transfer",
        ["distribution-shift", "monitoring", "system-diagnosis"],
        "A water-quality alert model moves to a river with a replacement turbidity sensor. Labels arrive weekly, and false negatives rise mainly during storm flow. Design the immediate monitors, delayed slice checks, first mitigation, and a controlled test separating sensor shift from model failure.",
        "Name pre-label signals, the storm slice, a reversible safety action, and a matched-sample replay.",
        [
          {
            id: "water-immediate-monitors",
            label: "monitor sensor distribution and missingness before labels",
            keywordGroups: [
              ["turbidity", "sensor"],
              ["distribution", "range", "mean", "missing"],
              ["monitor", "drift"],
            ],
          },
          {
            id: "water-delayed-slice",
            label: "check false negatives on the storm-flow slice",
            keywordGroups: [
              ["weekly", "delayed", "labels"],
              ["storm"],
              ["false negative", "missed alert"],
            ],
          },
          {
            id: "water-mitigation",
            label: "state a reversible safety mitigation",
            keywordGroups: [
              ["pause", "manual review", "fallback", "lower threshold"],
              ["storm", "alerts", "automation"],
            ],
          },
          {
            id: "water-controlled-test",
            label: "compare old and replacement sensors on matched water",
            keywordGroups: [
              ["same water", "matched sample", "side by side"],
              ["old sensor", "replacement sensor", "both sensors"],
              ["compare", "replay", "control"],
            ],
          },
        ],
        "You transferred the layered diagnosis to a delayed-label safety system with an explicit control.",
        "Separate signals available today from outcome labels available next week, then compare both sensors on the same water.",
      ),
      {
        ...pythonLab(
        "shift-monitor-python-lab",
        ["distribution-shift", "monitoring", "system-diagnosis"],
        "deployment_monitor.py",
        "PRIMM: Predict the overall accuracy, overall false-negative rate, and night-slice gap before running. Run the working metric and release-gate functions, investigate which aggregate hides the night slice, then complete the fixed diagnostic rule. Modify an alert threshold and explain why release still requires both overall and night false-negative gates.",
        `MODEL_VERSION = ${JSON.stringify(CAPSTONE_INCIDENT.model.version)}
MODEL_ARTIFACT_DIGEST = ${JSON.stringify(CAPSTONE_INCIDENT.model.artifactDigest)}
TRAINING_TRACE_DIGEST = ${JSON.stringify(CAPSTONE_INCIDENT.model.trainingTraceDigest)}
SERVING_CODE_VERSION = ${JSON.stringify(CAPSTONE_INCIDENT.model.servingCodeVersion)}
PREPROCESSING_VERSION = ${JSON.stringify(CAPSTONE_INCIDENT.model.preprocessingVersion)}
DECISION_THRESHOLD = ${CAPSTONE_INCIDENT.model.decisionThreshold}


def mean(values):
    return sum(values) / len(values)


def mean_shift(reference, live):
    return abs(mean(live) - mean(reference))


def accuracy(records):
    return sum(prediction == target for _, target, prediction in records) / len(records)


def false_negative_rate(records, group):
    positives = [
        prediction
        for record_group, target, prediction in records
        if record_group == group and target == 1
    ]
    if not positives:
        return None
    return sum(prediction == 0 for prediction in positives) / len(positives)


def overall_false_negative_rate(records):
    positives = [
        prediction
        for _, target, prediction in records
        if target == 1
    ]
    if not positives:
        return None
    return sum(prediction == 0 for prediction in positives) / len(positives)


def release_ready(
    records,
    overall_fnr_max=${CAPSTONE_INCIDENT.releaseGates.overallFalseNegativeRate},
    night_fnr_max=${CAPSTONE_INCIDENT.releaseGates.nightFalseNegativeRate},
):
    overall_rate = overall_false_negative_rate(records)
    night_rate = false_negative_rate(records, "night")
    return (
        overall_rate is not None
        and night_rate is not None
        and overall_rate <= overall_fnr_max
        and night_rate <= night_fnr_max
    )


def diagnose(reference_brightness, live_brightness, records,
             shift_threshold=${CAPSTONE_INCIDENT.alertThresholds.brightnessMeanShift},
             gap_threshold=${CAPSTONE_INCIDENT.alertThresholds.falseNegativeRateGap}):
    shift = mean_shift(reference_brightness, live_brightness)
    night_rate = false_negative_rate(records, "night")
    day_rate = false_negative_rate(records, "day")
    if night_rate is None or day_rate is None:
        return "insufficient-positive-support"
    gap = abs(night_rate - day_rate)
    # Modify: return the fixed diagnosis for both, one, or no alert.
    return None


REFERENCE_BRIGHTNESS = ${JSON.stringify(CAPSTONE_INCIDENT.reference.brightnessSamples)}
LIVE_BRIGHTNESS = ${JSON.stringify(CAPSTONE_INCIDENT.live.brightnessSamples)}
LIVE_RECORDS = (
    [("day", 1, 1)] * ${CAPSTONE_INCIDENT.live.slices.day.truePositives}
    + [("day", 1, 0)] * ${CAPSTONE_INCIDENT.live.slices.day.falseNegatives}
    + [("day", 0, 0)] * ${CAPSTONE_INCIDENT.live.slices.day.trueNegatives}
    + [("day", 0, 1)] * ${CAPSTONE_INCIDENT.live.slices.day.falsePositives}
    + [("night", 1, 1)] * ${CAPSTONE_INCIDENT.live.slices.night.truePositives}
    + [("night", 1, 0)] * ${CAPSTONE_INCIDENT.live.slices.night.falseNegatives}
    + [("night", 0, 0)] * ${CAPSTONE_INCIDENT.live.slices.night.trueNegatives}
    + [("night", 0, 1)] * ${CAPSTONE_INCIDENT.live.slices.night.falsePositives}
)
`,
        [
          {
            id: "shift-input-monitor",
            label: "Input monitor detects the brightness shift",
            expression: "round(mean_shift(REFERENCE_BRIGHTNESS, LIVE_BRIGHTNESS), 3)",
            expected: CAPSTONE_INCIDENT.metrics.brightnessMeanShift,
            conceptIds: ["distribution-shift", "monitoring"],
          },
          {
            id: "shift-overall-accuracy",
            label: "Aggregate accuracy is computed independently of slices",
            expression: "round(accuracy(LIVE_RECORDS), 3)",
            expected: CAPSTONE_INCIDENT.metrics.liveAccuracy,
            conceptIds: ["monitoring"],
          },
          {
            id: "shift-fnr-gap",
            label: "Night-slice false-negative reliability gap remains visible",
            expression:
              "round(false_negative_rate(LIVE_RECORDS, 'night') - false_negative_rate(LIVE_RECORDS, 'day'), 3)",
            expected: CAPSTONE_INCIDENT.metrics.falseNegativeRateGap,
            conceptIds: ["monitoring"],
          },
          {
            id: "shift-release-gates",
            label: "Overall and night false-negative release gates are explicit",
            expression:
              "str((round(overall_false_negative_rate(LIVE_RECORDS), 3), round(false_negative_rate(LIVE_RECORDS, 'night'), 3), release_ready(LIVE_RECORDS)))",
            expected: `(${CAPSTONE_INCIDENT.metrics.overallFalseNegativeRate}, ${CAPSTONE_INCIDENT.metrics.nightFalseNegativeRate}, False)`,
            conceptIds: ["monitoring"],
          },
          {
            id: "shift-missing-support",
            label: "Undefined actual-positive support fails the release gate closed",
            expression:
              "str((false_negative_rate([('night', 0, 0)], 'night'), overall_false_negative_rate([('night', 0, 0)]), release_ready([('night', 0, 0)]), release_ready([('day', 1, 1), ('night', 0, 0)])))",
            expected: "(None, None, False, False)",
            conceptIds: ["monitoring"],
          },
          {
            id: "shift-fixed-diagnosis",
            label:
              "Pinned deployment identity accompanies every diagnostic branch",
            expression:
              "str(((MODEL_VERSION, MODEL_ARTIFACT_DIGEST, TRAINING_TRACE_DIGEST, SERVING_CODE_VERSION, PREPROCESSING_VERSION, DECISION_THRESHOLD), [diagnose(REFERENCE_BRIGHTNESS, LIVE_BRIGHTNESS, LIVE_RECORDS), diagnose([0.0], [1.0], [('day', 1, 1), ('night', 1, 1)], 0.5, 0.5), diagnose([0.0], [0.0], [('day', 1, 1), ('night', 1, 0)], 0.5, 0.5), diagnose([0.0], [0.0], [('day', 1, 1), ('night', 1, 1)], 0.5, 0.5), diagnose([0.0], [0.0], [('day', 1, 1), ('night', 0, 0)], 0.5, 0.5)]))",
            expected:
              `(('${CAPSTONE_INCIDENT.model.version}', '${CAPSTONE_INCIDENT.model.artifactDigest}', '${CAPSTONE_INCIDENT.model.trainingTraceDigest}', '${CAPSTONE_INCIDENT.model.servingCodeVersion}', '${CAPSTONE_INCIDENT.model.preprocessingVersion}', ${CAPSTONE_INCIDENT.model.decisionThreshold}), ['data-shift-and-subgroup-gap', 'data-shift-only', 'subgroup-gap-only', 'within-alert-thresholds', 'insufficient-positive-support'])`,
            conceptIds: ["system-diagnosis"],
          },
        ],
        2001,
        ),
        evidenceConceptIds: ["distribution-shift", "monitoring", "system-diagnosis"],
      },
    ],
    resources: [
      reading(
        "shift-google-monitoring",
        "Production ML systems: Monitoring pipelines",
        "Google for Developers",
        "https://developers.google.com/machine-learning/crash-course/production-ml-systems/monitoring#write_a_data_schema_to_validate_raw_data",
        6,
        "shift-monitor-python-lab",
        "Read the linked schema-through-training-serving-skew excerpt after the local monitor code passes; the broader page continues beyond this six-minute scope.",
        "S94",
      ),
      reading(
        "shift-google-fairness",
        "Fairness: Evaluating for bias",
        "Google for Developers",
        "https://developers.google.com/machine-learning/crash-course/fairness/evaluating-for-bias",
        5,
        "shift-clinic-fairness-explanation",
        "Read after computing the fixed clinic rates; compare the authored demographic-parity and equality-of-opportunity conclusions with the source's group-evaluation workflow.",
        "S95",
      ),
    ],
  },
];
