export const CAPSTONE_INCIDENT = {
  model: {
    version: "3.2",
    artifactDigest:
      "sha256:a65bfe6cceda707830acb47678e888d21dd677464e31f07872420b550e0a2cfe",
    trainingTraceDigest:
      "sha256:912fe7955410e96ff4f931c33686af5ed845de62458ceb0624dce990031bc117",
    servingCodeVersion: "1.8.4",
    preprocessingVersion: "2.3.1",
    decisionThreshold: 0.6,
  },
  reference: {
    brightnessSamples: [0.56, 0.62, 0.64, 0.66],
    missingBarcodeRate: 0.02,
    accuracy: 0.92,
  },
  live: {
    brightnessSamples: [0.32, 0.38, 0.4, 0.46],
    missingBarcodeRate: 0.14,
    slices: {
      day: {
        truePositives: 72,
        falseNegatives: 8,
        trueNegatives: 34,
        falsePositives: 6,
      },
      night: {
        truePositives: 14,
        falseNegatives: 6,
        trueNegatives: 46,
        falsePositives: 14,
      },
    },
  },
  alertThresholds: {
    brightnessMeanShift: 0.2,
    falseNegativeRateGap: 0.15,
  },
  releaseGates: {
    overallFalseNegativeRate: 0.1,
    nightFalseNegativeRate: 0.15,
  },
  metrics: {
    referenceBrightnessMean: 0.62,
    liveBrightnessMean: 0.39,
    brightnessMeanShift: 0.23,
    liveAccuracy: 0.83,
    overallFalseNegativeRate: 0.14,
    dayFalseNegativeRate: 0.1,
    nightFalseNegativeRate: 0.3,
    falseNegativeRateGap: 0.2,
    totalActualPositiveSupport: 100,
    nightShareAmongActualPositives: 0.2,
  },
} as const;
