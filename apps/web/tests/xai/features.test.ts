import { describe, expect, it } from "vitest";

import { formatShare, humanizeFeature, roundLabel } from "@/lib/xai/features";

// Miroir front de xai_text.humanize_feature / format_share : mêmes cas que le back.

describe("humanizeFeature", () => {
  it("should humanize one-hot categorical features", () => {
    expect(humanizeFeature("cat__Sex_female")).toBe("Sex = female");
    expect(humanizeFeature("cat__Embarked_S")).toBe("Embarked = S");
  });

  it("should cut snake_case columns at the last underscore", () => {
    expect(humanizeFeature("cat__niveau_etude_Bac")).toBe("niveau etude = Bac");
  });

  it("should strip numeric transformer prefixes", () => {
    expect(humanizeFeature("num_median_0__Pclass")).toBe("Pclass");
    expect(humanizeFeature("num_mean_2__fare_amount")).toBe("fare amount");
  });

  it("should keep ordinal and plain names unchanged", () => {
    expect(humanizeFeature("cat__Sex")).toBe("Sex");
    expect(humanizeFeature("age")).toBe("age");
  });
});

describe("formatShare", () => {
  it("should mirror the backend share format", () => {
    expect(formatShare(0.242421, 1)).toBe("24 %");
    expect(formatShare(0.125, 1)).toBe("13 %"); // demi-part vers le haut, comme le back
    expect(formatShare(0.003, 1)).toBe("<1 %");
    expect(formatShare(-0.24, 1)).toBe("24 %");
    expect(formatShare(0.5, 0)).toBe("0 %");
  });
});

describe("roundLabel", () => {
  it("should round to 3 decimals max and pass through non-numbers", () => {
    expect(roundLabel(0.8712345)).toBe("0.871");
    expect(roundLabel(0.83)).toBe("0.83");
    expect(roundLabel("survived")).toBe("survived");
    expect(roundLabel(null)).toBe("");
  });
});
