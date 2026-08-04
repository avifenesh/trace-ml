import { describe, expect, it } from "vitest";
import {
  bedrockPolicyDetails,
  bedrockPolicySummary,
  normalizeBedrockReadiness,
} from "./bedrock-readiness";

const verifiedPolicy = {
  available: true,
  model: "openai.gpt-5.6-sol",
  retentionMode: "provider_data_share",
  retentionSource: "account",
  allowedRetentionModes: ["default", "provider_data_share"],
};

describe("Bedrock readiness", () => {
  it("accepts complete policy metadata and explains the effective mode", () => {
    const readiness = normalizeBedrockReadiness(verifiedPolicy);

    expect(readiness).toEqual(verifiedPolicy);
    if (!readiness) throw new Error("Expected verified readiness");
    expect(bedrockPolicySummary(readiness)).toContain(
      "provider data sharing permitted (account setting)",
    );
    expect(bedrockPolicyDetails(readiness)).toContain(
      "not zero retention",
    );
  });

  it("fails closed for stale booleans or incomplete policy metadata", () => {
    expect(normalizeBedrockReadiness(true)).toBeNull();
    expect(normalizeBedrockReadiness({
      ...verifiedPolicy,
      retentionSource: "",
    })).toBeNull();
    expect(normalizeBedrockReadiness({
      ...verifiedPolicy,
      retentionMode: "invented",
    })).toBeNull();
    expect(normalizeBedrockReadiness({
      ...verifiedPolicy,
      allowedRetentionModes: ["default"],
    })).toBeNull();
    expect(normalizeBedrockReadiness({
      ...verifiedPolicy,
      model: "another-model",
    })).toBeNull();
  });

  it("preserves valid unavailable state without treating it as ready", () => {
    expect(normalizeBedrockReadiness({
      ...verifiedPolicy,
      available: false,
    })).toEqual({
      ...verifiedPolicy,
      available: false,
    });
  });
});
