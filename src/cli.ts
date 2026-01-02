#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
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

const main = defineCommand({
  meta: {
    name: "simple-dependabot-changeset",
    version: "1.0.0",
    description: "Generate changesets from dependency changes in Git commits",
  },
  args: {
    range: {
      type: "positional",
      description:
        "Git commit range (e.g., 'main..HEAD', 'a1b2c3..d4e5f6'). Defaults to 'main..HEAD' for dependabot branches.",
      required: false,
      default: "main..HEAD",
    },
    releaseType: {
      type: "string",
      description: "Release type for changesets",
      default: "patch",
      valueHint: "patch|minor|major",
    },
    cwd: {
      type: "string",
      description: "Working directory",
      default: process.cwd(),
    },
    dryRun: {
      type: "boolean",
      description: "Preview changes without creating changesets",
      default: false,
    },
  },
  async run({ args }) {
    const { range, releaseType, cwd, dryRun } = args;
    const { from, to } = parseGitRange(range);

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

    if (changedPackages.length === 0) {
      renderResult(0, dryRun);
      return;
    }

    // Render the changes
    renderChangedPackages(changedPackages);

    // Create changesets (unless dry-run)
    let createdCount = changedPackages.length;
    if (!dryRun) {
      const changesetIds = await createChangesets(
        changedPackages,
        releaseType as "patch" | "minor" | "major",
        cwd
      );
      createdCount = changesetIds.length;

      // Warn if some packages were skipped (private packages)
      const skippedCount = changedPackages.length - createdCount;
      if (skippedCount > 0) {
        console.log(
          `ℹ Skipped ${skippedCount} private package(s) (changesets not needed)`
        );
      }
    }

    renderResult(createdCount, dryRun);
  },
});

runMain(main);
