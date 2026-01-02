import path from 'path';
import writeChangeset from '@changesets/write';
import { getPackages } from '@manypkg/get-packages';
import type { IGitClient } from './interfaces';
import type { ChangedPackage, PackageJson, DependencyChange } from './types';

/**
 * Service class for managing changeset creation from dependency changes
 */
export class ChangesetService {
  constructor(private readonly client: IGitClient) {}

  /**
   * Detect packages that have changes in their package.json files from Git commit range
   */
  async detectChangedPackages(
    fromRef: string,
    toRef: string,
    cwd: string
  ): Promise<ChangedPackage[]> {
    console.log(`Analyzing changes from ${fromRef} to ${toRef}...`);

    // Get all changed files in the commit range
    const files = await this.client.getChangedFiles(fromRef, toRef);
    console.log(`Found ${files.length} changed file(s)`);

    // Filter for package.json files
    const packageJsonFiles = files.filter(
      file =>
        file.path.endsWith('package.json') &&
        (file.status === 'modified' || file.status === 'added')
    );

    console.log(`Found ${packageJsonFiles.length} changed package.json file(s)`);

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
      const pkg = allPackages.find(p => {
        const packageJsonPath = path.relative(cwd, path.join(p.dir, 'package.json'));
        return packageJsonPath === file.path || file.path.endsWith(packageJsonPath);
      });

      if (!pkg) {
        console.warn(`Could not find package for ${file.path}`);
        continue;
      }

      try {
        // Fetch base (before) and head (after) package.json content
        const [baseContent, headContent] = await Promise.all([
          this.client.getFileContent(file.path, fromRef),
          this.client.getFileContent(file.path, toRef),
        ]);

        const basePackageJson = JSON.parse(baseContent) as PackageJson;
        const headPackageJson = JSON.parse(headContent) as PackageJson;

        // Compare package.json files to detect dependency changes
        const dependencyChanges = this.comparePackageJsons(basePackageJson, headPackageJson);

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
  async checkForExistingChangeset(
    fromRef: string,
    toRef: string,
    prefix: string
  ): Promise<boolean> {
    const commits = await this.client.getCommits(fromRef, toRef);
    return commits.some(commit => commit.message.startsWith(prefix));
  }

  /**
   * Create changesets for changed packages
   */
  async createChangesets(
    changedPackages: ChangedPackage[],
    releaseType: 'patch' | 'minor' | 'major',
    cwd: string
  ): Promise<string[]> {
    if (changedPackages.length === 0) {
      console.log('No packages to create changesets for');
      return [];
    }

    const changesetIds: string[] = [];

    for (const changedPackage of changedPackages) {
      const summary = this.generateSummaryFromChanges(changedPackage.dependencyChanges);
      console.log(
        `Creating changeset for ${changedPackage.package.packageJson.name}: ${summary.split('\n')[0]}`
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
      console.log(`Created changeset with ID: ${changesetId}`);
    }

    return changesetIds;
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
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ] as const;

    for (const depType of depTypes) {
      const baseDeps = basePackageJson[depType] || {};
      const headDeps = headPackageJson[depType] || {};

      // Get all unique dependency names
      const allDeps = new Set([...Object.keys(baseDeps), ...Object.keys(headDeps)]);

      for (const name of allDeps) {
        const oldVersion = baseDeps[name];
        const newVersion = headDeps[name];

        if (oldVersion && newVersion && oldVersion !== newVersion) {
          // Dependency was updated
          changes.push({
            name,
            type: 'updated',
            oldVersion,
            newVersion,
          });
        } else if (!oldVersion && newVersion) {
          // Dependency was added
          changes.push({
            name,
            type: 'added',
            newVersion,
          });
        } else if (oldVersion && !newVersion) {
          // Dependency was removed
          changes.push({
            name,
            type: 'removed',
            oldVersion,
          });
        }
      }
    }

    return changes;
  }

  /**
   * Generate a human-readable summary from dependency changes
   */
  private generateSummaryFromChanges(changes: DependencyChange[]): string {
    if (changes.length === 0) {
      return 'Updated dependencies';
    }

    const updates = changes.filter(c => c.type === 'updated');
    const additions = changes.filter(c => c.type === 'added');
    const removals = changes.filter(c => c.type === 'removed');

    // Use markdown list format
    const lines: string[] = ['Dependencies updated\n'];

    updates.forEach(c => {
      lines.push(`- Updated ${c.name} (${c.oldVersion} -> ${c.newVersion})`);
    });

    additions.forEach(c => {
      lines.push(`- Added ${c.name} (${c.newVersion})`);
    });

    removals.forEach(c => {
      lines.push(`- Removed ${c.name} (${c.oldVersion})`);
    });

    return lines.join('\n');
  }
}
