import { listDatasets } from "@/lib/api/generated";

// Résout le slug d'un dataset (= DatasetCard.dataset_name, cf. importer.py) vers son id UUID,
// nécessaire pour construire les liens profonds (/datasets/[id], /projects/new?datasetId=…).
// Le catalogue seedé est petit : une page suffit (page_size plafonné à 96 côté API).
export async function resolveDatasetId(datasetSlug: string): Promise<string | null> {
  const result = await listDatasets({ query: { page_size: 96 }, throwOnError: false });
  const items = result.data?.items ?? [];
  const match = items.find((dataset) => dataset.dataset_name === datasetSlug);
  return match?.id ?? null;
}
