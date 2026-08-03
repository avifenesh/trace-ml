import researchRegistry from "../../agent-knowledge/resources/ml-course-research-sources.json";

export interface ResearchSourceReference {
  id: string;
  url: string;
  title: string;
  publisher: string;
  verifiedAt: string;
}

const sourceReferences = new Map(
  researchRegistry.sources.map((source) => [
    source.id,
    {
      id: source.id,
      url: source.url,
      title: source.title,
      publisher: source.publisher,
      verifiedAt: source.verifiedAt,
    },
  ]),
);

export function researchSourcesForIds(
  sourceIds: readonly string[],
): ResearchSourceReference[] {
  return sourceIds.map((sourceId) => {
    const source = sourceReferences.get(sourceId);
    if (!source) {
      throw new Error(`Unknown research source: ${sourceId}`);
    }
    return source;
  });
}
