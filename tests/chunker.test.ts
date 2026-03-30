import { test, expect, describe } from "vitest";
import { chunkText } from "../src/chunker";

describe("chunkText", () => {
  test("returns empty array for empty string", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   ")).toEqual([]);
    expect(chunkText("\n\n")).toEqual([]);
  });

  test("returns single chunk for short text", () => {
    const chunks = chunkText("Hello, world!");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("Hello, world!");
    expect(chunks[0].index).toBe(0);
  });

  test("preserves paragraph boundaries for short text", () => {
    const text = "First paragraph.\n\nSecond paragraph.";
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain("First paragraph.");
    expect(chunks[0].content).toContain("Second paragraph.");
  });

  test("splits long text into multiple chunks", () => {
    // Create text longer than 1000 chars
    const para = "This is a sentence that is roughly fifty characters. ";
    const longText = para.repeat(30); // ~1500 chars
    const chunks = chunkText(longText);
    expect(chunks.length).toBeGreaterThan(1);
  });

  test("chunk indices are sequential starting from 0", () => {
    const para = "A".repeat(600);
    const text = `${para}\n\n${para}\n\n${para}`;
    const chunks = chunkText(text);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].index).toBe(i);
    }
  });

  test("splits at paragraph boundaries", () => {
    const para1 = "A".repeat(500);
    const para2 = "B".repeat(500);
    const para3 = "C".repeat(500);
    const text = `${para1}\n\n${para2}\n\n${para3}`;
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    // First chunk should contain para1
    expect(chunks[0].content).toContain("A".repeat(100));
  });

  test("handles single very long paragraph", () => {
    const longPara = "word ".repeat(300); // ~1500 chars
    const chunks = chunkText(longPara);
    expect(chunks.length).toBeGreaterThan(1);
    // Each chunk should be at most ~1000 chars (with some tolerance for overlap)
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(1200);
    }
  });

  test("handles Windows line endings", () => {
    const text = "Hello.\r\n\r\nWorld.";
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain("Hello.");
    expect(chunks[0].content).toContain("World.");
  });
});
