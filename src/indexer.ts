import type { ZVecCollection } from "@zvec/zvec";
import { chunkText } from "./chunker";
import { embeddings } from "./embeddings";
import { generateId, VECTOR_FIELD, FIELDS } from "./collection";

export async function indexFile(
  collection: ZVecCollection,
  filePath: string,
  partitionName: string
): Promise<number> {
  const text = await Bun.file(filePath).text();
  const chunks = chunkText(text);

  if (chunks.length === 0) return 0;

  const vectors = await embeddings.fn(chunks.map((c) => c.content));

  const docs = chunks.map((chunk, i) => ({
    id: generateId(filePath, chunk.index),
    vectors: { [VECTOR_FIELD]: vectors[i]! },
    fields: {
      [FIELDS.source]: filePath,
      [FIELDS.chunkIndex]: chunk.index,
      [FIELDS.content]: chunk.content,
      [FIELDS.partition]: partitionName,
    },
  }));

  collection.upsertSync(docs);
  return chunks.length;
}
