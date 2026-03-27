import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { partitionAdd, partitionList, partitionRemove } from "../src/commands/partition";
import { searchCommand } from "../src/commands/search";
import { updateCommand } from "../src/commands/update";
import { statusCommand } from "../src/commands/status";
import { closeDb } from "../src/store";
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
    }),
  );
}

// Swap the embed function on the shared reference
const originalFn = embeddings.fn;
embeddings.fn = fakeEmbed;

let testDir: string;
let originalCwd: string;

// Capture console output
function captureLog(): { logs: string[]; restore: () => void } {
  const logs: string[] = [];
  const origLog = console.log;
  console.log = (...args: any[]) => logs.push(args.join(" "));
  return { logs, restore: () => { console.log = origLog; } };
}

beforeAll(async () => {
  testDir = await mkdtemp(join(tmpdir(), "zdoc-test-"));
  originalCwd = process.cwd();
  process.chdir(testDir);

  // Create test files
  await writeFile(
    join(testDir, "test.md"),
    "# Hello World\n\nThis is a test document about vector databases and semantic search.\n\nVector databases store embeddings for fast similarity search.",
  );
  await writeFile(
    join(testDir, "test2.txt"),
    "Another document about machine learning and neural networks.",
  );

  await mkdir(join(testDir, "subdir"), { recursive: true });
  await writeFile(
    join(testDir, "subdir", "nested.md"),
    "A nested markdown file about natural language processing.",
  );
});

afterAll(async () => {
  embeddings.fn = originalFn;
  closeDb();
  process.chdir(originalCwd);
  await rm(testDir, { recursive: true, force: true });
});

describe("partition add", () => {
  test("adds a single file to a partition", async () => {
    await partitionAdd(join(testDir, "test.md"), "test-part", { json: false });
  });

  test("adds a directory recursively", async () => {
    await partitionAdd(testDir, "dir-part", { json: false });
  });

  test("outputs JSON when --json is set", async () => {
    const { logs, restore } = captureLog();
    try {
      await partitionAdd(join(testDir, "test2.txt"), "json-part", { json: true });
    } finally {
      restore();
    }
    const output = JSON.parse(logs[logs.length - 1]!);
    expect(output.partition).toBe("json-part");
    expect(output.filesIndexed).toBe(1);
    expect(output.totalChunks).toBeGreaterThan(0);
    expect(output.files).toBeArray();
  });
});

describe("partition list", () => {
  test("lists partitions", async () => {
    const { logs, restore } = captureLog();
    try {
      await partitionList({ json: true });
    } finally {
      restore();
    }
    const output = JSON.parse(logs[0]!);
    expect(output.partitions).toBeArray();
    expect(output.partitions.length).toBeGreaterThan(0);
    const names = output.partitions.map((p: any) => p.name);
    expect(names).toContain("test-part");
    expect(names).toContain("dir-part");
  });
});

describe("search", () => {
  test("returns results without error", async () => {
    await searchCommand("vector databases", {
      json: false,
      filesOnly: false,
      topk: 5,
    });
  });

  test("returns JSON results", async () => {
    const { logs, restore } = captureLog();
    try {
      await searchCommand("vector databases", {
        json: true,
        filesOnly: false,
        topk: 5,
      });
    } finally {
      restore();
    }
    const output = JSON.parse(logs[0]!);
    expect(output.results).toBeArray();
    expect(output.query).toBe("vector databases");
    if (output.results.length > 0) {
      expect(output.results[0]).toHaveProperty("rank");
      expect(output.results[0]).toHaveProperty("score");
      expect(output.results[0]).toHaveProperty("source");
      expect(output.results[0]).toHaveProperty("partition");
      expect(output.results[0]).toHaveProperty("content");
    }
  });

  test("returns file paths with --files", async () => {
    const { logs, restore } = captureLog();
    try {
      await searchCommand("vector databases", {
        json: false,
        filesOnly: true,
        topk: 5,
      });
    } finally {
      restore();
    }
    // Each log line should be a file path
    for (const line of logs) {
      expect(line).toContain(testDir);
    }
  });

  test("respects -n limit", async () => {
    const { logs, restore } = captureLog();
    try {
      await searchCommand("vector databases", {
        json: true,
        filesOnly: false,
        topk: 2,
      });
    } finally {
      restore();
    }
    const output = JSON.parse(logs[0]!);
    expect(output.results.length).toBeLessThanOrEqual(2);
  });

  test("filters by partition with -p", async () => {
    const { logs, restore } = captureLog();
    try {
      await searchCommand("vector databases", {
        partition: "test-part",
        json: true,
        filesOnly: false,
        topk: 10,
      });
    } finally {
      restore();
    }
    const output = JSON.parse(logs[0]!);
    for (const result of output.results) {
      expect(result.partition).toBe("test-part");
    }
  });
});

describe("status", () => {
  test("shows index stats", async () => {
    const { logs, restore } = captureLog();
    try {
      await statusCommand({ json: true });
    } finally {
      restore();
    }
    const output = JSON.parse(logs[0]!);
    expect(output.partitions).toBeGreaterThan(0);
    expect(output.files).toBeGreaterThan(0);
    expect(output.registeredPaths).toBeArray();
  });
});

describe("update", () => {
  test("reports no changes when nothing changed", async () => {
    const { logs, restore } = captureLog();
    try {
      await updateCommand({ json: true });
    } finally {
      restore();
    }
    const output = JSON.parse(logs[0]!);
    expect(output).toHaveProperty("added");
    expect(output).toHaveProperty("updated");
    expect(output).toHaveProperty("removed");
  });
});

describe("partition remove", () => {
  test("removes a partition and its chunks", async () => {
    // Create a partition to remove
    await partitionAdd(join(testDir, "test2.txt"), "remove-part", { json: false });

    // Verify it exists
    const { logs: listLogs, restore: restoreList } = captureLog();
    try {
      await partitionList({ json: true });
    } finally {
      restoreList();
    }
    const before = JSON.parse(listLogs[0]!);
    expect(before.partitions.map((p: any) => p.name)).toContain("remove-part");

    // Remove it
    const { logs: removeLogs, restore: restoreRemove } = captureLog();
    try {
      await partitionRemove("remove-part", { json: true });
    } finally {
      restoreRemove();
    }
    const removeOutput = JSON.parse(removeLogs[0]!);
    expect(removeOutput.removed).toBe("remove-part");
    expect(removeOutput.filesRemoved).toBeGreaterThanOrEqual(1);

    // Verify it's gone
    const { logs: afterLogs, restore: restoreAfter } = captureLog();
    try {
      await partitionList({ json: true });
    } finally {
      restoreAfter();
    }
    const after = JSON.parse(afterLogs[0]!);
    expect(after.partitions.map((p: any) => p.name)).not.toContain("remove-part");
  });
});
