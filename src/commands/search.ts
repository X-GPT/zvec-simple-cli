import { embeddings } from "../embeddings";
import { withCollection, VECTOR_FIELD, FIELDS } from "../collection";

export async function searchCommand(
  query: string,
  collectionName: string
): Promise<void> {
  const [vector] = await embeddings.fn([query]);

  await withCollection(collectionName, (collection) => {
    const results = collection.querySync({
      fieldName: VECTOR_FIELD,
      vector,
      topk: 5,
      outputFields: [FIELDS.source, FIELDS.chunkIndex, FIELDS.content],
    });

    if (results.length === 0) {
      console.log("No results found.");
      return;
    }

    console.log(`Top ${results.length} results from "${collectionName}":\n`);

    for (let i = 0; i < results.length; i++) {
      const doc = results[i];
      const source = doc.fields[FIELDS.source];
      const chunkIdx = doc.fields[FIELDS.chunkIndex];
      const content = doc.fields[FIELDS.content] as string;
      const preview =
        content.length > 200 ? content.slice(0, 200) + "..." : content;

      console.log(
        `[${i + 1}] (score: ${doc.score.toFixed(4)}) ${source}, chunk ${chunkIdx}`
      );
      console.log(`    ${preview}\n`);
    }
  });
}
