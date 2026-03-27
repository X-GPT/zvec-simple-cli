import { statSync } from "node:fs";
import { withCollection, FIELDS, fieldFilter } from "../collection";
import { findFiles } from "../files";
import { indexFile } from "../indexer";
import {
  listPartitions,
  getFilesForPartition,
  addFile,
  removeFile,
} from "../store";
import type { OutputOptions } from "../types";

export async function updateCommand(opts: OutputOptions): Promise<void> {
  const partitions = listPartitions();

  if (partitions.length === 0) {
    if (opts.json) {
      console.log(JSON.stringify({ added: 0, updated: 0, removed: 0, totalChunks: 0 }));
    } else {
      console.log("No partitions registered. Use 'partition add' first.");
    }
    return;
  }

  let totalAdded = 0;
  let totalUpdated = 0;
  let totalRemoved = 0;
  let totalChunks = 0;

  await withCollection(async (collection) => {
    for (const partition of partitions) {
      const stat = statSync(partition.path, { throwIfNoEntry: false });
      if (!stat) {
        if (!opts.json) {
          console.error(`  Warning: path not found for partition "${partition.name}": ${partition.path}`);
        }
        continue;
      }

      const currentFiles = stat.isDirectory()
        ? await findFiles(partition.path)
        : [partition.path];
      const currentFileSet = new Set(currentFiles);

      const indexedFiles = getFilesForPartition(partition.name);
      const indexedFileMap = new Map(indexedFiles.map((f) => [f.source, f]));

      const toProcess: { path: string; isNew: boolean; mtime: number }[] = [];
      for (const filePath of currentFiles) {
        const indexed = indexedFileMap.get(filePath);
        const fileStat = statSync(filePath);
        if (!indexed) {
          toProcess.push({ path: filePath, isNew: true, mtime: fileStat.mtimeMs });
        } else if (fileStat.mtimeMs > indexed.mtime) {
          toProcess.push({ path: filePath, isNew: false, mtime: fileStat.mtimeMs });
        }
      }

      for (const indexed of indexedFiles) {
        if (!currentFileSet.has(indexed.source)) {
          collection.deleteByFilterSync(fieldFilter(FIELDS.source, indexed.source));
          removeFile(indexed.source);
          totalRemoved++;
          if (!opts.json) console.log(`  Removed: ${indexed.source}`);
        }
      }

      for (const { path: filePath, isNew, mtime } of toProcess) {
        if (!isNew) {
          collection.deleteByFilterSync(fieldFilter(FIELDS.source, filePath));
        }

        const chunkCount = await indexFile(collection, filePath, partition.name);
        totalChunks += chunkCount;

        addFile(filePath, partition.name, mtime);

        if (isNew) {
          totalAdded++;
          if (!opts.json) console.log(`  Added: ${filePath} (${chunkCount} chunks)`);
        } else {
          totalUpdated++;
          if (!opts.json) console.log(`  Updated: ${filePath} (${chunkCount} chunks)`);
        }
      }
    }
  });

  if (opts.json) {
    console.log(
      JSON.stringify({
        added: totalAdded,
        updated: totalUpdated,
        removed: totalRemoved,
        totalChunks,
      })
    );
  } else {
    console.log(
      `\nUpdate complete: ${totalAdded} added, ${totalUpdated} updated, ${totalRemoved} removed.`
    );
  }
}
