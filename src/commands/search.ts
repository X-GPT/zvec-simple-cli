import { embeddings } from "../embeddings";
import { withCollection, VECTOR_FIELD, FIELDS, fieldFilter } from "../collection";

export interface SearchOptions {
  partition?: string;
  json: boolean;
  filesOnly: boolean;
  topk: number;
}

export async function searchCommand(
  query: string,
  opts: SearchOptions
): Promise<void> {
  const [vector] = await embeddings.fn([query]);

  await withCollection((collection) => {
    const queryParams: Parameters<typeof collection.querySync>[0] = {
      fieldName: VECTOR_FIELD,
      vector,
      topk: opts.topk,
      outputFields: [FIELDS.source, FIELDS.chunkIndex, FIELDS.content, FIELDS.partition],
    };

    if (opts.partition) {
      queryParams.filter = fieldFilter(FIELDS.partition, opts.partition);
    }

    const results = collection.querySync(queryParams);

    if (results.length === 0) {
      if (opts.json) {
        console.log(JSON.stringify({ results: [], query }));
      } else {
        console.log("No results found.");
      }
      return;
    }

    // --files mode: deduplicated source paths
    if (opts.filesOnly) {
      const seen = new Set<string>();
      for (const doc of results) {
        const source = doc.fields[FIELDS.source] as string;
        if (!seen.has(source)) {
          seen.add(source);
          console.log(source);
        }
      }
      return;
    }

    // --json mode
    if (opts.json) {
      const jsonResults = results.map((doc, i) => ({
        rank: i + 1,
        score: doc.score,
        source: doc.fields[FIELDS.source],
        partition: doc.fields[FIELDS.partition],
        chunkIndex: doc.fields[FIELDS.chunkIndex],
        content: doc.fields[FIELDS.content],
      }));
      console.log(JSON.stringify({ results: jsonResults, query }));
      return;
    }

    // Default human-readable output
    console.log(`Top ${results.length} results:\n`);

    for (let i = 0; i < results.length; i++) {
      const doc = results[i]!;
      const source = doc.fields[FIELDS.source];
      const partition = doc.fields[FIELDS.partition];
      const chunkIdx = doc.fields[FIELDS.chunkIndex];
      const content = doc.fields[FIELDS.content] as string;
      const preview =
        content.length > 200 ? content.slice(0, 200) + "..." : content;

      console.log(
        `[${i + 1}] (score: ${doc.score.toFixed(4)}) ${source} [${partition}], chunk ${chunkIdx}`
      );
      console.log(`    ${preview}\n`);
    }
  });
}
