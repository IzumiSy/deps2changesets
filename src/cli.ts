#!/usr/bin/env node
import * as pkg from "../package.json";
import fs from "node:fs";
import path from "node:path";
import { cli, define } from "gunshi";
import { consola } from "consola";
import { DependencyChangeAnalyzer } from "./dependency";
import { createChangesets } from "./changeset";
import { GitClientAdapter } from "./git";
import { renderChangedPackages, renderResult } from "./renderer";

/**
 * Parse a Git range string (e.g., "a..b") into from/to refs.
 * If no ".." is found, treats the input as the "from" ref with "HEAD" as "to".
 */
function parseGitRange(range: string): { from: string; to: string } {
  if (range.includes("..")) {
    const [from, to] = range.split("..");
    return {
      from: from || "HEAD",
      to: to || "HEAD",
    };
  }
  // If no ".." separator, treat the whole string as "from" with HEAD as "to"
  return { from: range, to: "HEAD" };
}

/**
 * Check if .changeset directory exists
 */
function hasChangesetDirectory(cwd: string): boolean {
  return fs.existsSync(path.join(cwd, ".changeset"));
}

const command = define({
  toKebab: true,
  args: {
    range: {
      type: "string",
      short: "r",
      description:
        "Git commit range (e.g., 'main..HEAD', 'a1b2c3..d4e5f6'). Defaults to 'main..HEAD' for dependabot branches.",
      default: "main..HEAD",
    },
    releaseType: {
      type: "string",
      short: "t",
      description: "Release type for changesets (patch|minor|major)",
      default: "patch",
    },
    cwd: {
      type: "string",
      short: "c",
      description: "Working directory",
      default: process.cwd(),
    },
    dryRun: {
      type: "boolean",
      short: "d",
      description: "Preview changes without creating changesets",
      default: false,
    },
  },
  async run(ctx) {
    const {
      range = "main..HEAD",
      releaseType = "patch",
      cwd = process.cwd(),
      dryRun = false,
    } = ctx.values;
    const { from, to } = parseGitRange(range);

    // Check if .changeset directory exists
    if (!hasChangesetDirectory(cwd)) {
      throw new Error(
        "No .changeset directory found. Please initialize changesets first with `npx @changesets/cli init`."
      );
    }

    // Validate release type
    if (!["patch", "minor", "major"].includes(releaseType)) {
      throw new Error(
        `Invalid release type: ${releaseType}. Must be patch, minor, or major.`
      );
    }

    // Initialize analyzer with Git adapter
    const analyzer = new DependencyChangeAnalyzer(
      new GitClientAdapter(cwd),
      from,
      to
    );

    // Detect changed packages
    const changedPackages = await analyzer.detectChangedPackages(cwd);

    const publicPackages = changedPackages.filter((pkg) => !pkg.private);
    const privateCount = changedPackages.filter((pkg) => pkg.private).length;

    // Log skipped private packages (once, regardless of outcome)
    if (privateCount > 0) {
      console.log(
        `ℹ Skipped ${privateCount} private package(s) (changesets not needed)`
      );
    }

    // Render the changes
    renderChangedPackages(publicPackages);

    // Create changesets (unless dry-run)
    if (!dryRun) {
      await createChangesets(
        publicPackages,
        releaseType as "patch" | "minor" | "major",
        cwd
      );
    }

    renderResult(publicPackages.length, dryRun);
  },
});

await cli(process.argv.slice(2), command, {
  name: "deps2changesets",
  version: pkg.version,
  description: "Generate changesets from dependency changes in Git commits",
  onErrorCommand: (_ctx, error) => {
    consola.error(error.message);
    process.exit(1);
  },
});
