#!/usr/bin/env bun
import { partitionAdd, partitionList, partitionRemove } from "./src/commands/partition";
import { searchCommand } from "./src/commands/search";
import { updateCommand } from "./src/commands/update";
import { statusCommand } from "./src/commands/status";
import { closeDb } from "./src/store";

function printUsage(): void {
  console.log(`Usage: zdoc <command> [options]

Commands:
  partition add <path> --name <name>   Register and index a source directory/file
  partition list                       List all registered partitions
  partition remove --name <name>       Unregister and remove a partition
  update                               Re-scan and re-embed all registered sources
  search <query>                       Search across all partitions
  status                               Show index stats

Search options:
  -p, --partition <name>   Filter by partition
  -n <count>               Number of results (default: 5)
  --files                  Output file paths only (deduplicated)

Global options:
  --json                   Structured JSON output`);
}

interface ParsedArgs {
  command: string;
  subcommand?: string;
  name?: string;
  partition?: string;
  json: boolean;
  filesOnly: boolean;
  topk: number;
  rest: string[];
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  const command = args[0]!;
  let subcommand: string | undefined;
  let name: string | undefined;
  let partition: string | undefined;
  let json = false;
  let filesOnly = false;
  let topk = 5;
  const rest: string[] = [];

  // For 'partition' command, second arg is subcommand
  let startIdx = 1;
  if (command === "partition" && args[1]) {
    subcommand = args[1];
    startIdx = 2;
  }

  let i = startIdx;
  while (i < args.length) {
    if (args[i] === "--name") {
      name = args[i + 1];
      if (!name) {
        console.error("Missing partition name after --name");
        process.exit(1);
      }
      i += 2;
    } else if (args[i] === "-p" || args[i] === "--partition") {
      partition = args[i + 1];
      if (!partition) {
        console.error("Missing partition name after -p/--partition");
        process.exit(1);
      }
      i += 2;
    } else if (args[i] === "--json") {
      json = true;
      i++;
    } else if (args[i] === "--files") {
      filesOnly = true;
      i++;
    } else if (args[i] === "-n") {
      topk = parseInt(args[i + 1]!, 10);
      if (isNaN(topk) || topk < 1) {
        console.error("Invalid count after -n");
        process.exit(1);
      }
      i += 2;
    } else {
      rest.push(args[i]!);
      i++;
    }
  }

  return { command, subcommand, name, partition, json, filesOnly, topk, rest };
}

const parsed = parseArgs(process.argv);
const opts = { json: parsed.json };

try {
  switch (parsed.command) {
    case "partition":
      switch (parsed.subcommand) {
        case "add":
          if (!parsed.rest[0]) {
            console.error("Usage: zdoc partition add <path> --name <name>");
            process.exit(1);
          }
          if (!parsed.name) {
            console.error("Missing --name flag. Usage: zdoc partition add <path> --name <name>");
            process.exit(1);
          }
          await partitionAdd(parsed.rest[0], parsed.name as string, opts);
          break;

        case "list":
          await partitionList(opts);
          break;

        case "remove":
          if (!parsed.name) {
            console.error("Usage: zdoc partition remove --name <name>");
            process.exit(1);
          }
          await partitionRemove(parsed.name as string, opts);
          break;

        default:
          console.error(`Unknown partition subcommand: ${parsed.subcommand}`);
          printUsage();
          process.exit(1);
      }
      break;

    case "search":
      if (!parsed.rest[0]) {
        console.error("Usage: zdoc search <query> [-p <partition>] [-n <count>] [--json] [--files]");
        process.exit(1);
      }
      await searchCommand(parsed.rest.join(" "), {
        partition: parsed.partition,
        json: parsed.json,
        filesOnly: parsed.filesOnly,
        topk: parsed.topk,
      });
      break;

    case "update":
      await updateCommand(opts);
      break;

    case "status":
      await statusCommand(opts);
      break;

    default:
      console.error(`Unknown command: ${parsed.command}`);
      printUsage();
      process.exit(1);
  }
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (parsed.json) {
    console.error(JSON.stringify({ error: message }));
  } else {
    console.error(`Error: ${message}`);
  }
  process.exit(1);
} finally {
  closeDb();
}
