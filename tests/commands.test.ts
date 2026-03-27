import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { addCommand } from "../src/commands/add";
import { searchCommand } from "../src/commands/search";
import { listCommand } from "../src/commands/list";
import { deleteCommand } from "../src/commands/delete";
import { readManifest, listCollections } from "../src/collection";
import { embeddings } from "../src/embeddings";

// Generate deterministic fake vectors based on text content
function fakeEmbed(texts: string[]): Promise<number[][]> {
  return Promise.resolve(
    texts.map((text) => {
      const hash = Bun.hash(text);
      const vec = new Array(1536);
      for (let i = 0; i < 1536; i++) {
        vec[i] = Math.sin(Number(hash) + i) * 0.5;
      }
      return vec;
    })
  );
}

// Swap the embed function on the shared reference
const originalFn = embeddings.fn;
embeddings.fn = fakeEmbed;

let testDir: string;
let originalCwd: string;

beforeAll(async () => {
  testDir = await mkdtemp(join(tmpdir(), "zvec-test-"));
  originalCwd = process.cwd();
  process.chdir(testDir);

  // Create test files
  await writeFile(join(testDir, "test.md"), "# Hello World\n\nThis is a test document about vector databases and semantic search.\n\nVector databases store embeddings for fast similarity search.");
  await writeFile(join(testDir, "test2.txt"), "Another document about machine learning and neural networks.");

  await mkdir(join(testDir, "subdir"), { recursive: true });
  await writeFile(join(testDir, "subdir", "nested.md"), "A nested markdown file about natural language processing.");
});

afterAll(async () => {
  embeddings.fn = originalFn;
  process.chdir(originalCwd);
  await rm(testDir, { recursive: true, force: true });
});

describe("add command", () => {
  test("adds a single file to a collection", async () => {
    await addCommand(join(testDir, "test.md"), "test-col");
    const manifest = await readManifest("test-col");
    const key = join(testDir, "test.md");
    expect(manifest[key]).toBeDefined();
    expect(manifest[key].chunkIds.length).toBeGreaterThan(0);
  });

  test("adds a directory recursively", async () => {
    await addCommand(testDir, "dir-col");
    const manifest = await readManifest("dir-col");
    const keys = Object.keys(manifest);
    // Should find test.md, test2.txt, and subdir/nested.md
    expect(keys.length).toBe(3);
  });

  test("re-adding same file is idempotent", async () => {
    await addCommand(join(testDir, "test.md"), "idem-col");
    const manifest1 = await readManifest("idem-col");
    const ids1 = manifest1[join(testDir, "test.md")]!.chunkIds;

    await addCommand(join(testDir, "test.md"), "idem-col");
    const manifest2 = await readManifest("idem-col");
    const ids2 = manifest2[join(testDir, "test.md")]!.chunkIds;

    expect(ids1).toEqual(ids2);
  });
});

describe("list command", () => {
  test("lists collections", async () => {
    const collections = listCollections();
    expect(collections).toContain("test-col");
    expect(collections).toContain("dir-col");
  });

  test("lists files in a collection", async () => {
    const manifest = await readManifest("test-col");
    expect(Object.keys(manifest).length).toBeGreaterThan(0);
  });
});

describe("search command", () => {
  test("returns results without error", async () => {
    // searchCommand prints to console, just ensure no throw
    await searchCommand("vector databases", "test-col");
  });
});

describe("delete command", () => {
  test("removes a file from collection", async () => {
    // First add a file to a dedicated collection
    await addCommand(join(testDir, "test2.txt"), "del-col");
    let manifest = await readManifest("del-col");
    expect(Object.keys(manifest).length).toBe(1);

    // Now delete it
    await deleteCommand(join(testDir, "test2.txt"), "del-col");
    manifest = await readManifest("del-col");
    expect(Object.keys(manifest).length).toBe(0);
  });
});
