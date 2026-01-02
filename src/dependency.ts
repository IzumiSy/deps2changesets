import path from "path";
import { getPackages, type Package } from "@manypkg/get-packages";
import { silentLogger, type IGitClient, type ILogger } from "./interfaces";
import type { ChangedPackage, PackageJson, DependencyChange } from "./types";

/**
 * Collection object representing all packages in a workspace
 */
export class WorkspacePackages {
  private constructor(
    private readonly packages: Package[],
    private readonly cwd: string
  ) {}

  /**
   * Load all packages from a workspace directory
   */
  static async load(cwd: string): Promise<WorkspacePackages> {
    const { packages, rootPackage } = await getPackages(cwd);
    const allPackages = rootPackage ? [rootPackage, ...packages] : packages;
    return new WorkspacePackages(allPackages, cwd);
  }

  /**
   * Get the number of packages in the workspace
   */
  count(): number {
    return this.packages.length;
  }

  /**
   * Find a package by its package.json file path
   */
  findByFilePath(filePath: string): Package | undefined {
    return this.packages.find((p) => {
      const packageJsonPath = path.relative(
        this.cwd,
        path.join(p.dir, "package.json")
      );
      return packageJsonPath === filePath || filePath.endsWith(packageJsonPath);
    });
  }
}

/**
 * Service class for analyzing dependency changes from Git commit ranges
 */
export class DependencyChangeAnalyzer {
  constructor(
    private readonly client: IGitClient,
    private readonly fromRef: string,
    private readonly toRef: string,
    private readonly logger: ILogger = silentLogger
  ) {}

  /**
   * Detect packages that have changes in their package.json files from Git commit range
   */
  async detectChangedPackages(cwd: string): Promise<ChangedPackage[]> {
    const packageJsonFiles = await this.getChangedPackageJsonFiles();
    if (packageJsonFiles.length === 0) {
      return [];
    }

    // Get all packages in the workspace
    const workspacePackages = await WorkspacePackages.load(cwd);

    this.logger.info(
      `Found ${workspacePackages.count()} package(s) in workspace`
    );

    // Match changed package.json files to workspace packages
    const changedPackages: ChangedPackage[] = [];

    for (const file of packageJsonFiles) {
      const pkg = workspacePackages.findByFilePath(file.path);
      if (!pkg) {
        this.logger.warn(`Could not find package for ${file.path}`);
        continue;
      }

      const dependencyChanges = await this.analyzeDependencyChanges(file.path);
      if (dependencyChanges.length === 0) {
        continue;
      }

      this.logger.info(
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

    return changedPackages;
  }

  /**
   * Analyze a single package.json file for dependency changes
   */
  private async analyzeDependencyChanges(
    filePath: string
  ): Promise<DependencyChange[]> {
    try {
      // Fetch base (before) and head (after) package.json content
      const [baseContent, headContent] = await Promise.all([
        this.client.getFileContent(filePath, this.fromRef),
        this.client.getFileContent(filePath, this.toRef),
      ]);

      const basePackageJson = JSON.parse(baseContent) as PackageJson;
      const headPackageJson = JSON.parse(headContent) as PackageJson;

      // Compare package.json files to detect dependency changes
      return this.comparePackageJsons(basePackageJson, headPackageJson);
    } catch (error) {
      this.logger.warn(`Failed to analyze ${filePath}: ${error}`);
      return [];
    }
  }

  /**
   * Get all changed package.json files from Git commit range
   */
  private async getChangedPackageJsonFiles(): Promise<
    Array<{ path: string; status: string }>
  > {
    this.logger.info(
      `Analyzing changes from ${this.fromRef} to ${this.toRef}...`
    );

    // Get all changed files in the commit range
    const files = await this.client.getChangedFiles(this.fromRef, this.toRef);
    this.logger.info(`Found ${files.length} changed file(s)`);

    // Filter for package.json files
    const packageJsonFiles = files.filter(
      (file) =>
        file.path.endsWith("package.json") &&
        (file.status === "modified" || file.status === "added")
    );

    this.logger.info(
      `Found ${packageJsonFiles.length} changed package.json file(s)`
    );

    return packageJsonFiles;
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
