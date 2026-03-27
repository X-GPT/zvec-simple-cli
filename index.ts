import { addCommand } from "./src/commands/add";
import { searchCommand } from "./src/commands/search";
import { listCommand } from "./src/commands/list";
import { deleteCommand } from "./src/commands/delete";

function printUsage(): void {
  console.log(`Usage: bun index.ts <command> [options]

Commands:
  add    -c <collection> <path>     Add .txt/.md files to a collection
  search -c <collection> <query>    Search a collection
  list   [-c <collection>]          List collections, or files in a collection
  delete -c <collection> <source>   Remove a file from a collection

Options:
  -c, --collection <name>   Collection name (default: "default")`);
}

function parseArgs(argv: string[]): {
  command: string;
  collection: string;
  collectionExplicit: boolean;
  rest: string[];
} {
  const args = argv.slice(2);
  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  const command = args[0];
  let collection = "default";
  let collectionExplicit = false;
  const rest: string[] = [];

  let i = 1;
  while (i < args.length) {
    if (args[i] === "-c" || args[i] === "--collection") {
      collection = args[i + 1];
      if (!collection) {
        console.error("Missing collection name after -c/--collection");
        process.exit(1);
      }
      collectionExplicit = true;
      i += 2;
    } else {
      rest.push(args[i]);
      i++;
    }
  }

  return { command, collection, collectionExplicit, rest };
}

const { command, collection, collectionExplicit, rest } = parseArgs(process.argv);

switch (command) {
  case "add":
    if (!rest[0]) {
      console.error("Usage: bun index.ts add -c <collection> <path>");
      process.exit(1);
    }
    await addCommand(rest[0], collection);
    break;

  case "search":
    if (!rest[0]) {
      console.error("Usage: bun index.ts search -c <collection> <query>");
      process.exit(1);
    }
    await searchCommand(rest.join(" "), collection);
    break;

  case "list":
    await listCommand(collectionExplicit ? collection : undefined);
    break;

  case "delete":
    if (!rest[0]) {
      console.error("Usage: bun index.ts delete -c <collection> <source>");
      process.exit(1);
    }
    await deleteCommand(rest[0], collection);
    break;

  default:
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
}
