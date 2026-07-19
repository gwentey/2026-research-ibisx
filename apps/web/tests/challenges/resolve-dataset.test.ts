import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/generated", () => ({ listDatasets: vi.fn() }));

import { listDatasets } from "@/lib/api/generated";
import { resolveDatasetId } from "@/lib/challenges/resolve-dataset";

const mockList = vi.mocked(listDatasets);

beforeEach(() => mockList.mockReset());

describe("resolveDatasetId", () => {
  it("retourne l'id du dataset dont dataset_name === slug", async () => {
    mockList.mockResolvedValue({
      data: {
        items: [
          { id: "uuid-1", dataset_name: "titanic" },
          { id: "uuid-2", dataset_name: "iris" }
        ]
      }
    } as never);
    expect(await resolveDatasetId("iris")).toBe("uuid-2");
  });

  it("retourne null si aucun dataset ne correspond", async () => {
    mockList.mockResolvedValue({ data: { items: [] } } as never);
    expect(await resolveDatasetId("titanic")).toBeNull();
  });

  it("retourne null quand la réponse n'a pas de data", async () => {
    mockList.mockResolvedValue({ data: undefined } as never);
    expect(await resolveDatasetId("titanic")).toBeNull();
  });
});
