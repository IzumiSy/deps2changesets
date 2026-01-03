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
import { commandArgs } from "./types";
import type { DepType } from "./types";

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
  args: commandArgs,
  async run(ctx) {
    const { range, releaseType, cwd, dryRun, includeDeps } = ctx.values;
    const { from, to } = parseGitRange(range);

    // Check if .changeset directory exists
    if (!hasChangesetDirectory(cwd)) {
      throw new Error(
        "No .changeset directory found. Please initialize changesets first with `npx @changesets/cli init`."
      );
    }

    // Initialize analyzer with Git adapter
    const analyzer = new DependencyChangeAnalyzer(
      new GitClientAdapter(cwd),
      from,
      to
    );

    // Detect changed packages
    const changedPackages = await analyzer.detectChangedPackages(
      cwd,
      includeDeps as DepType[]
    );

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
