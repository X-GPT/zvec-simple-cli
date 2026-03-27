import { listPartitions, getStats } from "../store";
import type { OutputOptions } from "../types";

export function statusCommand(opts: OutputOptions): void {
  const stats = getStats();
  const partitions = listPartitions();

  if (opts.json) {
    console.log(
      JSON.stringify({
        partitions: stats.partitions,
        files: stats.files,
        registeredPaths: partitions.map((p) => ({
          name: p.name,
          path: p.path,
        })),
      })
    );
  } else {
    console.log("Index status:\n");
    console.log(`  Partitions: ${stats.partitions}`);
    console.log(`  Files:      ${stats.files}`);

    if (partitions.length > 0) {
      console.log("\n  Registered paths:");
      for (const p of partitions) {
        console.log(`    ${p.name} → ${p.path} (${p.fileCount} files)`);
      }
    }
  }
}
