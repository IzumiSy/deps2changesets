import writeChangeset from "@changesets/write";
import { silentLogger, type ILogger } from "./interfaces";
import type { ChangedPackage, DependencyChange } from "./types";

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
    lines.push(`- Updated ${c.name} (${c.oldVersion} -> ${c.newVersion})`);
  });

  additions.forEach((c) => {
    lines.push(`- Added ${c.name} (${c.newVersion})`);
  });

  removals.forEach((c) => {
    lines.push(`- Removed ${c.name} (${c.oldVersion})`);
  });

  return lines.join("\n");
}

/**
 * Create changesets for changed packages
 */
export async function createChangesets(
  changedPackages: ChangedPackage[],
  releaseType: "patch" | "minor" | "major",
  cwd: string,
  logger: ILogger = silentLogger
): Promise<string[]> {
  if (changedPackages.length === 0) {
    logger.info("No packages to create changesets for");
    return [];
  }

  const changesetIds: string[] = [];

  for (const changedPackage of changedPackages) {
    const summary = generateSummaryFromChanges(
      changedPackage.dependencyChanges
    );
    logger.info(
      `Creating changeset for ${changedPackage.package.packageJson.name}: ${summary.split("\n")[0]}`
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
    logger.info(`Created changeset with ID: ${changesetId}`);
  }

  return changesetIds;
}
