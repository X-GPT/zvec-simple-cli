export interface Chunk {
  content: string;
  index: number;
}

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

export function chunkText(text: string): Chunk[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n\n+/);
  const chunks: Chunk[] = [];
  let buffer = "";
  let chunkIndex = 0;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (buffer && buffer.length + trimmed.length + 1 > CHUNK_SIZE) {
      chunks.push({ content: buffer, index: chunkIndex++ });
      const overlap = buffer.slice(-CHUNK_OVERLAP);
      buffer = overlap + " " + trimmed;
    } else if (!buffer) {
      buffer = trimmed;
    } else {
      buffer += "\n\n" + trimmed;
    }

    while (buffer.length > CHUNK_SIZE) {
      const splitAt = findSplitPoint(buffer, CHUNK_SIZE);
      chunks.push({ content: buffer.slice(0, splitAt).trim(), index: chunkIndex++ });
      const overlap = buffer.slice(Math.max(0, splitAt - CHUNK_OVERLAP), splitAt);
      buffer = overlap + buffer.slice(splitAt);
    }
  }

  if (buffer.trim()) {
    chunks.push({ content: buffer.trim(), index: chunkIndex });
  }

  return chunks;
}

function findSplitPoint(text: string, maxLen: number): number {
  // Try to split at last sentence boundary before maxLen
  const region = text.slice(0, maxLen);
  const sentenceEnd = Math.max(
    region.lastIndexOf(". "),
    region.lastIndexOf(".\n"),
    region.lastIndexOf("? "),
    region.lastIndexOf("! ")
  );
  if (sentenceEnd > maxLen * 0.3) return sentenceEnd + 1;

  // Fall back to last space
  const lastSpace = region.lastIndexOf(" ");
  if (lastSpace > maxLen * 0.3) return lastSpace;

  // Hard split
  return maxLen;
}
