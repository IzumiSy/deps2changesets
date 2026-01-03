# deps2changesets

CLI tool to automatically generate changesets from dependency changes in Git commits.

## Features

- 🔍 **Package detection** - Detects all packages with dependency changes
- 📝 **Changeset generation** - Parses package.json diffs to create meaningful changeset summaries
- 📦 **Monorepo support** - Works with npm/yarn/pnpm workspaces using `@manypkg/get-packages`

## Installation

```bash
npm install -g @izumisy/deps2changesets
```

Or use with npx:

```bash
npx @izumisy/deps2changesets
```

> **Note:** The short alias `deps2cs` is only available when globally installed. When using npx, use the full package name `@izumisy/deps2changesets`.

## Usage

### Basic Usage

Generate changesets for dependency changes between commits:

```bash
# Compare main to HEAD (default, ideal for dependabot branches)
npx @izumisy/deps2changesets

# Compare specific commits using Git range syntax
npx @izumisy/deps2changesets abc123..def456

# Compare branches
npx @izumisy/deps2changesets main..feature-branch

# Compare from a specific ref to HEAD
npx @izumisy/deps2changesets main..
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `[range]` | Git commit range (e.g., `main..HEAD`, `a1b2c3..d4e5f6`) | `main..HEAD` |
| `--releaseType` | Release type for changesets (`patch`, `minor`, `major`) | `patch` |
| `--cwd` | Working directory | Current directory |

### Examples

```bash
# Generate patch changesets for changes from main (default)
npx @izumisy/deps2changesets

# Generate changesets for a specific range
npx @izumisy/deps2changesets HEAD~3..HEAD

# Generate minor changesets
npx @izumisy/deps2changesets main..HEAD --releaseType minor

# Run in a specific directory
npx @izumisy/deps2changesets --cwd /path/to/repo
```

## How it Works

1. **Detects changed files** - Uses Git to get changed files between commits
2. **Filters package.json files** - Identifies which packages have dependency changes
3. **Parses diffs** - Extracts dependency changes (added/updated/removed) from package.json files
4. **Maps to workspace packages** - Uses `@manypkg/get-packages` to match files to workspace packages
5. **Generates changesets** - Creates changesets with human-readable summaries

Generated changeset:

```md
---
"my-package": patch
---

Dependencies updated

- Updated [lodash](https://www.npmjs.com/package/lodash) (^4.17.19 -> ^4.17.21)
- Added [axios](https://www.npmjs.com/package/axios) (^1.4.0)
```

## GitHub Actions

You can automate changeset generation for Dependabot PRs using GitHub Actions with [stefanzweifel/git-auto-commit-action](https://github.com/stefanzweifel/git-auto-commit-action).

```yaml
# .github/workflows/dependabot-changeset.yml
name: Dependabot Changeset

on:
  pull_request:
    types: [opened]

permissions:
  contents: write
  pull-requests: write

jobs:
  generate-changeset:
    runs-on: ubuntu-latest
    if: github.actor == 'dependabot[bot]'
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: ${{ github.head_ref }}

      - name: Fetch base branch
        run: git fetch origin ${{ github.base_ref }}

      - name: Setup Node.js
        uses: actions/setup-node@v4

      - name: Generate changeset
        run: npx @izumisy/deps2changesets

      - name: Commit changeset
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'chore: add changeset for dependency update'
          file_pattern: '.changeset/*.md'
```

This workflow will:
1. Trigger on Dependabot PRs
2. Generate a changeset based on dependency changes
3. Automatically commit the changeset file to the PR branch

## Usecase

- [IzumiSy/kyrage](https://github.com/IzumiSy/kyrage/)
- [IzumiSy/mcp-duckdb-memory-server](https://github.com/IzumiSy/mcp-duckdb-memory-server)
- [IzumiSy/mcp-universal-db-client](https://github.com/IzumiSy/mcp-universal-db-client)

## License

See [LICENSE](LICENSE) file for details.
