import { resolve } from "node:path";
import { statSync } from "node:fs";
import { withCollection, FIELDS, fieldFilter } from "../collection";
import { findFiles } from "../files";
import { indexFile } from "../indexer";
import {
  registerPartition,
  removePartition,
  listPartitions,
  getPartition,
  addFile,
} from "../store";
import type { OutputOptions } from "../types";

export async function partitionAdd(
  path: string,
  name: string,
  opts: OutputOptions
): Promise<void> {
  const resolved = resolve(path);
  const stat = statSync(resolved, { throwIfNoEntry: false });

  if (!stat) {
    if (opts.json) {
      console.error(JSON.stringify({ error: `Path not found: ${resolved}` }));
    } else {
      console.error(`Path not found: ${resolved}`);
    }
    process.exit(1);
  }

  const files = stat.isDirectory() ? await findFiles(resolved) : [resolved];

  if (files.length === 0) {
    if (opts.json) {
      console.log(JSON.stringify({ partition: name, filesIndexed: 0, totalChunks: 0, files: [] }));
    } else {
      console.log("No .txt or .md files found.");
    }
    return;
  }

  registerPartition(name, resolved);

  let totalChunks = 0;
  const indexedFiles: string[] = [];

  await withCollection(async (collection) => {
    for (const filePath of files) {
      const chunkCount = await indexFile(collection, filePath, name);

      if (chunkCount === 0) {
        if (!opts.json) console.log(`  Skipping ${filePath} (empty)`);
        continue;
      }

      totalChunks += chunkCount;
      indexedFiles.push(filePath);

      const fileStat = statSync(filePath);
      addFile(filePath, name, fileStat.mtimeMs);

      if (!opts.json) console.log(`  ${filePath} → ${chunkCount} chunks`);
    }
  });

  if (opts.json) {
    console.log(
      JSON.stringify({
        partition: name,
        filesIndexed: indexedFiles.length,
        totalChunks,
        files: indexedFiles,
      })
    );
  } else {
    console.log(
      `\nIndexed ${totalChunks} chunks from ${indexedFiles.length} file(s) into partition "${name}".`
    );
  }
}

export async function partitionList(opts: OutputOptions): Promise<void> {
  const partitions = listPartitions();

  if (partitions.length === 0) {
    if (opts.json) {
      console.log(JSON.stringify({ partitions: [] }));
    } else {
      console.log("No partitions found.");
    }
    return;
  }

  if (opts.json) {
    console.log(
      JSON.stringify({
        partitions: partitions.map((p) => ({
          name: p.name,
          path: p.path,
          fileCount: p.fileCount,
          addedAt: p.addedAt,
        })),
      })
    );
  } else {
    console.log("Partitions:\n");
    for (const p of partitions) {
      console.log(`  ${p.name}  (${p.fileCount} files)  path: ${p.path}`);
    }
  }
}

export async function partitionRemove(
  name: string,
  opts: OutputOptions
): Promise<void> {
  const partition = getPartition(name);

  if (!partition) {
    if (opts.json) {
      console.error(JSON.stringify({ error: `Partition "${name}" not found.` }));
    } else {
      console.error(`Partition "${name}" not found.`);
      console.error("Use 'partition list' to see registered partitions.");
    }
    process.exit(1);
  }

  await withCollection((collection) => {
    collection.deleteByFilterSync(fieldFilter(FIELDS.partition, name));
  });

  const filesRemoved = removePartition(name);

  if (opts.json) {
    console.log(JSON.stringify({ removed: name, filesRemoved }));
  } else {
    console.log(`Removed partition "${name}" (${filesRemoved} file(s)).`);
  }
}
