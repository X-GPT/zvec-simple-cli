import {
  ZVecCreateAndOpen,
  ZVecOpen,
  ZVecCollectionSchema,
  ZVecDataType,
  ZVecIndexType,
  ZVecMetricType,
  type ZVecCollection,
} from "@zvec/zvec";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BASE_DIR = ".zvec-data";

export const VECTOR_FIELD = "embedding";
export const FIELDS = {
  source: "source",
  chunkIndex: "chunk_index",
  content: "content",
} as const;

export function collectionPath(name: string): string {
  return join(BASE_DIR, name, "collection");
}

export function manifestPath(name: string): string {
  return join(BASE_DIR, name, "manifest.json");
}

export function openOrCreateCollection(name: string): ZVecCollection {
  const colPath = collectionPath(name);
  const dirPath = join(BASE_DIR, name);

  if (existsSync(colPath)) {
    return ZVecOpen(colPath);
  }

  mkdirSync(dirPath, { recursive: true });

  const schema = new ZVecCollectionSchema({
    name,
    vectors: {
      name: VECTOR_FIELD,
      dataType: ZVecDataType.VECTOR_FP32,
      dimension: 1536,
      indexParams: {
        indexType: ZVecIndexType.HNSW,
        metricType: ZVecMetricType.COSINE,
        m: 16,
        efConstruction: 128,
      },
    },
    fields: [
      { name: FIELDS.source, dataType: ZVecDataType.STRING },
      { name: FIELDS.chunkIndex, dataType: ZVecDataType.INT32 },
      { name: FIELDS.content, dataType: ZVecDataType.STRING },
    ],
  });

  return ZVecCreateAndOpen(colPath, schema);
}

export async function withCollection<T>(
  name: string,
  fn: (collection: ZVecCollection) => T | Promise<T>
): Promise<T> {
  const collection = openOrCreateCollection(name);
  try {
    return await fn(collection);
  } finally {
    collection.closeSync();
  }
}

export interface ManifestEntry {
  chunkIds: string[];
  addedAt: string;
}

export type Manifest = Record<string, ManifestEntry>;

export async function readManifest(name: string): Promise<Manifest> {
  const path = manifestPath(name);
  const file = Bun.file(path);
  if (await file.exists()) {
    return file.json();
  }
  return {};
}

export async function writeManifest(
  name: string,
  manifest: Manifest
): Promise<void> {
  const path = manifestPath(name);
  await Bun.write(path, JSON.stringify(manifest, null, 2));
}

export function listCollections(): string[] {
  if (!existsSync(BASE_DIR)) return [];
  const entries = readdirSync(BASE_DIR, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

export function generateId(filePath: string, chunkIndex: number): string {
  return new Bun.CryptoHasher("md5")
    .update(`${filePath}:${chunkIndex}`)
    .digest("hex")
    .slice(0, 16);
}
