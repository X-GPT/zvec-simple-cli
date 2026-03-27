const OPENAI_URL = "https://api.openai.com/v1/embeddings";
const MODEL = "text-embedding-3-small";

export type EmbedFn = (texts: string[]) => Promise<number[][]>;

// Overridable for testing — use embeddings.fn = myMock in tests
export const embeddings: { fn: EmbedFn } = { fn: embed };

export async function embed(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY. Add it to .env or export it.");
  }

  if (texts.length === 0) return [];

  const results: number[][] = [];

  // Batch in groups of 100 (OpenAI limit)
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100);
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: batch, model: MODEL }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI API error (${response.status}): ${(err as any).error?.message ?? response.statusText}`
      );
    }

    const data = (await response.json()) as {
      data: { embedding: number[]; index: number }[];
    };

    // Sort by index to preserve order
    const sorted = data.data.sort((a, b) => a.index - b.index);
    for (const item of sorted) {
      results.push(item.embedding);
    }
  }

  return results;
}
