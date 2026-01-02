#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { DependencyChangeAnalyzer } from "./dependency";
import { createChangesets } from "./changeset";
import { GitClientAdapter } from "./git";

const main = defineCommand({
  meta: {
    name: "simple-dependabot-changeset",
    version: "1.0.0",
    description: "Generate changesets from dependency changes in Git commits",
  },
  args: {
    from: {
      type: "string",
      description: "Starting commit ref (e.g., HEAD~1, commit hash)",
      required: true,
    },
    to: {
      type: "string",
      description: "Ending commit ref (e.g., HEAD, branch name)",
      default: "HEAD",
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
    const { from, to, releaseType, prefix, cwd } = args;

    // Validate release type
    if (!["patch", "minor", "major"].includes(releaseType)) {
      throw new Error(
        `Invalid release type: ${releaseType}. Must be patch, minor, or major.`
      );
    }

    console.log(`Analyzing changes from ${from} to ${to}...`);

    // Initialize analyzer with Git adapter
    const analyzer = new DependencyChangeAnalyzer(
      new GitClientAdapter(cwd),
      from,
      to
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
      cwd
    );

    console.log("✓ Changesets created successfully!");
  },
});

runMain(main);
