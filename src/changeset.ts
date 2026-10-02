import { createHash } from "node:crypto";
import { readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PublicChangedPackage, DependencyChange } from "./types";

const changesetPrefix = "deps2changesets-";
const scopePattern = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/** Generate npm package URL */
function getNpmPackageUrl(packageName: string): string {
  return `https://www.npmjs.com/package/${packageName}`;
}

/** Generate a single line summary for a single dependency change */
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

/** Generate a human-readable summary from dependency changes */
function generateSummaryFromChanges(changes: DependencyChange[]): string {
  if (changes.length === 1) {
    return generateSingleLineSummary(changes[0]);
  }

  return [
    "Dependencies updated\n",
    ...changes.map((change) => `- ${generateSingleLineSummary(change)}`),
  ].join("\n");
}

function getChangesetPrefix(scope?: string): string {
  if (!scope) return changesetPrefix;
  if (!scopePattern.test(scope)) {
    throw new Error("Invalid scope: use letters, numbers, underscores, and hyphens only");
  }
  return `${changesetPrefix}-${scope}--`;
}

/** Result of synchronizing generated changesets */
export interface ChangesetSyncResult {
  /** Changesets that represent the current dependency diff */
  changesets: Array<{ id: string }>;
  /** Stale changesets removed from the requested scope */
  removed: string[];
}

/**
 * Create generated changesets and, when scoped, remove stale changesets from that scope.
 * Without a scope this preserves the original create-only behavior.
 */
export async function createChangesets(
  changedPackages: PublicChangedPackage[],
  releaseType: "patch" | "minor" | "major",
  cwd: string,
  scope?: string,
  dryRun = false,
): Promise<ChangesetSyncResult> {
  const prefix = getChangesetPrefix(scope);
  const changesetDir = path.join(cwd, ".changeset");
  const desired = changedPackages.map((changedPackage) => {
    const packageName = changedPackage.package.packageJson.name;
    const summary = generateSummaryFromChanges(changedPackage.dependencyChanges);
    const hash = createHash("sha256")
      .update(`${packageName}\0${releaseType}\0${summary}`)
      .digest("hex");
    const id = `${prefix}${hash.slice(0, 8)}`;
    return {
      id,
      contents: `---\n${JSON.stringify(packageName)}: ${releaseType}\n---\n\n${summary}\n`,
    };
  });

  // Verify all existing desired files before changing anything.
  const existing = new Set<string>();
  for (const changeset of desired) {
    try {
      const contents = await readFile(path.join(changesetDir, `${changeset.id}.md`), "utf8");
      if (contents !== changeset.contents) {
        throw new Error(`Changeset filename collision: ${changeset.id}`);
      }
      existing.add(changeset.id);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  const desiredIds = new Set(desired.map((changeset) => changeset.id));
  const removed = scope
    ? (await readdir(changesetDir))
        .filter(
          (file) => file.startsWith(prefix) && /^[a-f0-9]{8}\.md$/.test(file.slice(prefix.length)),
        )
        .map((file) => file.slice(0, -".md".length))
        .filter((id) => !desiredIds.has(id))
    : [];

  if (!dryRun) {
    for (const changeset of desired) {
      if (!existing.has(changeset.id)) {
        await writeFile(path.join(changesetDir, `${changeset.id}.md`), changeset.contents, {
          flag: "wx",
        });
      }
    }
    await Promise.all(removed.map((id) => unlink(path.join(changesetDir, `${id}.md`))));
  }

  return { changesets: desired.map(({ id }) => ({ id })), removed };
}
