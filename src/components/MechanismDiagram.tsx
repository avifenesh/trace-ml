import type { VisualLabActivity } from "../content/types";
import type {
  VisualMechanismMetric,
  VisualMechanismObservation,
} from "../labs/visual-mechanism";

interface MechanismDiagramProps {
  labId: VisualLabActivity["labId"];
  observation: VisualMechanismObservation;
}

interface ObservationViewProps {
  observation: VisualMechanismObservation;
}

const BLUE = "#7fa4ff";
const CORAL = "#ff8b78";
const GREEN = "#75d0b2";
const YELLOW = "#efc66e";
const INK = "#f2f4f8";
const MUTED = "#9ba3af";
const GRID = "#383d46";
const PANEL = "#20242b";

function metric(
  observation: VisualMechanismObservation,
  key: string,
): VisualMechanismMetric {
  const value = observation.metrics[key];
  if (value === undefined) {
    throw new Error(`Mechanism observation is missing metric "${key}".`);
  }
  return value;
}

function numberMetric(
  observation: VisualMechanismObservation,
  key: string,
) {
  const value = metric(observation, key);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Mechanism metric "${key}" must be a finite number.`);
  }
  return value;
}

function stringMetric(
  observation: VisualMechanismObservation,
  key: string,
) {
  const value = metric(observation, key);
  if (typeof value !== "string") {
    throw new Error(`Mechanism metric "${key}" must be a string.`);
  }
  return value;
}

function optionalNumberMetric(
  observation: VisualMechanismObservation,
  key: string,
) {
  const value = metric(observation, key);
  if (value === "undefined") return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(
      `Mechanism metric "${key}" must be a finite number or undefined.`,
    );
  }
  return value;
}

function numberArrayMetric(
  observation: VisualMechanismObservation,
  key: string,
) {
  const value = metric(observation, key);
  if (
    !Array.isArray(value) ||
    !value.every(
      (entry): entry is number =>
        typeof entry === "number" && Number.isFinite(entry),
    )
  ) {
    throw new Error(
      `Mechanism metric "${key}" must be an array of finite numbers.`,
    );
  }
  return value;
}

function formatNumber(value: number, digits = 3) {
  if (value !== 0 && Math.abs(value) >= 1_000_000) {
    return value.toExponential(2);
  }
  return Number(value.toFixed(digits)).toString();
}

function formatPercent(value: number, digits = 1) {
  return `${formatNumber(value * 100, digits)}%`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function scale(
  value: number,
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number,
) {
  const span = domainMax - domainMin;
  if (Math.abs(span) < 1e-12) {
    return (rangeMin + rangeMax) / 2;
  }
  return (
    rangeMin +
    ((value - domainMin) / span) * (rangeMax - rangeMin)
  );
}

function paddedBounds(values: readonly number[]) {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const span = maximum - minimum;
  const padding = span > 0 ? span * 0.12 : Math.max(1, Math.abs(maximum) * 0.2);
  return [minimum - padding, maximum + padding] as const;
}

function lineGeometry(
  values: readonly number[],
  x: number,
  y: number,
  width: number,
  height: number,
  extraValues: readonly number[] = [],
) {
  const [minimum, maximum] = paddedBounds([...values, ...extraValues]);
  const points = values.map((value, index) => ({
    x:
      x +
      (index / Math.max(1, values.length - 1)) *
        width,
    y: scale(value, minimum, maximum, y + height, y),
  }));
  return {
    points,
    path: points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
      )
      .join(" "),
    yFor: (value: number) =>
      scale(value, minimum, maximum, y + height, y),
  };
}

function ChartFrame({
  xLabel,
  yLabel,
}: {
  xLabel: string;
  yLabel: string;
}) {
  return (
    <g>
      <path d="M54 28V218H606" stroke={GRID} strokeWidth="1" />
      {[66, 104, 142, 180].map((y) => (
        <path
          d={`M54 ${y}H606`}
          key={y}
          stroke={GRID}
          strokeDasharray="3 6"
        />
      ))}
      <text x="500" y="241" fill={MUTED} fontSize="10">
        {xLabel}
      </text>
      <text x="14" y="20" fill={MUTED} fontSize="10">
        {yLabel}
      </text>
    </g>
  );
}

function FormulaNode({
  x,
  y,
  width,
  title,
  value,
  accent = BLUE,
}: {
  x: number;
  y: number;
  width: number;
  title: string;
  value: string;
  accent?: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height="64"
        rx="5"
        fill={PANEL}
        stroke={accent}
      />
      <text x={x + 12} y={y + 22} fill={MUTED} fontSize="10">
        {title}
      </text>
      <text
        x={x + 12}
        y={y + 45}
        fill={INK}
        fontSize="13"
        fontWeight="700"
      >
        {value}
      </text>
    </g>
  );
}

function PrerequisiteView({ observation }: ObservationViewProps) {
  const x = numberMetric(observation, "x");
  const u = numberMetric(observation, "u");
  const y = numberMetric(observation, "y");
  const outer = numberMetric(observation, "outerDerivative");
  const inner = numberMetric(observation, "innerDerivative");
  const derivative = numberMetric(observation, "derivative");
  const rows = numberMetric(observation, "batchRows");
  const features = numberMetric(observation, "batchFeatures");
  const baseline = numberMetric(observation, "majorityBaseline");

  return (
    <>
      <text x="38" y="25" fill={MUTED} fontSize="10">
        forward values
      </text>
      <FormulaNode
        x={38}
        y={42}
        width={142}
        title="INPUT"
        value={`x = ${formatNumber(x)}`}
      />
      <path d="M180 74H244" stroke={BLUE} strokeWidth="2" />
      <text x="190" y="64" fill={MUTED} fontSize="10">
        2x + 1
      </text>
      <FormulaNode
        x={244}
        y={42}
        width={142}
        title="INNER"
        value={`u = ${formatNumber(u)}`}
      />
      <path d="M386 74H450" stroke={BLUE} strokeWidth="2" />
      <text x="407" y="64" fill={MUTED} fontSize="10">
        u^2
      </text>
      <FormulaNode
        x={450}
        y={42}
        width={152}
        title="OUTPUT"
        value={`y = ${formatNumber(y)}`}
        accent={GREEN}
      />

      <path
        d="M526 119C470 166 186 166 109 119"
        fill="none"
        stroke={CORAL}
        strokeWidth="2"
        strokeDasharray="5 4"
      />
      <text x="190" y="151" fill={CORAL} fontSize="10">
        dy/dx = {formatNumber(outer)} x {formatNumber(inner)} ={" "}
        {formatNumber(derivative)}
      </text>

      <rect x="38" y="189" width="252" height="42" rx="4" fill={PANEL} />
      <text x="53" y="207" fill={MUTED} fontSize="10">
        FIXED BATCH SHAPE
      </text>
      <text x="53" y="224" fill={INK} fontSize="11" fontWeight="700">
        {rows} rows x {features} features
      </text>
      <rect x="310" y="189" width="292" height="42" rx="4" fill={PANEL} />
      <text x="325" y="207" fill={MUTED} fontSize="10">
        FIXED MAJORITY BASELINE
      </text>
      <text x="325" y="224" fill={INK} fontSize="11" fontWeight="700">
        {formatPercent(baseline, 0)}
      </text>
    </>
  );
}

function DataBaselineView({ observation }: ObservationViewProps) {
  const parameter = numberMetric(observation, "parameter");
  const feature = numberMetric(observation, "fixedFeature");
  const bias = numberMetric(observation, "fixedBias");
  const target = numberMetric(observation, "fixedTarget");
  const prediction = numberMetric(observation, "prediction");
  const residual = numberMetric(observation, "residual");
  const meanBaseline = numberMetric(observation, "meanBaseline");
  const comparisonDomain = numberArrayMetric(
    observation,
    "comparisonDomain",
  );

  const [minimum, maximum] = paddedBounds(comparisonDomain);
  const yFor = (value: number) =>
    scale(value, minimum, maximum, 210, 58);

  return (
    <>
      <text x="40" y="26" fill={MUTED} fontSize="10">
        fitted rule
      </text>
      <FormulaNode
        x={40}
        y={44}
        width={152}
        title="FIXED FEATURE"
        value={`x = ${formatNumber(feature)}`}
      />
      <path d="M192 76H239" stroke={BLUE} strokeWidth="2" />
      <text x="199" y="66" fill={BLUE} fontSize="10">
        x w={formatNumber(parameter)}
      </text>
      <FormulaNode
        x={239}
        y={44}
        width={152}
        title="FIXED BIAS"
        value={`+ ${formatNumber(bias)}`}
      />
      <path d="M391 76H438" stroke={BLUE} strokeWidth="2" />
      <FormulaNode
        x={438}
        y={44}
        width={162}
        title="PREDICTION"
        value={formatNumber(prediction)}
        accent={GREEN}
      />

      <path d="M78 210H599" stroke={GRID} />
      {[
        ["prediction", prediction, BLUE],
        ["target", target, CORAL],
        ["mean baseline", meanBaseline, YELLOW],
      ].map(([label, rawValue, color]) => {
        const value = Number(rawValue);
        const y = yFor(value);
        return (
          <g key={String(label)}>
            <path
              d={`M78 ${y}H599`}
              stroke={String(color)}
              strokeWidth="2"
              strokeDasharray={label === "prediction" ? undefined : "5 4"}
              data-testid={
                label === "mean baseline"
                  ? "mean-baseline-reference"
                  : undefined
              }
              data-y={y}
            />
            <text x="82" y={y - 6} fill={String(color)} fontSize="10">
              {label} {formatNumber(value)}
            </text>
          </g>
        );
      })}
      <path
        d={`M568 ${yFor(prediction)}V${yFor(target)}`}
        stroke={CORAL}
        strokeWidth="4"
      />
      <text x="475" y="239" fill={CORAL} fontSize="10">
        residual {formatNumber(residual)}
      </text>
    </>
  );
}

function LinearModelView({ observation }: ObservationViewProps) {
  const weight = numberMetric(observation, "weight");
  const bias = numberMetric(observation, "bias");
  const inputs = numberArrayMetric(observation, "inputs");
  const predictions = numberArrayMetric(observation, "predictions");
  const predictionDomain = numberArrayMetric(
    observation,
    "predictionDomain",
  );
  const xMin = Math.min(...inputs);
  const xMax = Math.max(...inputs);
  const [yMin, yMax] = paddedBounds(predictionDomain);
  const xFor = (value: number) => scale(value, xMin, xMax, 74, 584);
  const yFor = (value: number) => scale(value, yMin, yMax, 210, 42);
  const ordered = inputs
    .map((input, index) => ({
      input,
      prediction: predictions[index],
    }))
    .sort((left, right) => left.input - right.input);
  const start = ordered[0];
  const end = ordered.at(-1) ?? start;
  const startY = yFor(start.prediction);
  const endY = yFor(end.prediction);

  return (
    <>
      <ChartFrame xLabel="fixed input x" yLabel="prediction y-hat" />
      <path
        d={`M${xFor(start.input)} ${startY}L${xFor(end.input)} ${endY}`}
        stroke={BLUE}
        strokeWidth="3"
        data-testid="linear-prediction-line"
        data-slope={weight}
        data-start-y={startY}
        data-end-y={endY}
        aria-label={`Prediction line with slope ${formatNumber(weight)}`}
      />
      {ordered.map(({ input, prediction }) => (
        <g key={input}>
          <circle
            cx={xFor(input)}
            cy={yFor(prediction)}
            r="7"
            fill={GREEN}
          />
          <text
            x={xFor(input) + 9}
            y={yFor(prediction) - 8}
            fill={INK}
            fontSize="10"
          >
            ({formatNumber(input)}, {formatNumber(prediction)})
          </text>
        </g>
      ))}
      <path
        d={`M${xFor(0) - 7} ${yFor(bias)}H${xFor(0) + 7}`}
        stroke={YELLOW}
        strokeWidth="3"
      />
      <text x="72" y="35" fill={BLUE} fontSize="11" fontWeight="700">
        y-hat = {formatNumber(weight)}x + {formatNumber(bias)}
      </text>
    </>
  );
}

function LossLandscapeView({ observation }: ObservationViewProps) {
  const weight = numberMetric(observation, "weight");
  const bias = numberMetric(observation, "bias");
  const predictions = numberArrayMetric(observation, "predictions");
  const residuals = numberArrayMetric(observation, "residuals");
  const squares = numberArrayMetric(observation, "squares");
  const mse = numberMetric(observation, "mse");
  const landscapeWeights = numberArrayMetric(
    observation,
    "landscapeWeights",
  );
  const landscapeLosses = numberArrayMetric(
    observation,
    "landscapeLosses",
  );
  const landscapeLossMax = numberMetric(
    observation,
    "landscapeLossMax",
  );
  const squareScaleMax = numberMetric(
    observation,
    "squareScaleMax",
  );
  const weightMin = landscapeWeights[0];
  const weightMax = landscapeWeights.at(-1) ?? weightMin;
  const landscapeXFor = (value: number) =>
    scale(value, weightMin, weightMax, 44, 306);
  const landscapeYFor = (value: number) =>
    scale(value, 0, landscapeLossMax, 210, 48);
  const landscapePath = landscapeWeights
    .map(
      (candidateWeight, index) =>
        `${index === 0 ? "M" : "L"} ${landscapeXFor(candidateWeight).toFixed(2)} ${landscapeYFor(landscapeLosses[index]).toFixed(2)}`,
    )
    .join(" ");
  const currentX = landscapeXFor(weight);
  const currentY = landscapeYFor(mse);

  return (
    <>
      <text x="38" y="26" fill={BLUE} fontSize="11" fontWeight="700">
        y-hat = {formatNumber(weight)}x + {formatNumber(bias)}
      </text>
      <text x="500" y="26" fill={YELLOW} fontSize="11" fontWeight="700">
        MSE = {formatNumber(mse)}
      </text>
      <path
        d="M44 48V210H306"
        fill="none"
        stroke={GRID}
        strokeWidth="1"
        data-testid="loss-landscape-axes"
      />
      {[102, 156].map((y) => (
        <path
          key={y}
          d={`M44 ${y}H306`}
          fill="none"
          stroke={GRID}
          strokeDasharray="3 6"
        />
      ))}
      <text x="44" y="40" fill={MUTED} fontSize="10">
        MSE
      </text>
      <text x="255" y="239" fill={MUTED} fontSize="10">
        weight w
      </text>
      <text x="42" y="226" fill={MUTED} fontSize="9">
        {formatNumber(weightMin)}
      </text>
      <text x="296" y="226" fill={MUTED} fontSize="9">
        {formatNumber(weightMax)}
      </text>
      <path
        d={landscapePath}
        fill="none"
        stroke={BLUE}
        strokeWidth="3"
        data-testid="loss-landscape-curve"
      />
      <path
        d={`M${currentX} 210V${currentY}`}
        fill="none"
        stroke={GREEN}
        strokeWidth="1"
        strokeDasharray="3 4"
        data-testid="loss-landscape-current-guide"
      />
      <circle
        cx={currentX}
        cy={currentY}
        r="7"
        fill={GREEN}
        stroke={PANEL}
        strokeWidth="2"
        data-testid="loss-landscape-current"
        data-weight={weight}
        data-mse={mse}
        aria-label={`Current landscape point at weight ${formatNumber(weight)} and MSE ${formatNumber(mse)}`}
      />
      {predictions.map((prediction, index) => {
        const x = 330 + index * 98;
        const height = 68 * (squares[index] / squareScaleMax);
        return (
          <g key={index}>
            <rect
              x={x}
              y="48"
              width="88"
              height="172"
              rx="4"
              fill={PANEL}
              stroke={GRID}
            />
            <text x={x + 11} y="68" fill={MUTED} fontSize="9">
              ROW {index + 1}
            </text>
            <text x={x + 11} y="88" fill={INK} fontSize="9">
              y-hat {formatNumber(prediction)}
            </text>
            <text x={x + 11} y="106" fill={CORAL} fontSize="9">
              r {formatNumber(residuals[index])}
            </text>
            <text x={x + 11} y="124" fill={YELLOW} fontSize="9">
              r^2 {formatNumber(squares[index])}
            </text>
            <rect
              x={x + 11}
              y={210 - height}
              width="18"
              height={height}
              fill={CORAL}
              opacity="0.72"
              data-testid={`loss-square-${index}`}
              data-square={squares[index]}
              data-height={height}
              aria-label={`Row ${index + 1} squared residual ${formatNumber(squares[index])}`}
            />
          </g>
        );
      })}
    </>
  );
}

function GradientDescentView({ observation }: ObservationViewProps) {
  const learningRate = numberMetric(observation, "learningRate");
  const initialWeight = numberMetric(observation, "initialWeight");
  const steps = numberMetric(observation, "steps");
  const finalWeight = numberMetric(observation, "finalWeight");
  const finalLoss = numberMetric(observation, "finalLoss");
  const finalGradient = numberMetric(observation, "finalGradient");
  const losses = numberArrayMetric(observation, "lossTrace");
  const geometry = lineGeometry(losses, 62, 45, 532, 155);
  const first = geometry.points[0];
  const last = geometry.points.at(-1) ?? first;

  return (
    <>
      <ChartFrame xLabel={`0 to ${steps} updates`} yLabel="batch MSE" />
      <path
        d={geometry.path}
        fill="none"
        stroke={BLUE}
        strokeWidth="3"
        data-testid="gradient-loss-trace"
        data-values={losses.join(",")}
      />
      <circle cx={first.x} cy={first.y} r="6" fill={YELLOW} />
      <circle cx={last.x} cy={last.y} r="7" fill={GREEN} />
      <text x="72" y="34" fill={BLUE} fontSize="10">
        learning rate {formatNumber(learningRate)}
      </text>
      <text x="315" y="34" fill={MUTED} fontSize="10">
        w: {formatNumber(initialWeight)} to {formatNumber(finalWeight, 6)}
      </text>
      <text x="407" y="233" fill={GREEN} fontSize="10">
        loss {formatNumber(finalLoss, 6)} / next gradient{" "}
        {formatNumber(finalGradient, 6)}
      </text>
    </>
  );
}

function SplitLeakageView({ observation }: ObservationViewProps) {
  const source = stringMetric(observation, "selectionSource");
  const candidatePredictions = numberArrayMetric(
    observation,
    "candidatePredictions",
  );
  const selectedPrediction = numberMetric(
    observation,
    "selectedPrediction",
  );
  const selectionLoss = numberMetric(observation, "selectionLoss");
  const finalTestLoss = numberMetric(observation, "finalTestLoss");
  const testIndependent = numberMetric(observation, "testIndependent");
  const candidateCount = numberMetric(observation, "candidateCount");
  const leaking = testIndependent === 0;

  return (
    <>
      <text x="38" y="25" fill={MUTED} fontSize="10">
        {candidateCount} fixed prediction candidates
      </text>
      <FormulaNode
        x={38}
        y={45}
        width={150}
        title="AUTHORED CANDIDATES"
        value={candidatePredictions.map(formatNumber).join(" / ")}
      />
      <path d="M188 77H245" stroke={BLUE} strokeWidth="2" />
      <FormulaNode
        x={245}
        y={45}
        width={158}
        title={`${source.toUpperCase()} SELECTS`}
        value={`y-hat = ${formatNumber(selectedPrediction)}`}
        accent={leaking ? CORAL : YELLOW}
      />
      <path d="M403 77H460" stroke={leaking ? CORAL : GREEN} strokeWidth="2" />
      <FormulaNode
        x={460}
        y={45}
        width={142}
        title="FINAL TEST"
        value={leaking ? "reused" : "independent"}
        accent={leaking ? CORAL : GREEN}
      />

      <rect x="38" y="139" width="267" height="72" rx="4" fill={PANEL} />
      <text x="54" y="163" fill={MUTED} fontSize="10">
        SELECTION LOSS
      </text>
      <text x="54" y="190" fill={YELLOW} fontSize="15" fontWeight="700">
        {formatNumber(selectionLoss)}
      </text>
      <rect x="325" y="139" width="277" height="72" rx="4" fill={PANEL} />
      <text x="341" y="163" fill={MUTED} fontSize="10">
        REPORTED TEST LOSS
      </text>
      <text
        x="341"
        y="190"
        fill={leaking ? CORAL : GREEN}
        fontSize="15"
        fontWeight="700"
      >
        {formatNumber(finalTestLoss)}
      </text>
      <text x="38" y="239" fill={leaking ? CORAL : GREEN} fontSize="10">
        {leaking
          ? "test result fed selection, so independence = 0"
          : "test result stayed outside selection, so independence = 1"}
      </text>
    </>
  );
}

function CapacityCurvesView({ observation }: ObservationViewProps) {
  const degree = numberMetric(observation, "degree");
  const smallRows = numberMetric(observation, "smallRowCount");
  const largeRows = numberMetric(observation, "largeRowCount");
  const values = [
    numberMetric(observation, "smallTrainLoss"),
    numberMetric(observation, "smallValidationLoss"),
    numberMetric(observation, "largeTrainLoss"),
    numberMetric(observation, "largeProbeLoss"),
  ];
  const labels = ["train", "validation", "train", "probe"];
  const groups = [`${smallRows}-row fit`, `${largeRows}-row fit`];
  const transformed = values.map((value) => Math.log10(1 + value));
  const maximum = Math.max(0.001, ...transformed);

  return (
    <>
      <text x="38" y="27" fill={BLUE} fontSize="11" fontWeight="700">
        polynomial degree {degree}
      </text>
      {groups.map((group, groupIndex) => (
        <g key={group}>
          <rect
            x={38 + groupIndex * 294}
            y="45"
            width="274"
            height="177"
            rx="4"
            fill={PANEL}
            stroke={GRID}
          />
          <text
            x={54 + groupIndex * 294}
            y="68"
            fill={INK}
            fontSize="10"
            fontWeight="700"
          >
            {group}
          </text>
          {[0, 1].map((offset) => {
            const index = groupIndex * 2 + offset;
            const height = (transformed[index] / maximum) * 100;
            const x = 82 + groupIndex * 294 + offset * 112;
            return (
              <g key={labels[index]}>
                <rect
                  x={x}
                  y={190 - Math.max(2, height)}
                  width="50"
                  height={Math.max(2, height)}
                  fill={offset === 0 ? BLUE : CORAL}
                  opacity="0.78"
                />
                <text x={x - 4} y="207" fill={MUTED} fontSize="10">
                  {labels[index]}
                </text>
                <text x={x - 4} y={181 - Math.max(2, height)} fill={INK} fontSize="10">
                  {formatNumber(values[index])}
                </text>
              </g>
            );
          })}
        </g>
      ))}
      <text x="441" y="243" fill={MUTED} fontSize="10">
        bar height uses log(1 + loss)
      </text>
    </>
  );
}

function LogisticLinkView({ observation }: ObservationViewProps) {
  const bias = numberMetric(observation, "biasContribution");
  const feature = numberMetric(
    observation,
    "fixedFeatureContribution",
  );
  const logit = numberMetric(observation, "logit");
  const probability = numberMetric(observation, "probability");
  const lossOne = numberMetric(observation, "lossTargetOne");
  const lossZero = numberMetric(observation, "lossTargetZero");
  const extent = Math.max(4, Math.ceil(Math.abs(logit)));
  const samples = Array.from({ length: 49 }, (_, index) => {
    const sampleLogit = -extent + (index / 48) * extent * 2;
    return 1 / (1 + Math.exp(-sampleLogit));
  });
  const sigmoid = lineGeometry(samples, 58, 48, 360, 157, [0, 1]);
  const pointX = scale(logit, -extent, extent, 58, 418);
  const pointY = scale(probability, 0, 1, 205, 48);
  const maximumLoss = Math.max(1, lossOne, lossZero);

  return (
    <>
      <path
        d="M58 38V211H426"
        fill="none"
        stroke={GRID}
        data-testid="logistic-link-axes"
      />
      <path
        d={sigmoid.path}
        fill="none"
        stroke={BLUE}
        strokeWidth="3"
      />
      <path
        d={`M${pointX} 211V${pointY}H58`}
        fill="none"
        stroke={CORAL}
        strokeDasharray="4 4"
        data-testid="logistic-link-current-guide"
      />
      <circle cx={pointX} cy={pointY} r="7" fill={CORAL} />
      <text x="63" y="30" fill={BLUE} fontSize="10">
        sigmoid({formatNumber(logit)}) = {formatNumber(probability)}
      </text>
      <text x="60" y="230" fill={MUTED} fontSize="10">
        feature {formatNumber(feature)} + bias {formatNumber(bias)} = logit{" "}
        {formatNumber(logit)}
      </text>

      <rect x="454" y="48" width="148" height="163" rx="4" fill={PANEL} />
      {[
        ["loss y=1", lossOne, GREEN],
        ["loss y=0", lossZero, CORAL],
      ].map(([label, rawValue, color], index) => {
        const value = Number(rawValue);
        const height = (value / maximumLoss) * 85;
        return (
          <g key={String(label)}>
            <rect
              x={476 + index * 60}
              y={174 - height}
              width="32"
              height={Math.max(2, height)}
              fill={String(color)}
            />
            <text x={466 + index * 60} y="194" fill={MUTED} fontSize="10">
              {label}
            </text>
            <text x={469 + index * 60} y={165 - height} fill={INK} fontSize="10">
              {formatNumber(value)}
            </text>
          </g>
        );
      })}
    </>
  );
}

function DecisionCostsView({ observation }: ObservationViewProps) {
  const threshold = numberMetric(observation, "threshold");
  const scoreCount = numberMetric(observation, "scoreCount");
  const tp = numberMetric(observation, "tp");
  const fp = numberMetric(observation, "fp");
  const tn = numberMetric(observation, "tn");
  const fn = numberMetric(observation, "fn");
  const precision = numberMetric(observation, "precision");
  const recall = numberMetric(observation, "recall");
  const cost = numberMetric(observation, "weightedCost");
  const cells = [
    ["TP", tp, GREEN, 190, 72],
    ["FN", fn, CORAL, 352, 72],
    ["FP", fp, CORAL, 190, 143],
    ["TN", tn, GREEN, 352, 143],
  ] as const;

  return (
    <>
      <text x="38" y="26" fill={BLUE} fontSize="11" fontWeight="700">
        threshold {formatNumber(threshold)} across {scoreCount} fixed scores
      </text>
      <text x="235" y="52" fill={MUTED} fontSize="10">
        predicted positive
      </text>
      <text x="397" y="52" fill={MUTED} fontSize="10">
        predicted negative
      </text>
      <text x="54" y="108" fill={MUTED} fontSize="10">
        actual positive
      </text>
      <text x="54" y="179" fill={MUTED} fontSize="10">
        actual negative
      </text>
      {cells.map(([label, value, color, x, y]) => (
        <g key={label}>
          <rect
            x={x}
            y={y}
            width="145"
            height="57"
            rx="4"
            fill={PANEL}
            stroke={color}
          />
          <text x={x + 16} y={y + 23} fill={color} fontSize="10">
            {label}
          </text>
          <text x={x + 105} y={y + 39} fill={INK} fontSize="20" fontWeight="700">
            {value}
          </text>
        </g>
      ))}
      <text x="190" y="231" fill={INK} fontSize="10">
        precision {formatNumber(precision)} / recall {formatNumber(recall)}
      </text>
      <text x="465" y="231" fill={YELLOW} fontSize="10" fontWeight="700">
        cost {formatNumber(cost)}
      </text>
    </>
  );
}

function FeaturePipelineView({ observation }: ObservationViewProps) {
  const incoming = numberMetric(observation, "incomingTemperature");
  const mean = numberMetric(observation, "trainingMean");
  const trainingScale = numberMetric(observation, "trainingScale");
  const missing = numberMetric(observation, "missingIndicator");
  const day = numberMetric(observation, "dayIndicator");
  const night = numberMetric(observation, "nightIndicator");
  const scaled = numberMetric(observation, "scaledTemperature");
  const vector = numberArrayMetric(observation, "outputVector");
  const stages = [
    ["RAW ROW", `temp ${formatNumber(incoming)}`],
    ["FROZEN SCALE", `(${formatNumber(incoming)} - ${formatNumber(mean)}) / ${formatNumber(trainingScale)}`],
    ["FEATURES", `scaled ${formatNumber(scaled)}`],
    ["MODEL VECTOR", `[${vector.map((value) => formatNumber(value)).join(", ")}]`],
  ] as const;

  return (
    <>
      {stages.map(([label, detail], index) => {
        const x = 25 + index * 155;
        return (
          <g key={label}>
            <rect
              x={x}
              y="61"
              width="132"
              height="100"
              rx="5"
              fill={PANEL}
              stroke={index === stages.length - 1 ? GREEN : BLUE}
            />
            <text x={x + 11} y="84" fill={MUTED} fontSize="10" fontWeight="700">
              {label}
            </text>
            <text x={x + 11} y="116" fill={INK} fontSize="10">
              {detail}
            </text>
            {index < stages.length - 1 && (
              <path d={`M${x + 132} 111H${x + 151}`} stroke={BLUE} strokeWidth="2" />
            )}
          </g>
        );
      })}
      <rect x="25" y="184" width="590" height="44" rx="4" fill="#1d2026" />
      <text x="41" y="202" fill={MUTED} fontSize="10">
        FIXED FEATURE POSITIONS
      </text>
      <text x="41" y="219" fill={INK} fontSize="10">
        scaled temp {formatNumber(scaled)} / missing {missing} / day {day} / night{" "}
        {night}
      </text>
    </>
  );
}

function KnnTreeView({ observation }: ObservationViewProps) {
  const query = numberMetric(observation, "query");
  const k = numberMetric(observation, "k");
  const neighbors = numberArrayMetric(observation, "neighbors");
  const knnLabel = numberMetric(observation, "knnLabel");
  const threshold = numberMetric(observation, "treeThreshold");
  const treeLabel = numberMetric(observation, "treeLabel");
  const [minimum, maximum] = paddedBounds([
    query,
    threshold,
    ...neighbors,
  ]);
  const xFor = (value: number) =>
    scale(value, minimum, maximum, 70, 578);

  return (
    <>
      <text x="38" y="27" fill={BLUE} fontSize="11" fontWeight="700">
        same query, two fitted rules
      </text>
      <path d="M70 112H578" stroke={GRID} strokeWidth="3" />
      {neighbors.map((neighbor, index) => (
        <g key={`${neighbor}-${index}`}>
          <circle
            cx={xFor(neighbor)}
            cy="112"
            r={18 - index * 3}
            fill="none"
            stroke={GREEN}
            strokeWidth="2"
          />
          <text x={xFor(neighbor) - 8} y="146" fill={GREEN} fontSize="10">
            {formatNumber(neighbor)}
          </text>
        </g>
      ))}
      <path
        d={`M${xFor(threshold)} 65V176`}
        stroke={YELLOW}
        strokeWidth="3"
        strokeDasharray="5 4"
      />
      <text x={xFor(threshold) + 7} y="72" fill={YELLOW} fontSize="10">
        tree split {formatNumber(threshold)}
      </text>
      <path d={`M${xFor(query)} 77V112`} stroke={CORAL} strokeWidth="4" />
      <circle cx={xFor(query)} cy="112" r="7" fill={CORAL} />
      <text x={xFor(query) - 27} y="64" fill={CORAL} fontSize="10">
        query {formatNumber(query)}
      </text>
      <rect x="70" y="190" width="238" height="43" rx="4" fill={PANEL} />
      <text x="85" y="216" fill={INK} fontSize="10">
        {k}-NN neighbors [{neighbors.join(", ")}] -&gt; class {knnLabel}
      </text>
      <rect x="328" y="190" width="250" height="43" rx="4" fill={PANEL} />
      <text x="343" y="216" fill={INK} fontSize="10">
        tree x &lt; {formatNumber(threshold)} / x &gt;= {formatNumber(threshold)} -&gt; class{" "}
        {treeLabel}
      </text>
    </>
  );
}

function RegularizationView({ observation }: ObservationViewProps) {
  const penalty = numberMetric(observation, "penalty");
  const numerator = numberMetric(observation, "numerator");
  const squaredSum = numberMetric(observation, "squaredInputSum");
  const weight = numberMetric(observation, "weight");
  const trainLoss = numberMetric(observation, "trainingLoss");
  const foldLoss = numberMetric(observation, "meanFoldLoss");
  const foldCount = numberMetric(observation, "foldCount");
  const coefficientWidth = clamp(Math.abs(weight) / 2, 0, 1) * 220;
  const maxLoss = Math.max(1, trainLoss, foldLoss);

  return (
    <>
      <text x="38" y="27" fill={BLUE} fontSize="11" fontWeight="700">
        ridge coefficient
      </text>
      <FormulaNode
        x={38}
        y={49}
        width={342}
        title="CLOSED-FORM FIT"
        value={`${formatNumber(numerator)} / (${formatNumber(squaredSum)} + ${formatNumber(penalty)}) = ${formatNumber(weight)}`}
      />
      <path d="M65 151H334" stroke={GRID} strokeWidth="2" />
      <path d="M198 137V166" stroke={MUTED} />
      <rect
        x={weight >= 0 ? 198 : 198 - coefficientWidth}
        y="143"
        width={coefficientWidth}
        height="16"
        fill={weight >= 0 ? BLUE : CORAL}
      />
      <text x="149" y="181" fill={MUTED} fontSize="10">
        coefficient zero
      </text>

      <rect x="410" y="49" width="192" height="151" rx="4" fill={PANEL} />
      {[
        ["train MSE", trainLoss, BLUE],
        [`${foldCount}-fold mean`, foldLoss, CORAL],
      ].map(([label, rawValue, color], index) => {
        const value = Number(rawValue);
        const width = (value / maxLoss) * 128;
        return (
          <g key={String(label)}>
            <text x="426" y={80 + index * 58} fill={MUTED} fontSize="10">
              {label}
            </text>
            <rect
              x="426"
              y={90 + index * 58}
              width={Math.max(2, width)}
              height="13"
              fill={String(color)}
            />
            <text x="562" y={101 + index * 58} fill={INK} fontSize="10">
              {formatNumber(value)}
            </text>
          </g>
        );
      })}
      <text x="38" y="229" fill={MUTED} fontSize="10">
        only lambda = {formatNumber(penalty)} changes the denominator
      </text>
    </>
  );
}

function EnsembleVotesView({ observation }: ObservationViewProps) {
  const correlation = numberMetric(observation, "correlation");
  const learnerCount = numberMetric(observation, "learnerCount");
  const individualVariance = numberMetric(
    observation,
    "individualVariance",
  );
  const ensembleVariance = numberMetric(
    observation,
    "ensembleVariance",
  );
  const ensembleDeviation = numberMetric(
    observation,
    "ensembleStandardDeviation",
  );
  const centerX = 506;
  const centerY = 131;

  return (
    <>
      <text x="36" y="27" fill={BLUE} fontSize="11" fontWeight="700">
        {learnerCount} fixed learners
      </text>
      <text x="384" y="27" fill={MUTED} fontSize="10">
        pairwise error correlation {formatNumber(correlation)}
      </text>
      {Array.from({ length: learnerCount }, (_, index) => {
        const column = index % 5;
        const row = Math.floor(index / 5);
        const x = 54 + column * 72;
        const y = 76 + row * 83;
        return (
          <g key={index} data-ensemble-learner={index + 1}>
            <circle
              cx={x}
              cy={y}
              r="22"
              fill={PANEL}
              stroke={BLUE}
            />
            <text x={x - 11} y={y + 4} fill={INK} fontSize="10">
              m{index + 1}
            </text>
            <path
              d={`M${x + 22} ${y}L${centerX - 49} ${centerY}`}
              stroke={correlation > 0.5 ? CORAL : GREEN}
              strokeWidth={1 + correlation * 3}
              opacity={0.24 + correlation * 0.56}
            />
          </g>
        );
      })}
      <circle cx={centerX} cy={centerY} r="48" fill="#263852" stroke={GREEN} />
      <text x={centerX - 25} y={centerY - 6} fill={MUTED} fontSize="10">
        MEAN
      </text>
      <text x={centerX - 33} y={centerY + 13} fill={INK} fontSize="10">
        variance
      </text>
      <text x={centerX - 25} y={centerY + 31} fill={GREEN} fontSize="13" fontWeight="700">
        {formatNumber(ensembleVariance)}
      </text>
      <text x="391" y="214" fill={MUTED} fontSize="10">
        individual variance {formatNumber(individualVariance)}
      </text>
      <text x="391" y="233" fill={INK} fontSize="10">
        mean standard deviation {formatNumber(ensembleDeviation)}
      </text>
    </>
  );
}

function XorHiddenView({ observation }: ObservationViewProps) {
  const strength = numberMetric(observation, "strength");
  const caseCount = numberMetric(observation, "caseCount");
  const hidden = [
    numberArrayMetric(observation, "hidden00"),
    numberArrayMetric(observation, "hidden10"),
    numberArrayMetric(observation, "hidden01"),
    numberArrayMetric(observation, "hidden11"),
  ];
  const scores = numberArrayMetric(observation, "scores");
  const targets = numberArrayMetric(observation, "targets");
  const predictions = numberArrayMetric(observation, "predictions");
  const threshold = numberMetric(observation, "threshold");
  const names = ["00", "10", "01", "11"];
  const xFor = (value: number) => scale(value, 0, 1, 82, 390);
  const yFor = (value: number) => scale(value, 0, 1, 213, 48);

  return (
    <>
      <text x="38" y="25" fill={BLUE} fontSize="11" fontWeight="700">
        {caseCount} XOR cases / hidden transform {formatNumber(strength)}
      </text>
      <path d="M82 38V213H407" stroke={GRID} />
      <text x="367" y="232" fill={MUTED} fontSize="10">h1</text>
      <text x="58" y="46" fill={MUTED} fontSize="10">h2</text>
      {hidden.map(([h1, h2], index) => (
        <g
          key={names[index]}
          data-hidden-case={names[index]}
          data-hidden-x={h1}
          data-hidden-y={h2}
        >
          <circle
            cx={xFor(h1)}
            cy={yFor(h2)}
            r={9 + index * 2}
            fill={targets[index] === 1 ? GREEN : CORAL}
            fillOpacity="0.32"
            stroke={
              predictions[index] === targets[index] ? GREEN : YELLOW
            }
            strokeWidth="3"
          />
          <text
            x={xFor(h1) + 13}
            y={yFor(h2) - 7 - index * 3}
            fill={INK}
            fontSize="10"
          >
            {names[index]} ({formatNumber(h1)}, {formatNumber(h2)})
          </text>
        </g>
      ))}
      <rect x="438" y="48" width="164" height="165" rx="4" fill={PANEL} />
      <text x="454" y="72" fill={MUTED} fontSize="10">
        SCORE / FIXED TARGET / PREDICTION
      </text>
      {scores.map((score, index) => (
        <text
          key={names[index]}
          x="454"
          y={99 + index * 25}
          fill={
            predictions[index] === targets[index] ? GREEN : YELLOW
          }
          fontSize="10"
        >
          {names[index]}: {formatNumber(score)} / {targets[index]} /{" "}
          {predictions[index]}
        </text>
      ))}
      <text x="454" y="203" fill={MUTED} fontSize="10">
        threshold {formatNumber(threshold)}; color fill = target
      </text>
    </>
  );
}

function BackpropGraphView({ observation }: ObservationViewProps) {
  const input = numberMetric(observation, "input");
  const weight = numberMetric(observation, "weight");
  const bias = numberMetric(observation, "bias");
  const target = numberMetric(observation, "target");
  const productBranch = numberMetric(observation, "productBranch");
  const squareBranch = numberMetric(observation, "squareBranch");
  const prediction = numberMetric(observation, "prediction");
  const residual = numberMetric(observation, "residual");
  const loss = numberMetric(observation, "loss");
  const productLocal = numberMetric(
    observation,
    "productLocalDerivative",
  );
  const squareLocal = numberMetric(
    observation,
    "squareLocalDerivative",
  );
  const productContribution = numberMetric(
    observation,
    "productContribution",
  );
  const squareContribution = numberMetric(
    observation,
    "squareContribution",
  );
  const totalGradient = numberMetric(observation, "totalGradient");

  const graphNode = (
    x: number,
    y: number,
    width: number,
    title: string,
    value: string,
    accent = BLUE,
  ) => (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height="42"
        rx="4"
        fill={PANEL}
        stroke={accent}
      />
      <text x={x + 9} y={y + 16} fill={MUTED} fontSize="8">
        {title}
      </text>
      <text x={x + 9} y={y + 33} fill={INK} fontSize="10">
        {value}
      </text>
    </g>
  );

  return (
    <>
      <text x="38" y="25" fill={BLUE} fontSize="11" fontWeight="700">
        one shared w / two forward routes / one accumulated gradient
      </text>
      <path d="M105 58H168" stroke={MUTED} strokeWidth="2" />
      <path d="M105 58C135 58 137 132 168 132" stroke={MUTED} strokeWidth="2" fill="none" />
      <path d="M105 137C135 137 137 79 168 79" stroke={MUTED} strokeWidth="2" fill="none" />
      <path d="M268 79H330" stroke={MUTED} strokeWidth="2" />
      <path d="M268 132C301 132 301 101 330 101" stroke={MUTED} strokeWidth="2" fill="none" />
      <path d="M377 174V125" stroke={MUTED} strokeWidth="2" />
      <path d="M430 101H500" stroke={MUTED} strokeWidth="2" />

      {graphNode(32, 37, 73, "SHARED w", formatNumber(weight), YELLOW)}
      {graphNode(32, 116, 73, "INPUT x", formatNumber(input))}
      {graphNode(168, 58, 100, "p = w * x", formatNumber(productBranch))}
      {graphNode(168, 111, 100, "q = w^2", formatNumber(squareBranch))}
      {graphNode(330, 80, 100, "y-hat = p+q+b", formatNumber(prediction))}
      {graphNode(330, 153, 94, "BIAS b", formatNumber(bias))}
      {graphNode(500, 80, 106, "LOSS", formatNumber(loss), CORAL)}
      <text x="510" y="139" fill={MUTED} fontSize="9">
        target {formatNumber(target)} / residual {formatNumber(residual)}
      </text>

      <path
        d="M498 154C440 184 292 184 266 153"
        fill="none"
        stroke={CORAL}
        strokeDasharray="5 4"
      />
      <text x="34" y="211" fill={INK} fontSize="9">
        product path: {formatNumber(residual)} x {formatNumber(productLocal)} ={" "}
        <tspan fill={CORAL}>{formatNumber(productContribution)}</tspan>
      </text>
      <text x="248" y="211" fill={INK} fontSize="9">
        square path: {formatNumber(residual)} x {formatNumber(squareLocal)} ={" "}
        <tspan fill={CORAL}>{formatNumber(squareContribution)}</tspan>
      </text>
      <text x="34" y="239" fill={INK} fontSize="11">
        dL/dw = {formatNumber(productContribution)} +{" "}
        {formatNumber(squareContribution)} ={" "}
        <tspan fill={YELLOW} fontWeight="700">
          {formatNumber(totalGradient)}
        </tspan>
      </text>
    </>
  );
}

function OptimizerTraceView({ observation }: ObservationViewProps) {
  const learningRate = numberMetric(observation, "learningRate");
  const initialWeight = numberMetric(observation, "initialWeight");
  const targetMean = numberMetric(observation, "targetMean");
  const steps = numberMetric(observation, "steps");
  const finalWeight = numberMetric(observation, "finalWeight");
  const finalLoss = numberMetric(observation, "finalLoss");
  const crossed = numberMetric(observation, "crossedMinimum");
  const weights = numberArrayMetric(observation, "weightTrace");
  const geometry = lineGeometry(
    weights,
    62,
    44,
    532,
    157,
    [targetMean],
  );
  const targetY = geometry.yFor(targetMean);
  const first = geometry.points[0];

  return (
    <>
      <ChartFrame xLabel={`0 to ${steps} updates`} yLabel="weight" />
      <path
        d={`M62 ${targetY}H594`}
        stroke={YELLOW}
        strokeDasharray="5 4"
        strokeWidth="2"
      />
      <text x="481" y={targetY - 7} fill={YELLOW} fontSize="10">
        optimum {formatNumber(targetMean)}
      </text>
      <path
        d={geometry.path}
        fill="none"
        stroke={BLUE}
        strokeWidth="3"
        data-testid="optimizer-weight-trace"
        data-values={weights.join(",")}
      />
      {geometry.points.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r={index === 0 || index === geometry.points.length - 1 ? 5 : 2.5}
          fill={index === geometry.points.length - 1 ? GREEN : BLUE}
        />
      ))}
      <text x="68" y="34" fill={BLUE} fontSize="10">
        learning rate {formatNumber(learningRate)}
      </text>
      <text x={first.x + 8} y={first.y - 8} fill={MUTED} fontSize="10">
        start {formatNumber(initialWeight)}
      </text>
      <text x="348" y="234" fill={crossed ? CORAL : GREEN} fontSize="10">
        final w {formatNumber(finalWeight, 6)} / loss{" "}
        {formatNumber(finalLoss, 6)} / crossed minimum {crossed}
      </text>
    </>
  );
}

function ClusterProjectView({ observation }: ObservationViewProps) {
  const coordinateScale = numberMetric(
    observation,
    "secondCoordinateScale",
  );
  const pointCount = numberMetric(observation, "pointCount");
  const scaledPointValues = numberArrayMetric(
    observation,
    "scaledPoints",
  );
  const scaledPoints = Array.from(
    { length: scaledPointValues.length / 2 },
    (_unused, index) => [
      scaledPointValues[index * 2],
      scaledPointValues[index * 2 + 1],
    ] as const,
  );
  const assignments = numberArrayMetric(observation, "assignments");
  const centroidZero = numberArrayMetric(observation, "centroidZero");
  const centroidOne = numberArrayMetric(observation, "centroidOne");
  const dataCenter = numberArrayMetric(observation, "dataCenter");
  const angle = numberMetric(
    observation,
    "principalAngleDegrees",
  );
  const allX = [
    ...scaledPoints.map(([x]) => x),
    centroidZero[0],
    centroidOne[0],
  ];
  const allY = [
    ...scaledPoints.map(([, y]) => y),
    centroidZero[1],
    centroidOne[1],
  ];
  const [xMin, xMax] = paddedBounds(allX);
  const [yMin, yMax] = paddedBounds(allY);
  const xFor = (value: number) => scale(value, xMin, xMax, 75, 390);
  const yFor = (value: number) => scale(value, yMin, yMax, 210, 50);
  const centerX = xFor(dataCenter[0]);
  const centerY = yFor(dataCenter[1]);
  const radians = (angle * Math.PI) / 180;
  const transformedDirection = [
    (Math.cos(radians) * (390 - 75)) / (xMax - xMin),
    (-Math.sin(radians) * (210 - 50)) / (yMax - yMin),
  ] as const;
  const directionLength = Math.hypot(...transformedDirection);
  const axisDx = (transformedDirection[0] / directionLength) * 115;
  const axisDy = (transformedDirection[1] / directionLength) * 115;
  const axisStart = [centerX - axisDx, centerY - axisDy] as const;
  const axisEnd = [centerX + axisDx, centerY + axisDy] as const;

  return (
    <>
      <text x="38" y="25" fill={BLUE} fontSize="11" fontWeight="700">
        second-coordinate scale {formatNumber(coordinateScale)}
      </text>
      <path
        d="M62 38V218H412"
        fill="none"
        stroke={GRID}
        data-testid="cluster-axis-frame"
      />
      <line
        x1={axisStart[0]}
        y1={axisStart[1]}
        x2={axisEnd[0]}
        y2={axisEnd[1]}
        stroke={YELLOW}
        strokeWidth="3"
        data-testid="cluster-principal-axis"
        data-principal-angle={angle}
      />
      {scaledPoints.map(([pointX, pointY], index) => (
        <circle
          key={`point-${index}`}
          cx={xFor(pointX)}
          cy={yFor(pointY)}
          r="6"
          fill={assignments[index] === 0 ? BLUE : CORAL}
          data-cluster-point={index}
          data-cluster-assignment={assignments[index]}
        />
      ))}
      {[centroidZero, centroidOne].map((centroid, index) => {
        const x = xFor(centroid[0]);
        const y = yFor(centroid[1]);
        return (
          <g key={index}>
            <circle cx={x} cy={y} r="17" fill={PANEL} stroke={index ? CORAL : BLUE} strokeWidth="3" />
            <path d={`M${x - 8} ${y}H${x + 8}M${x} ${y - 8}V${y + 8}`} stroke={index ? CORAL : BLUE} strokeWidth="3" />
            <text x={x + 21} y={y - 8} fill={INK} fontSize="10">
              c{index} ({formatNumber(centroid[0])}, {formatNumber(centroid[1])})
            </text>
          </g>
        );
      })}
      <text x="73" y="237" fill={YELLOW} fontSize="10">
        principal direction {formatNumber(angle, 1)} degrees
      </text>

      <rect x="438" y="47" width="164" height="165" rx="4" fill={PANEL} />
      <text x="454" y="70" fill={MUTED} fontSize="10">
        {pointCount} POINT ASSIGNMENTS
      </text>
      {assignments.map((assignment, index) => (
        <g key={index}>
          <circle
            cx={470 + (index % 2) * 72}
            cy={105 + Math.floor(index / 2) * 55}
            r="17"
            fill={assignment === 0 ? "#263852" : "#4a302e"}
            stroke={assignment === 0 ? BLUE : CORAL}
          />
          <text
            x={460 + (index % 2) * 72}
            y={109 + Math.floor(index / 2) * 55}
            fill={INK}
            fontSize="10"
          >
            p{index + 1}
          </text>
          <text
            x={454 + (index % 2) * 72}
            y={132 + Math.floor(index / 2) * 55}
            fill={MUTED}
            fontSize="10"
          >
            cluster {assignment}
          </text>
        </g>
      ))}
    </>
  );
}

function ConvolutionFieldView({ observation }: ObservationViewProps) {
  const position = numberMetric(observation, "patternPosition");
  const kernel = numberArrayMetric(observation, "kernelValues");
  const outputs = numberArrayMetric(observation, "outputValues");
  const peakPosition = numberMetric(observation, "peakPosition");
  const peakActivation = numberMetric(observation, "peakActivation");
  const stride = numberMetric(observation, "stride");
  const padding = numberMetric(observation, "padding");
  const inputColumns = outputs.length + 1;
  const input = Array.from({ length: 2 }, () =>
    Array.from({ length: inputColumns }, () => 0),
  );
  kernel.forEach((value, index) => {
    const row = Math.floor(index / 2);
    const column = index % 2;
    input[row][position + column] = value;
  });

  return (
    <>
      <text x="28" y="26" fill={BLUE} fontSize="10" fontWeight="700">
        input 2 x {inputColumns}
      </text>
      {input.flatMap((row, rowIndex) =>
        row.map((value, columnIndex) => (
          <g key={`input-${rowIndex}-${columnIndex}`}>
            <rect
              x={28 + columnIndex * 30}
              y={51 + rowIndex * 34}
              width="27"
              height="30"
              fill={value === 0 ? "#292d35" : "#263852"}
              stroke={value === 0 ? GRID : BLUE}
            />
            <text
              x={39 + columnIndex * 30}
              y={71 + rowIndex * 34}
              fill={INK}
              fontSize="10"
              textAnchor="middle"
            >
              {formatNumber(value)}
            </text>
          </g>
        )),
      )}
      <text x="28" y="135" fill={MUTED} fontSize="10">
        pattern starts at column {position}
      </text>

      <path d="M216 84H256" stroke={GREEN} strokeWidth="3" />
      <text x="218" y="73" fill={MUTED} fontSize="10">
        correlate
      </text>
      <text x="266" y="26" fill={YELLOW} fontSize="10" fontWeight="700">
        shared 2 x 2 kernel
      </text>
      {kernel.map((value, index) => {
        const row = Math.floor(index / 2);
        const column = index % 2;
        return (
          <g key={`kernel-${index}`}>
            <rect
              x={280 + column * 43}
              y={51 + row * 43}
              width="39"
              height="39"
              fill={PANEL}
              stroke={YELLOW}
            />
            <text
              x={299 + column * 43}
              y={76 + row * 43}
              fill={INK}
              fontSize="11"
              textAnchor="middle"
              aria-label={`Kernel row ${row + 1} column ${column + 1}: ${formatNumber(value)}`}
            >
              {formatNumber(value)}
            </text>
          </g>
        );
      })}
      <text x="266" y="153" fill={MUTED} fontSize="10">
        stride {stride} / padding {padding}
      </text>

      <text x="393" y="26" fill={GREEN} fontSize="10" fontWeight="700">
        output 1 x {outputs.length}
      </text>
      {outputs.map((value, index) => {
        const isPeak = index === peakPosition;
        return (
          <g key={`output-${index}`} data-output-index={index} data-output-value={value}>
            <rect
              x={393 + index * 43}
              y="62"
              width="39"
              height="51"
              fill={isPeak ? "#29443d" : PANEL}
              stroke={isPeak ? GREEN : GRID}
              strokeWidth={isPeak ? 3 : 1}
            />
            <text
              x={412 + index * 43}
              y="92"
              fill={isPeak ? GREEN : INK}
              fontSize="10"
              textAnchor="middle"
            >
              {formatNumber(value)}
            </text>
            <text
              x={412 + index * 43}
              y="129"
              fill={MUTED}
              fontSize="10"
              textAnchor="middle"
            >
              {index}
            </text>
          </g>
        );
      })}
      <path
        d={`M${412 + peakPosition * 43} 139V178`}
        stroke={GREEN}
        strokeWidth="2"
      />
      <rect x="393" y="178" width="211" height="48" rx="4" fill={PANEL} stroke={GREEN} />
      <text x="408" y="198" fill={MUTED} fontSize="10">
        PEAK RESPONSE
      </text>
      <text x="408" y="216" fill={GREEN} fontSize="11" fontWeight="700">
        {formatNumber(peakActivation)} at output {peakPosition}
      </text>
    </>
  );
}

function AttentionRoutingView({ observation }: ObservationViewProps) {
  const selectedScore = numberMetric(observation, "selectedScore");
  const otherScore = numberMetric(observation, "otherScore");
  const otherWeight = numberMetric(observation, "otherWeight");
  const selectedWeight = numberMetric(observation, "selectedWeight");
  const weightSum = numberMetric(observation, "weightSum");
  const valueZero = numberMetric(observation, "valueZero");
  const valueOne = numberMetric(observation, "valueOne");
  const output = numberMetric(observation, "output");
  const routes = [
    {
      label: "other",
      x: 50,
      score: otherScore,
      weight: otherWeight,
      value: valueZero,
      color: MUTED,
    },
    {
      label: "selected",
      x: 246,
      score: selectedScore,
      weight: selectedWeight,
      value: valueOne,
      color: BLUE,
    },
  ];

  return (
    <>
      <text x="36" y="26" fill={BLUE} fontSize="11" fontWeight="700">
        two-score softmax routing
      </text>
      {routes.map((route, index) => (
        <g key={route.label}>
          <rect
            x={route.x}
            y="52"
            width="150"
            height="74"
            rx="5"
            fill={PANEL}
            stroke={route.color}
          />
          <text x={route.x + 14} y="75" fill={MUTED} fontSize="10">
            {route.label.toUpperCase()} SCORE
          </text>
          <text x={route.x + 14} y="99" fill={INK} fontSize="12" fontWeight="700">
            {formatNumber(route.score)}
          </text>
          <text x={route.x + 82} y="99" fill={route.color} fontSize="10">
            value {formatNumber(route.value)}
          </text>
          <path
            d={`M${route.x + 75} 126C${route.x + 75} 174 468 147 498 181`}
            fill="none"
            stroke={route.color}
            strokeWidth={2 + route.weight * 10}
            opacity={0.45 + route.weight * 0.5}
            data-attention-route={route.label}
            data-attention-weight={route.weight}
            aria-label={`${route.label} attention weight ${formatNumber(route.weight)}`}
          />
          <text x={route.x + 42} y="153" fill={route.color} fontSize="10">
            w{index} = {formatNumber(route.weight)}
          </text>
        </g>
      ))}
      <rect x="456" y="174" width="148" height="54" rx="5" fill="#263852" stroke={GREEN} />
      <text x="471" y="194" fill={MUTED} fontSize="10">
        WEIGHTED VALUE
      </text>
      <text x="471" y="216" fill={GREEN} fontSize="14" fontWeight="700">
        {formatNumber(output)}
      </text>
      <text x="50" y="229" fill={INK} fontSize="10">
        sum weights = {formatNumber(weightSum)}
      </text>
      <text x="191" y="229" fill={MUTED} fontSize="10">
        {formatNumber(valueZero)} x {formatNumber(otherWeight)} +{" "}
        {formatNumber(valueOne)} x {formatNumber(selectedWeight)}
      </text>
    </>
  );
}

function QLearningView({ observation }: ObservationViewProps) {
  const bestNextQ = numberMetric(observation, "bestNextQ");
  const reward = numberMetric(observation, "reward");
  const discount = numberMetric(observation, "discount");
  const currentQ = numberMetric(observation, "currentQ");
  const learningRate = numberMetric(observation, "learningRate");
  const nonterminalTarget = numberMetric(
    observation,
    "nonterminalTarget",
  );
  const terminalTarget = numberMetric(observation, "terminalTarget");
  const updatedQ = numberMetric(observation, "updatedQ");

  return (
    <>
      <text x="38" y="26" fill={BLUE} fontSize="11" fontWeight="700">
        one fixed Q-learning transition
      </text>
      <g data-q-node="reward">
        <FormulaNode
          x={28}
          y={38}
          width={110}
          title="REWARD"
          value={formatNumber(reward)}
          accent={GREEN}
        />
      </g>
      <g data-q-node="discounted-best-next">
        <FormulaNode
          x={28}
          y={134}
          width={170}
          title="DISCOUNTED BEST NEXT"
          value={`${formatNumber(discount)} x ${formatNumber(bestNextQ)}`}
        />
      </g>
      <g data-q-node="target">
        <FormulaNode
          x={244}
          y={50}
          width={145}
          title="TARGET"
          value={formatNumber(nonterminalTarget)}
          accent={YELLOW}
        />
      </g>
      <g data-q-node="current-q">
        <FormulaNode
          x={244}
          y={146}
          width={145}
          title="CURRENT Q(s,a)"
          value={formatNumber(currentQ)}
        />
      </g>
      <g data-q-node="updated-q">
        <FormulaNode
          x={470}
          y={98}
          width={142}
          title="UPDATED Q(s,a)"
          value={formatNumber(updatedQ)}
          accent={GREEN}
        />
      </g>
      {[
        ["reward", "target", "M138 70C188 70 199 76 244 76", GREEN],
        [
          "discounted-best-next",
          "target",
          "M198 166C228 166 211 96 244 96",
          BLUE,
        ],
        ["target", "updated-q", "M389 82C431 82 432 118 470 118", YELLOW],
        [
          "current-q",
          "updated-q",
          "M389 178C431 178 432 142 470 142",
          BLUE,
        ],
      ].map(([source, target, path, color]) => (
        <path
          key={`${source}-${target}`}
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="3"
          data-q-edge
          data-source={source}
          data-target={target}
        />
      ))}
      <text x="28" y="224" fill={INK} fontSize="10">
        {formatNumber(reward)} + gamma {formatNumber(discount)} x{" "}
        {formatNumber(bestNextQ)} = {formatNumber(nonterminalTarget)}
      </text>
      <text x="330" y="224" fill={MUTED} fontSize="10">
        UPDATE WITH alpha {formatNumber(learningRate)}
      </text>
      <text x="28" y="245" fill={MUTED} fontSize="10">
        terminal target {formatNumber(terminalTarget)}
      </text>
      <text x="330" y="245" fill={INK} fontSize="10">
        Q: {formatNumber(currentQ)} -&gt; {formatNumber(updatedQ)}
      </text>
    </>
  );
}

function ShiftMonitorView({ observation }: ObservationViewProps) {
  const nightShare = numberMetric(
    observation,
    "nightShareAmongActualPositives",
  );
  const dayShare = numberMetric(
    observation,
    "dayShareAmongActualPositives",
  );
  const totalSupport = numberMetric(
    observation,
    "totalActualPositiveSupport",
  );
  const daySupport = numberMetric(
    observation,
    "dayActualPositiveSupport",
  );
  const nightSupport = numberMetric(
    observation,
    "nightActualPositiveSupport",
  );
  const dayRate = optionalNumberMetric(
    observation,
    "dayFalseNegativeRate",
  );
  const nightRate = optionalNumberMetric(
    observation,
    "nightFalseNegativeRate",
  );
  const gap = optionalNumberMetric(
    observation,
    "falseNegativeRateGap",
  );
  const aggregate = numberMetric(
    observation,
    "aggregateFalseNegativeRate",
  );
  const dayFalseNegatives = numberMetric(
    observation,
    "dayFalseNegatives",
  );
  const nightFalseNegatives = numberMetric(
    observation,
    "nightFalseNegatives",
  );
  const falseNegatives = numberMetric(
    observation,
    "falseNegatives",
  );
  const shareWidth = 544;
  const rateMaximum = Math.max(
    0.01,
    dayRate ?? 0,
    nightRate ?? 0,
    aggregate,
  );
  const rates = [
    ["day slice", dayRate, BLUE],
    ["night slice", nightRate, CORAL],
    ["aggregate", aggregate, YELLOW],
  ] as const;

  return (
    <>
      <text x="38" y="25" fill={BLUE} fontSize="11" fontWeight="700">
        {formatNumber(totalSupport)} actual-positive cases
      </text>
      <rect x="48" y="48" width={shareWidth * dayShare} height="39" fill="#263852" stroke={BLUE} />
      <rect
        x={48 + shareWidth * dayShare}
        y="48"
        width={shareWidth * nightShare}
        height="39"
        fill="#4a302e"
        stroke={CORAL}
      />
      <text
        x="59"
        y="72"
        fill={INK}
        fontSize="10"
        data-testid="shift-day-share-label"
      >
        day {formatNumber(daySupport)} ({formatPercent(dayShare, 0)})
      </text>
      <text
        x="581"
        y="72"
        fill={INK}
        fontSize="10"
        textAnchor="end"
        data-testid="shift-night-share-label"
      >
        night {formatNumber(nightSupport)} ({formatPercent(nightShare, 0)})
      </text>

      {rates.map(([label, rate, color], index) => {
        const width =
          rate === undefined ? 0 : (rate / rateMaximum) * 390;
        const y = 119 + index * 39;
        const falseNegativeCount =
          index === 0
            ? dayFalseNegatives
            : index === 1
              ? nightFalseNegatives
              : falseNegatives;
        return (
          <g key={label}>
            <text x="48" y={y + 13} fill={MUTED} fontSize="10">
              {label}
            </text>
            {rate !== undefined && (
              <rect
                x="142"
                y={y}
                width={Math.max(2, width)}
                height="17"
                fill={color}
              />
            )}
            <text
              x={151 + width}
              y={y + 13}
              fill={INK}
              fontSize="10"
              data-testid={`shift-${index === 0 ? "day" : index === 1 ? "night" : "aggregate"}-rate-label`}
            >
              {rate === undefined
                ? "undefined"
                : formatPercent(rate, 1)}{" "}
              / {formatNumber(falseNegativeCount, 1)} FN
            </text>
          </g>
        );
      })}
      <rect x="48" y="227" width="544" height="1" fill={GRID} />
      <text
        x="48"
        y="248"
        fill={CORAL}
        fontSize="10"
        data-testid="shift-gap-label"
      >
        slice gap{" "}
        {gap === undefined
          ? "undefined"
          : `${formatNumber(gap * 100, 1)} percentage points`}
      </text>
      <text x="411" y="248" fill={YELLOW} fontSize="10" fontWeight="700">
        aggregate {formatPercent(aggregate, 1)}
      </text>
    </>
  );
}

function GenericObservationView({
  observation,
}: ObservationViewProps) {
  return (
    <>
      <FormulaNode
        x={48}
        y={60}
        width={544}
        title="CURRENT EXPERIMENT STATE"
        value={observation.primary}
      />
      <rect x="48" y="146" width="544" height="58" rx="5" fill={PANEL} stroke={GRID} />
      <text x="64" y="180" fill={MUTED} fontSize="10">
        {observation.secondary}
      </text>
    </>
  );
}

function viewFor(
  labId: VisualLabActivity["labId"],
  observation: VisualMechanismObservation,
) {
  const props = { observation };
  switch (labId) {
    case "prerequisite-trace":
      return <PrerequisiteView {...props} />;
    case "data-and-baseline":
      return <DataBaselineView {...props} />;
    case "linear-model":
      return <LinearModelView {...props} />;
    case "loss-landscape":
      return <LossLandscapeView {...props} />;
    case "gradient-descent":
      return <GradientDescentView {...props} />;
    case "split-and-leakage":
      return <SplitLeakageView {...props} />;
    case "capacity-curves":
      return <CapacityCurvesView {...props} />;
    case "logistic-link":
      return <LogisticLinkView {...props} />;
    case "decision-costs":
      return <DecisionCostsView {...props} />;
    case "feature-pipeline":
      return <FeaturePipelineView {...props} />;
    case "knn-versus-tree":
      return <KnnTreeView {...props} />;
    case "regularization-path":
      return <RegularizationView {...props} />;
    case "ensemble-votes":
      return <EnsembleVotesView {...props} />;
    case "xor-hidden-space":
      return <XorHiddenView {...props} />;
    case "backprop-graph":
      return <BackpropGraphView {...props} />;
    case "optimizer-traces":
      return <OptimizerTraceView {...props} />;
    case "cluster-project":
      return <ClusterProjectView {...props} />;
    case "convolution-field":
      return <ConvolutionFieldView {...props} />;
    case "attention-routing":
      return <AttentionRoutingView {...props} />;
    case "q-learning":
      return <QLearningView {...props} />;
    case "shift-monitor":
      return <ShiftMonitorView {...props} />;
    default:
      return <GenericObservationView {...props} />;
  }
}

export function MechanismDiagram({
  labId,
  observation,
}: MechanismDiagramProps) {
  const formatMetric = (metric: VisualMechanismObservation["metrics"][string]) =>
    Array.isArray(metric) ? metric.join(", ") : String(metric);
  const metricLabel = (key: string) =>
    key
      .replaceAll("_", " ")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/^./, (character) => character.toUpperCase());

  return (
    <div className="mechanism-diagram-frame">
      <svg
        className="mechanism-diagram"
        viewBox="0 0 640 260"
        role="img"
        aria-label={`Mechanism diagram for ${labId}. ${observation.primary}. ${observation.secondary}.`}
        data-lab-id={labId}
        data-observation-value={observation.value}
      >
        <title>{`Exact linked state for ${labId}: ${observation.primary}; ${observation.secondary}`}</title>
        {viewFor(labId, observation)}
      </svg>
      <details className="diagram-data">
        <summary>Diagram values</summary>
        <p>{observation.explanation}</p>
        <dl>
          <div>
            <dt>Primary state</dt>
            <dd>{observation.primary}</dd>
          </div>
          <div>
            <dt>Secondary state</dt>
            <dd>{observation.secondary}</dd>
          </div>
          {Object.entries(observation.metrics).map(([key, metric]) => (
            <div key={key}>
              <dt>{metricLabel(key)}</dt>
              <dd>{formatMetric(metric)}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
