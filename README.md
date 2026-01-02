# simple-dependabot-changeset

CLI tool to automatically generate changesets from dependency changes in Git commits.

## Features

- 🔍 **Automatic package detection** - Detects all packages with dependency changes
- 📦 **Monorepo support** - Works with npm/yarn/pnpm workspaces using `@manypkg/get-packages`
- 📝 **Smart changeset generation** - Parses package.json diffs to create meaningful changeset summaries
- 🔄 **Grouped updates** - Handles multiple dependency updates across packages
- ✅ **TypeScript** - Fully typed with comprehensive test coverage

## Installation

```bash
npm install -g simple-dependabot-changeset
```

Or use with npx:

```bash
npx simple-dependabot-changeset --from HEAD~1
```

## Usage

### Basic Usage

Generate changesets for dependency changes between commits:

```bash
# Compare HEAD~1 to HEAD (default)
simple-dependabot-changeset --from HEAD~1

# Compare specific commits
simple-dependabot-changeset --from abc123 --to def456

# Compare branches
simple-dependabot-changeset --from main --to feature-branch
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--from` | Starting commit ref (required) | - |
| `--to` | Ending commit ref | `HEAD` |
| `--releaseType` | Release type for changesets (`patch`, `minor`, `major`) | `patch` |
| `--prefix` | Commit message prefix to check for existing changesets | `[add changeset]` |
| `--cwd` | Working directory | Current directory |

### Examples

```bash
# Generate patch changesets for changes in the last commit
simple-dependabot-changeset --from HEAD~1

# Generate minor changesets
simple-dependabot-changeset --from HEAD~1 --releaseType minor

# Use custom prefix for detecting existing changesets
simple-dependabot-changeset --from HEAD~1 --prefix "[changeset]"

# Run in a specific directory
simple-dependabot-changeset --from HEAD~1 --cwd /path/to/repo
```

## How it Works

1. **Detects changed files** - Uses Git to get changed files between commits
2. **Filters package.json files** - Identifies which packages have dependency changes
3. **Parses diffs** - Extracts dependency changes (added/updated/removed) from package.json files
4. **Maps to workspace packages** - Uses `@manypkg/get-packages` to match files to workspace packages
5. **Checks for existing changesets** - Skips if a changeset commit already exists
6. **Generates changesets** - Creates changesets with human-readable summaries

## Example Output

For a commit that updates dependencies:

```
Analyzing changes from HEAD~1 to HEAD...
Found 2 changed file(s)
Found 1 changed package.json file(s)
Found 1 package(s) in workspace
Found 2 dependency change(s) in my-package
Creating changeset for my-package: Dependencies updated
Created changeset with ID: fuzzy-walls-dance
✓ Changesets created successfully!
```

Generated changeset:

```md
---
"my-package": patch
---

Dependencies updated

- Updated lodash (^4.17.19 -> ^4.17.21)
- Added axios (^1.4.0)
```

## Use with Git Hooks

You can use this tool with git hooks (e.g., using husky) to automatically generate changesets:

```bash
# In .husky/post-commit
npx simple-dependabot-changeset --from HEAD~1
```

## Development

### Setup

```bash
pnpm install
```

### Build

```bash
pnpm build
```

### Test

```bash
pnpm test
```

### Type Check

```bash
pnpm typecheck
```

## Usecase

- [IzumiSy/kyrage](https://github.com/IzumiSy/kyrage/)
- [IzumiSy/mcp-duckdb-memory-server](https://github.com/IzumiSy/mcp-duckdb-memory-server)
- [IzumiSy/mcp-universal-db-client](https://github.com/IzumiSy/mcp-universal-db-client)

## License

See [LICENSE](LICENSE) file for details.
