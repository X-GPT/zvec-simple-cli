import { resolve } from "node:path";
import { readdir } from "node:fs/promises";

export async function findFiles(dirPath: string): Promise<string[]> {
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
