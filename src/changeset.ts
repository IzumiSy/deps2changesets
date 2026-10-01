import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
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
 * @param changes - Non-empty array of dependency changes (empty array is not expected)
 */
function generateSummaryFromChanges(changes: DependencyChange[]): string {
  let content: string;
  if (changes.length === 1) {
    // Single change: return a single line without heading
    content = generateSingleLineSummary(changes[0]);
  } else {
    // Use markdown list format with heading for multiple changes
    content = [
      "Dependencies updated\n",
      ...changes.map((c) => `- ${generateSingleLineSummary(c)}`),
    ].join("\n");
  }

  return content;
}

/**
 * Result of creating a single changeset
 */
export interface ChangesetResult {
  /** The changeset ID */
  id: string;
}

/**
 * Create changesets for changed packages
 * @returns Array of created changesets
 */
export async function createChangesets(
  changedPackages: PublicChangedPackage[],
  releaseType: "patch" | "minor" | "major",
  cwd: string,
): Promise<ChangesetResult[]> {
  const results: ChangesetResult[] = [];

  for (const changedPackage of changedPackages) {
    const packageName = changedPackage.package.packageJson.name;
    const summary = generateSummaryFromChanges(changedPackage.dependencyChanges);
    const hash = createHash("sha256")
      .update(`${packageName}\0${releaseType}\0${summary}`)
      .digest("hex");
    const changesetId = `deps2changesets-${hash.slice(0, 8)}`;
    const changesetPath = path.join(cwd, ".changeset", `${changesetId}.md`);
    const contents = `---\n${JSON.stringify(packageName)}: ${releaseType}\n---\n\n${summary}\n`;

    try {
      await writeFile(changesetPath, contents, { flag: "wx" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if ((await readFile(changesetPath, "utf8")) !== contents) {
        throw new Error(`Changeset filename collision: ${changesetId}`);
      }
    }

    results.push({ id: changesetId });
  }

  return results;
}
