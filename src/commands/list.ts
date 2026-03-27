import { readManifest, listCollections } from "../collection";

export async function listCommand(
  collectionName?: string
): Promise<void> {
  if (!collectionName) {
    const collections = listCollections();
    if (collections.length === 0) {
      console.log("No collections found.");
      return;
    }
    console.log("Collections:\n");
    const manifests = await Promise.all(
      collections.map(async (name) => ({ name, manifest: await readManifest(name) }))
    );
    for (const { name, manifest } of manifests) {
      const fileCount = Object.keys(manifest).length;
      const chunkCount = Object.values(manifest).reduce(
        (sum, e) => sum + e.chunkIds.length,
        0
      );
      console.log(`  ${name}  (${fileCount} files, ${chunkCount} chunks)`);
    }
    return;
  }

  const manifest = await readManifest(collectionName);
  const entries = Object.entries(manifest);

  if (entries.length === 0) {
    console.log(`Collection "${collectionName}" is empty.`);
    return;
  }

  console.log(`Files in "${collectionName}":\n`);

  for (const [source, entry] of entries) {
    const count = entry.chunkIds.length;
    const date = entry.addedAt.split("T")[0];
    console.log(
      `  ${source}  (${count} chunk${count !== 1 ? "s" : ""})  added ${date}`
    );
  }

  const totalChunks = entries.reduce((sum, [, e]) => sum + e.chunkIds.length, 0);
  console.log(
    `\nTotal: ${totalChunks} chunks across ${entries.length} file(s)`
  );
}
