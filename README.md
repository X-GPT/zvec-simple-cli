# zdoc

CLI tool for semantic document indexing and search using vector embeddings.

## Install

```bash
npm install -g zdoc
```

Requires `OPENAI_API_KEY` environment variable for embedding generation.

## Usage

```bash
# Register and index a source directory
zdoc partition add ./docs --name my-docs

# List registered partitions
zdoc partition list

# Search across all partitions
zdoc search "how does authentication work"

# Search with options
zdoc search "auth" -p my-docs -n 10 --json

# Show index stats
zdoc status

# Re-scan and re-embed all sources
zdoc update

# Remove a partition
zdoc partition remove --name my-docs
```

## Options

| Flag | Description |
|------|-------------|
| `-p, --partition <name>` | Filter by partition |
| `-n <count>` | Number of results (default: 5) |
| `--files` | Output file paths only (deduplicated) |
| `--json` | Structured JSON output |

## Development

```bash
# Install dependencies
bun install

# Build
bun run build

# Run tests (requires Docker for linux-x64 native deps)
bun run test:docker    # unit tests
bun run test:cli       # CLI integration tests
```

## License

MIT
