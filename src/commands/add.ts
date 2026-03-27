import { resolve } from "node:path";
import { statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { chunkText } from "../chunker";
import { embeddings } from "../embeddings";
import {
  withCollection,
  readManifest,
  writeManifest,
  generateId,
  VECTOR_FIELD,
  FIELDS,
} from "../collection";

async function findFiles(dirPath: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = resolve(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findFiles(full)));
    } else if (/\.(txt|md)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

export async function addCommand(
  path: string,
  collectionName: string
): Promise<void> {
  const resolved = resolve(path);
  const stat = statSync(resolved, { throwIfNoEntry: false });

  if (!stat) {
    console.error(`Path not found: ${resolved}`);
    process.exit(1);
  }

  const files = stat.isDirectory()
    ? await findFiles(resolved)
    : [resolved];

  if (files.length === 0) {
    console.log("No .txt or .md files found.");
    return;
  }

  const manifest = await readManifest(collectionName);
  let totalChunks = 0;

  await withCollection(collectionName, async (collection) => {
    for (const filePath of files) {
      const text = await Bun.file(filePath).text();
      const chunks = chunkText(text);

      if (chunks.length === 0) {
        console.log(`  Skipping ${filePath} (empty)`);
        continue;
      }

      const vectors = await embeddings.fn(chunks.map((c) => c.content));
      const chunkIds: string[] = [];

      const docs = chunks.map((chunk, i) => {
        const id = generateId(filePath, chunk.index);
        chunkIds.push(id);
        return {
          id,
          vectors: { [VECTOR_FIELD]: vectors[i] },
          fields: {
            [FIELDS.source]: filePath,
            [FIELDS.chunkIndex]: chunk.index,
            [FIELDS.content]: chunk.content,
          },
        };
      });

      collection.upsertSync(docs);
      totalChunks += chunks.length;

      manifest[filePath] = {
        chunkIds,
        addedAt: new Date().toISOString(),
      };

      await writeManifest(collectionName, manifest);
      console.log(`  ${filePath} → ${chunks.length} chunks`);
    }
  });

  console.log(
    `\nIndexed ${totalChunks} chunks from ${files.length} file(s) into collection "${collectionName}".`
  );
}
