import zvec from "@zvec/zvec";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const {
  ZVecCreateAndOpen,
  ZVecOpen,
  ZVecCollectionSchema,
  ZVecDataType,
  ZVecIndexType,
  ZVecMetricType,
} = zvec;
export type ZVecCollection = ReturnType<typeof ZVecOpen>;

const BASE_DIR = ".zdoc-data";
const COLLECTION_NAME = "_index";

export const VECTOR_FIELD = "embedding";
export const FIELDS = {
  source: "source",
  chunkIndex: "chunk_index",
  content: "content",
  partition: "partition",
} as const;

function collectionPath(): string {
  return join(BASE_DIR, COLLECTION_NAME);
}

function openOrCreateCollection(): ZVecCollection {
  const colPath = collectionPath();

  if (existsSync(colPath)) {
    return ZVecOpen(colPath);
  }

  mkdirSync(BASE_DIR, { recursive: true });

  const schema = new ZVecCollectionSchema({
    name: COLLECTION_NAME,
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
      {
        name: FIELDS.partition,
        dataType: ZVecDataType.STRING,
        indexParams: {
          indexType: ZVecIndexType.INVERT,
        },
      },
    ],
  });

  return ZVecCreateAndOpen(colPath, schema);
}

export async function withCollection<T>(
  fn: (collection: ZVecCollection) => T | Promise<T>
): Promise<T> {
  const collection = openOrCreateCollection();
  try {
    return await fn(collection);
  } finally {
    collection.closeSync();
  }
}

export function fieldFilter(fieldName: string, value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `${fieldName} = "${escaped}"`;
}

export function generateId(filePath: string, chunkIndex: number): string {
  return createHash("md5")
    .update(`${filePath}:${chunkIndex}`)
    .digest("hex")
    .slice(0, 16);
}
