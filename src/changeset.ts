import writeChangeset from "@changesets/write";
import type { ChangedPackage, DependencyChange } from "./types";

/**
 * Generate npm package URL
 */
function getNpmPackageUrl(packageName: string): string {
  return `https://www.npmjs.com/package/${packageName}`;
}

/**
 * Generate a human-readable summary from dependency changes
 */
function generateSummaryFromChanges(changes: DependencyChange[]): string {
  if (changes.length === 0) {
    return "Updated dependencies";
  }

  const updates = changes.filter((c) => c.type === "updated");
  const additions = changes.filter((c) => c.type === "added");
  const removals = changes.filter((c) => c.type === "removed");

  // Use markdown list format
  const lines: string[] = ["Dependencies updated\n"];

  updates.forEach((c) => {
    const link = `[${c.name}](${getNpmPackageUrl(c.name)})`;
    lines.push(`- Updated ${link} (${c.oldVersion} -> ${c.newVersion})`);
  });

  additions.forEach((c) => {
    const link = `[${c.name}](${getNpmPackageUrl(c.name)})`;
    lines.push(`- Added ${link} (${c.newVersion})`);
  });

  removals.forEach((c) => {
    const link = `[${c.name}](${getNpmPackageUrl(c.name)})`;
    lines.push(`- Removed ${link} (${c.oldVersion})`);
  });

  return lines.join("\n");
}

/**
 * Create changesets for changed packages
 */
export async function createChangesets(
  changedPackages: ChangedPackage[],
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
