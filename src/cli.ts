#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { DependencyChangeAnalyzer } from "./dependency";
import { createChangesets } from "./changeset";
import { GitClientAdapter } from "./git";
import { consoleLogger } from "./interfaces";

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
    prefix: {
      type: "string",
      description: "Commit message prefix to check for existing changesets",
      default: "[add changeset]",
    },
    cwd: {
      type: "string",
      description: "Working directory",
      default: process.cwd(),
    },
  },
  async run({ args }) {
    const { range, releaseType, prefix, cwd } = args;
    const { from, to } = parseGitRange(range);

    // Validate release type
    if (!["patch", "minor", "major"].includes(releaseType)) {
      throw new Error(
        `Invalid release type: ${releaseType}. Must be patch, minor, or major.`
      );
    }

    console.log(`Analyzing changes from ${from} to ${to}...`);

    // Initialize analyzer with Git adapter and console logger
    const analyzer = new DependencyChangeAnalyzer(
      new GitClientAdapter(cwd),
      from,
      to,
      consoleLogger
    );

    // Detect changed packages
    const changedPackages = await analyzer.detectChangedPackages(cwd);

    if (changedPackages.length === 0) {
      console.log("No package.json dependency changes detected.");
      return;
    }

    console.log(
      `Found ${changedPackages.length} package(s) with dependency changes:`
    );
    for (const pkg of changedPackages) {
      console.log(
        `  - ${pkg.package.packageJson.name}: ${pkg.dependencyChanges.length} change(s)`
      );
    }

    // Check for existing changeset commits
    const hasChangesetCommit = await analyzer.checkForExistingChangeset(prefix);

    if (hasChangesetCommit) {
      console.log(
        "Changeset commit already exists in this range. Skipping creation."
      );
      return;
    }

    // Create changesets
    await createChangesets(
      changedPackages,
      releaseType as "patch" | "minor" | "major",
      cwd,
      consoleLogger
    );

    console.log("✓ Changesets created successfully!");
  },
});

runMain(main);
