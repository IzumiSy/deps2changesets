import path from "path";
import { getPackages, type Package } from "@manypkg/get-packages";
import type { IGitClient } from "./interfaces";
import type {
  ChangedPackage,
  PackageJson,
  DependencyChange,
  DepType,
} from "./types";

/**
 * Map short dep type names to package.json keys
 */
const DEP_TYPE_MAP = {
  prod: "dependencies",
  dev: "devDependencies",
  peer: "peerDependencies",
  optional: "optionalDependencies",
} as const;

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
   * Create a WorkspacePackages instance from an array of packages (for testing)
   */
  static fromPackages(packages: Package[], cwd: string): WorkspacePackages {
    return new WorkspacePackages(packages, cwd);
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
    // Resolve to absolute path for reliable cross-platform comparison
    const absoluteFilePath = path.resolve(this.cwd, filePath);
    return this.packages.find((p) => {
      const packageJsonPath = path.join(p.dir, "package.json");
      return absoluteFilePath === packageJsonPath;
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
    private readonly includedDepTypes: DepType[]
  ) {}

  /**
   * Detect packages that have changes in their package.json files from Git commit range
   * @param workspacePackages Workspace packages to check
   */
  async detectChangedPackages(
    workspacePackages: WorkspacePackages
  ): Promise<ChangedPackage[]> {
    const packageJsonFiles = await this.getChangedPackageJsonFiles();
    if (packageJsonFiles.length === 0) {
      return [];
    }

    // Match changed package.json files to workspace packages
    const changedPackages: ChangedPackage[] = [];

    for (const file of packageJsonFiles) {
      const pkg = workspacePackages.findByFilePath(file.path);
      if (!pkg) {
        continue;
      }

      // Skip private packages early, no need to analyze dependencies
      if (pkg.packageJson.private) {
        changedPackages.push({
          private: true,
          package: pkg,
        });
        continue;
      }

      const dependencyChanges = await this.analyzeDependencyChanges(file.path);
      if (dependencyChanges.length === 0) {
        continue;
      }

      changedPackages.push({
        private: false,
        package: pkg,
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
    } catch {
      return [];
    }
  }

  /**
   * Get all changed package.json files from Git commit range
   */
  private async getChangedPackageJsonFiles(): Promise<
    Array<{ path: string; status: string }>
  > {
    // Get all changed files in the commit range
    const files = await this.client.getChangedFiles(this.fromRef, this.toRef);

    // Filter for package.json files
    const packageJsonFiles = files.filter(
      (file) =>
        file.path.endsWith("package.json") &&
        (file.status === "modified" || file.status === "added")
    );

    return packageJsonFiles;
  }

  /**
   * Compare two package.json objects to extract dependency changes
   */
  private comparePackageJsons(
    basePackageJson: PackageJson,
    headPackageJson: PackageJson
  ): DependencyChange[] {
    // Get unique dependency keys to check
    const depTypes = [
      ...new Set(this.includedDepTypes.map((t) => DEP_TYPE_MAP[t])),
    ];

    return depTypes.flatMap((depType) => {
      const baseDeps = basePackageJson[depType] || {};
      const headDeps = headPackageJson[depType] || {};
      const allDeps = new Set([
        ...Object.keys(baseDeps),
        ...Object.keys(headDeps),
      ]);

      return [...allDeps].flatMap((name): DependencyChange[] => {
        const oldVersion = baseDeps[name];
        const newVersion = headDeps[name];

        if (oldVersion && newVersion && oldVersion !== newVersion) {
          return [{ name, type: "updated", oldVersion, newVersion }];
        } else if (!oldVersion && newVersion) {
          return [{ name, type: "added", newVersion }];
        } else if (oldVersion && !newVersion) {
          return [{ name, type: "removed", oldVersion }];
        } else {
          return [];
        }
      });
    });
  }
}
