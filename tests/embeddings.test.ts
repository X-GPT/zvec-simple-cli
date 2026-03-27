import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { embed } from "../src/embeddings";

const originalFetch = globalThis.fetch;

function mockFetch(response: any, status = 200) {
  globalThis.fetch = mock(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? "OK" : "Error",
      json: () => Promise.resolve(response),
    } as Response)
  ) as any;
}

describe("embed", () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key-123";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalKey) {
      process.env.OPENAI_API_KEY = originalKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  });

  test("returns empty array for empty input", async () => {
    const result = await embed([]);
    expect(result).toEqual([]);
  });

  test("returns vectors on successful response", async () => {
    const fakeVectors = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]];
    mockFetch({
      data: [
        { embedding: fakeVectors[0], index: 0 },
        { embedding: fakeVectors[1], index: 1 },
      ],
    });

    const result = await embed(["hello", "world"]);
    expect(result).toEqual(fakeVectors);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  test("preserves order even if API returns out of order", async () => {
    const vec0 = [0.1, 0.2];
    const vec1 = [0.3, 0.4];
    mockFetch({
      data: [
        { embedding: vec1, index: 1 },
        { embedding: vec0, index: 0 },
      ],
    });

    const result = await embed(["first", "second"]);
    expect(result[0]).toEqual(vec0);
    expect(result[1]).toEqual(vec1);
  });

  test("throws on missing API key", async () => {
    delete process.env.OPENAI_API_KEY;
    expect(embed(["test"])).rejects.toThrow("Missing OPENAI_API_KEY");
  });

  test("throws on API error with message", async () => {
    mockFetch(
      { error: { message: "Invalid API key" } },
      401
    );
    expect(embed(["test"])).rejects.toThrow("OpenAI API error (401): Invalid API key");
  });

  test("throws on API error without message", async () => {
    mockFetch({}, 500);
    expect(embed(["test"])).rejects.toThrow("OpenAI API error (500)");
  });

  test("sends correct request body", async () => {
    mockFetch({
      data: [{ embedding: [0.1], index: 0 }],
    });

    await embed(["test input"]);

    const call = (globalThis.fetch as any).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.input).toEqual(["test input"]);
    expect(body.model).toBe("text-embedding-3-small");
    expect(call[1].headers.Authorization).toBe("Bearer test-key-123");
  });
});
