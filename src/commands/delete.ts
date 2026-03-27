import { resolve } from "node:path";
import { withCollection, readManifest, writeManifest } from "../collection";

export async function deleteCommand(
  source: string,
  collectionName: string
): Promise<void> {
  const manifest = await readManifest(collectionName);
  const resolved = resolve(source);

  const key = manifest[source] ? source : manifest[resolved] ? resolved : null;

  if (!key) {
    console.error(
      `File "${source}" not found in collection "${collectionName}".`
    );
    console.error("Use 'list -c " + collectionName + "' to see indexed files.");
    process.exit(1);
  }

  const entry = manifest[key];

  await withCollection(collectionName, (collection) => {
    collection.deleteSync(entry.chunkIds);
  });

  delete manifest[key];
  await writeManifest(collectionName, manifest);

  console.log(
    `Deleted ${entry.chunkIds.length} chunk(s) for "${key}" from "${collectionName}".`
  );
}
