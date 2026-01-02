import writeChangeset from "@changesets/write";
import type { PublicChangedPackage, DependencyChange } from "./types";

/**
 * Generate npm package URL
 */
function getNpmPackageUrl(packageName: string): string {
  return `https://www.npmjs.com/package/${packageName}`;
}

/**
 * Generate a single line summary for a single dependency change
 */
function generateSingleLineSummary(change: DependencyChange): string {
  const link = `[${change.name}](${getNpmPackageUrl(change.name)})`;
  switch (change.type) {
    case "updated":
      return `Updated ${link} (${change.oldVersion} -> ${change.newVersion})`;
    case "added":
      return `Added ${link} (${change.newVersion})`;
    case "removed":
      return `Removed ${link} (${change.oldVersion})`;
  }
}

/**
 * Generate a human-readable summary from dependency changes
 */
function generateSummaryFromChanges(changes: DependencyChange[]): string {
  if (changes.length === 0) {
    return "Updated dependencies";
  }

  // Single change: return a single line without heading
  if (changes.length === 1) {
    return generateSingleLineSummary(changes[0]);
  }

  // Use markdown list format with heading for multiple changes
  return [
    "Dependencies updated\n",
    ...changes.map((c) => `- ${generateSingleLineSummary(c)}`),
  ].join("\n");
}

/**
 * Create changesets for changed packages
 */
export async function createChangesets(
  changedPackages: PublicChangedPackage[],
  releaseType: "patch" | "minor" | "major",
  cwd: string
): Promise<string[]> {
  if (changedPackages.length === 0) {
    return [];
  }

  const changesetIds: string[] = [];

  for (const changedPackage of changedPackages) {
    const summary = generateSummaryFromChanges(
      changedPackage.dependencyChanges
    );

    const changesetId = await writeChangeset(
      {
        summary,
        releases: [
          {
            name: changedPackage.package.packageJson.name,
            type: releaseType,
          },
        ],
      },
      cwd
    );

    changesetIds.push(changesetId);
  }

  return changesetIds;
}
