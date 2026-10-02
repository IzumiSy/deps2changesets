# deps2changesets

[![npm version](https://img.shields.io/npm/v/@izumisy/deps2changesets?logo=npm)](https://www.npmjs.com/package/@izumisy/deps2changesets)
[![npm downloads](https://img.shields.io/npm/dw/@izumisy/deps2changesets?logo=npm)](https://www.npmjs.com/package/@izumisy/deps2changesets)
[![license](https://img.shields.io/github/license/IzumiSy/deps2changesets)](LICENSE)
[![Node.js](https://img.shields.io/node/v/@izumisy/deps2changesets)](https://nodejs.org/)

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
npx @izumisy/deps2changesets --range abc123..def456

# Compare branches
npx @izumisy/deps2changesets --range main..feature-branch

# Compare from a specific ref to HEAD
npx @izumisy/deps2changesets --range main..
```

### Options

| Option           | Short | Description                                                                                 | Default           |
| ---------------- | ----- | ------------------------------------------------------------------------------------------- | ----------------- |
| `--range`        | `-r`  | Git commit range (e.g., `main..HEAD`, `a1b2c3..d4e5f6`)                                     | `main..HEAD`      |
| `--release-type` | `-t`  | Release type for changesets (`patch`, `minor`, `major`)                                     | `patch`           |
| `--cwd`          | `-c`  | Working directory                                                                           | Current directory |
| `--dry-run`      | `-d`  | Preview changes without creating changesets                                                 | `false`           |
| `--include-deps` | `-i`  | Additional dependency types to include (comma-separated: `prod`, `dev`, `peer`, `optional`) | `prod`            |
| `--scope`        | `-s`  | Group generated changesets; stale changesets in this scope are removed                      | —                 |

> **Note:** By default, only production `dependencies` are included in changesets. Use `--include-deps` to include changes from `devDependencies`, `peerDependencies`, or `optionalDependencies`.

### Examples

```bash
# Generate patch changesets for changes from main (default)
npx @izumisy/deps2changesets

# Generate changesets for a specific range
npx @izumisy/deps2changesets --range HEAD~3..HEAD

# Generate minor changesets
npx @izumisy/deps2changesets --range main..HEAD --release-type minor

# Run in a specific directory
npx @izumisy/deps2changesets --cwd /path/to/repo

# Preview changes without creating changesets
npx @izumisy/deps2changesets --dry-run

# Include devDependencies changes
npx @izumisy/deps2changesets --include-deps=dev

# Include both devDependencies and peerDependencies changes
npx @izumisy/deps2changesets --include-deps=dev,peer

# Synchronize changesets owned by one dependency-update group
npx @izumisy/deps2changesets --scope renovate-react-19
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

### Generated changeset filenames and scopes

Without a scope, changesets are written as `.changeset/deps2changesets-<hash>.md`, for example `.changeset/deps2changesets-1234abcd.md`.

With `--scope pr-123`, filenames include the scope: `.changeset/deps2changesets--pr-123--<hash>.md`. Each execution synchronizes only files in its scope: it creates the current dependency changesets and removes stale ones from that same scope. Files from other scopes and unscoped handwritten changesets are never changed. Existing unscoped generated files are not adopted, so remove them manually when moving an existing PR to a scope. Omitting `--scope` preserves the create-only behavior.

`<hash>` is the first eight hexadecimal characters of the SHA-256 hash of the package name, release type, and generated summary. The same dependency update therefore always has the same filename and is not duplicated when CI is re-run. If that filename already exists with different content, the command fails rather than overwriting it.

## GitHub Actions

You can automate changeset generation for Dependabot or Renovate PRs using the provided GitHub Action. On pull request runs, the action uses the PR number as its scope, so re-running after a rebase also removes changesets that no longer match the PR's dependency diff.

```yaml
# .github/workflows/dependabot-changeset.yml
name: Dependabot Changeset

on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: write
  pull-requests: write

jobs:
  generate-changeset:
    runs-on: ubuntu-latest
    if: github.actor == 'dependabot[bot]' || github.actor == 'renovate[bot]'
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: ${{ github.head_ref }}

      - name: Generate and commit changeset
        uses: izumisy/deps2changesets@v1
```

Remember to set `versioning-strategy: increase` to reflect version updates on package.json file.

### Action Inputs

| Input            | Description                                                                      | Default                                      |
| ---------------- | -------------------------------------------------------------------------------- | -------------------------------------------- |
| `release-type`   | Release type for changesets (`patch`, `minor`, `major`)                          | `patch`                                      |
| `include-deps`   | Dependency types to include (comma-separated: `prod`, `dev`, `peer`, `optional`) | `prod`                                       |
| `scope`          | Changeset group; defaults to the PR number on pull request runs                  | PR number                                    |
| `commit-message` | Commit message for the changeset                                                 | `chore: add changeset for dependency update` |
| `skip_commit`    | Skip committing the generated changesets                                         | `false`                                      |

### Example with Options

```yaml
- name: Generate and commit changeset
  uses: izumisy/deps2changesets@v1
  with:
    release-type: minor
    include-deps: prod,dev
    commit-message: "chore: add changeset for deps update"
    skip_commit: true # generate the changeset without committing it
```

## Usecase

- [IzumiSy/kyrage](https://github.com/IzumiSy/kyrage/)
- [IzumiSy/mcp-duckdb-memory-server](https://github.com/IzumiSy/mcp-duckdb-memory-server)
- [IzumiSy/mcp-universal-db-client](https://github.com/IzumiSy/mcp-universal-db-client)

## License

See [LICENSE](LICENSE) file for details.
