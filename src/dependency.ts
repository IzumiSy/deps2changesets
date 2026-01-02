import path from "path";
import { getPackages } from "@manypkg/get-packages";
import type { IGitClient } from "./interfaces";
import type { ChangedPackage, PackageJson, DependencyChange } from "./types";

/**
 * Service class for analyzing dependency changes from Git commit ranges
 */
export class DependencyChangeAnalyzer {
  constructor(
    private readonly client: IGitClient,
    private readonly fromRef: string,
    private readonly toRef: string
  ) {}

  /**
   * Detect packages that have changes in their package.json files from Git commit range
   */
  async detectChangedPackages(cwd: string): Promise<ChangedPackage[]> {
    console.log(`Analyzing changes from ${this.fromRef} to ${this.toRef}...`);

    // Get all changed files in the commit range
    const files = await this.client.getChangedFiles(this.fromRef, this.toRef);
    console.log(`Found ${files.length} changed file(s)`);

    // Filter for package.json files
    const packageJsonFiles = files.filter(
      (file) =>
        file.path.endsWith("package.json") &&
        (file.status === "modified" || file.status === "added")
    );

    console.log(
      `Found ${packageJsonFiles.length} changed package.json file(s)`
    );

    if (packageJsonFiles.length === 0) {
      return [];
    }

    // Get all packages in the workspace
    const { packages, rootPackage } = await getPackages(cwd);
    const allPackages = rootPackage ? [rootPackage, ...packages] : packages;

    console.log(`Found ${allPackages.length} package(s) in workspace`);

    // Match changed package.json files to workspace packages
    const changedPackages: ChangedPackage[] = [];

    for (const file of packageJsonFiles) {
      // Find the matching package
      const pkg = allPackages.find((p) => {
        const packageJsonPath = path.relative(
          cwd,
          path.join(p.dir, "package.json")
        );
        return (
          packageJsonPath === file.path || file.path.endsWith(packageJsonPath)
        );
      });

      if (!pkg) {
        console.warn(`Could not find package for ${file.path}`);
        continue;
      }

      try {
        // Fetch base (before) and head (after) package.json content
        const [baseContent, headContent] = await Promise.all([
          this.client.getFileContent(file.path, this.fromRef),
          this.client.getFileContent(file.path, this.toRef),
        ]);

        const basePackageJson = JSON.parse(baseContent) as PackageJson;
        const headPackageJson = JSON.parse(headContent) as PackageJson;

        // Compare package.json files to detect dependency changes
        const dependencyChanges = this.comparePackageJsons(
          basePackageJson,
          headPackageJson
        );

        if (dependencyChanges.length > 0) {
          console.log(
            `Found ${dependencyChanges.length} dependency change(s) in ${pkg.packageJson.name}`
          );

          changedPackages.push({
            package: {
              dir: pkg.dir,
              relativeDir: pkg.relativeDir,
              packageJson: pkg.packageJson,
            },
            dependencyChanges,
          });
        }
      } catch (error) {
        console.warn(`Failed to analyze ${file.path}: ${error}`);
      }
    }

    return changedPackages;
  }

  /**
   * Check if a changeset commit already exists in Git commit range
   */
  async checkForExistingChangeset(prefix: string): Promise<boolean> {
    const commits = await this.client.getCommits(this.fromRef, this.toRef);
    return commits.some((commit) => commit.message.startsWith(prefix));
  }

  /**
   * Compare two package.json objects to extract dependency changes
   */
  private comparePackageJsons(
    basePackageJson: PackageJson,
    headPackageJson: PackageJson
  ): DependencyChange[] {
    const changes: DependencyChange[] = [];

    // Collect all dependency types
    const depTypes = [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ] as const;

    for (const depType of depTypes) {
      const baseDeps = basePackageJson[depType] || {};
      const headDeps = headPackageJson[depType] || {};

      // Get all unique dependency names
      const allDeps = new Set([
        ...Object.keys(baseDeps),
        ...Object.keys(headDeps),
      ]);

      for (const name of allDeps) {
        const oldVersion = baseDeps[name];
        const newVersion = headDeps[name];

        if (oldVersion && newVersion && oldVersion !== newVersion) {
          // Dependency was updated
          changes.push({
            name,
            type: "updated",
            oldVersion,
            newVersion,
          });
        } else if (!oldVersion && newVersion) {
          // Dependency was added
          changes.push({
            name,
            type: "added",
            newVersion,
          });
        } else if (oldVersion && !newVersion) {
          // Dependency was removed
          changes.push({
            name,
            type: "removed",
            oldVersion,
          });
        }
      }
    }

    return changes;
  }
}
