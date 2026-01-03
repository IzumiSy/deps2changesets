import { describe, it, expect, vi, beforeEach, assert } from "vitest";
import { DependencyChangeAnalyzer, WorkspacePackages } from "./dependency";
import { commandArgs } from "./types";
import type { IGitClient } from "./interfaces";
import type { Package } from "@manypkg/get-packages";

// Default includeDeps value from CLI args
const defaultIncludeDeps = [commandArgs.includeDeps.default];

// Helper to create a mock package
const createMockPackage = (
  name: string,
  dir: string,
  isPrivate = false
): Package =>
  ({
    dir,
    relativeDir: ".",
    packageJson: { name, version: "1.0.0", private: isPrivate },
  }) as Package;

describe("DependencyChangeAnalyzer", () => {
  let mockGitClient: IGitClient;
  let workspacePackages: WorkspacePackages;

  beforeEach(() => {
    mockGitClient = {
      getChangedFiles: vi.fn(),
      getFileContent: vi.fn(),
    };

    // Default workspace with a single package
    workspacePackages = WorkspacePackages.fromPackages(
      [createMockPackage("test-package", "/test")],
      "/test"
    );
  });

  describe("detectChangedPackages", () => {
    it("should detect single dependency update", async () => {
      const basePackageJson = {
        name: "test-package",
        version: "1.0.0",
        dependencies: {
          lodash: "^4.17.19",
        },
      };

      const headPackageJson = {
        name: "test-package",
        version: "1.0.0",
        dependencies: {
          lodash: "^4.17.21",
        },
      };

      vi.mocked(mockGitClient.getChangedFiles).mockResolvedValue([
        { path: "package.json", status: "modified" },
      ]);

      vi.mocked(mockGitClient.getFileContent)
        .mockResolvedValueOnce(JSON.stringify(basePackageJson))
        .mockResolvedValueOnce(JSON.stringify(headPackageJson));

      const analyzer = new DependencyChangeAnalyzer(
        mockGitClient,
        "HEAD~1",
        "HEAD",
        defaultIncludeDeps
      );
      const result = await analyzer.detectChangedPackages(workspacePackages);

      expect(result).toHaveLength(1);
      const pkg = result[0];
      expect(pkg.private).toBe(false);
      assert(pkg.private === false);
      expect(pkg.dependencyChanges).toHaveLength(1);
      expect(pkg.dependencyChanges[0].name).toBe("lodash");
      expect(pkg.dependencyChanges[0].type).toBe("updated");
      expect(pkg.dependencyChanges[0].oldVersion).toBe("^4.17.19");
      expect(pkg.dependencyChanges[0].newVersion).toBe("^4.17.21");
    });

    it("should return empty array when no package.json files changed", async () => {
      vi.mocked(mockGitClient.getChangedFiles).mockResolvedValue([
        { path: "README.md", status: "modified" },
      ]);

      const analyzer = new DependencyChangeAnalyzer(
        mockGitClient,
        "HEAD~1",
        "HEAD",
        defaultIncludeDeps
      );
      const result = await analyzer.detectChangedPackages(workspacePackages);

      expect(result).toHaveLength(0);
    });

    it("should detect added dependency", async () => {
      const basePackageJson = {
        name: "test-package",
        version: "1.0.0",
        dependencies: {},
      };

      const headPackageJson = {
        name: "test-package",
        version: "1.0.0",
        dependencies: {
          lodash: "^4.17.21",
        },
      };

      vi.mocked(mockGitClient.getChangedFiles).mockResolvedValue([
        { path: "package.json", status: "modified" },
      ]);

      vi.mocked(mockGitClient.getFileContent)
        .mockResolvedValueOnce(JSON.stringify(basePackageJson))
        .mockResolvedValueOnce(JSON.stringify(headPackageJson));

      const analyzer = new DependencyChangeAnalyzer(
        mockGitClient,
        "HEAD~1",
        "HEAD",
        defaultIncludeDeps
      );
      const result = await analyzer.detectChangedPackages(workspacePackages);

      expect(result).toHaveLength(1);
      const pkg = result[0];
      assert(pkg.private === false);
      expect(pkg.dependencyChanges).toHaveLength(1);
      expect(pkg.dependencyChanges[0].type).toBe("added");
      expect(pkg.dependencyChanges[0].newVersion).toBe("^4.17.21");
    });

    it("should detect removed dependency", async () => {
      const basePackageJson = {
        name: "test-package",
        version: "1.0.0",
        dependencies: {
          lodash: "^4.17.21",
        },
      };

      const headPackageJson = {
        name: "test-package",
        version: "1.0.0",
        dependencies: {},
      };

      vi.mocked(mockGitClient.getChangedFiles).mockResolvedValue([
        { path: "package.json", status: "modified" },
      ]);

      vi.mocked(mockGitClient.getFileContent)
        .mockResolvedValueOnce(JSON.stringify(basePackageJson))
        .mockResolvedValueOnce(JSON.stringify(headPackageJson));

      const analyzer = new DependencyChangeAnalyzer(
        mockGitClient,
        "HEAD~1",
        "HEAD",
        defaultIncludeDeps
      );
      const result = await analyzer.detectChangedPackages(workspacePackages);

      expect(result).toHaveLength(1);
      const pkg = result[0];
      assert(pkg.private === false);
      expect(pkg.dependencyChanges).toHaveLength(1);
      expect(pkg.dependencyChanges[0].type).toBe("removed");
      expect(pkg.dependencyChanges[0].oldVersion).toBe("^4.17.21");
    });

    it("should only include production dependencies by default", async () => {
      const basePackageJson = {
        name: "test-package",
        version: "1.0.0",
        dependencies: {
          lodash: "^4.17.19",
        },
        devDependencies: {
          vitest: "^1.0.0",
        },
        peerDependencies: {
          react: "^17.0.0",
        },
      };

      const headPackageJson = {
        name: "test-package",
        version: "1.0.0",
        dependencies: {
          lodash: "^4.17.21",
        },
        devDependencies: {
          vitest: "^2.0.0",
        },
        peerDependencies: {
          react: "^18.0.0",
        },
      };

      vi.mocked(mockGitClient.getChangedFiles).mockResolvedValue([
        { path: "package.json", status: "modified" },
      ]);

      vi.mocked(mockGitClient.getFileContent)
        .mockResolvedValueOnce(JSON.stringify(basePackageJson))
        .mockResolvedValueOnce(JSON.stringify(headPackageJson));

      const analyzer = new DependencyChangeAnalyzer(
        mockGitClient,
        "HEAD~1",
        "HEAD",
        defaultIncludeDeps
      );
      const result = await analyzer.detectChangedPackages(workspacePackages);

      expect(result).toHaveLength(1);
      const pkg = result[0];
      assert(pkg.private === false);
      // Only lodash (production dependency) should be included
      expect(pkg.dependencyChanges).toHaveLength(1);
      expect(pkg.dependencyChanges[0].name).toBe("lodash");
    });

    it("should include devDependencies when specified", async () => {
      const basePackageJson = {
        name: "test-package",
        version: "1.0.0",
        dependencies: {
          lodash: "^4.17.19",
        },
        devDependencies: {
          vitest: "^1.0.0",
        },
      };

      const headPackageJson = {
        name: "test-package",
        version: "1.0.0",
        dependencies: {
          lodash: "^4.17.21",
        },
        devDependencies: {
          vitest: "^2.0.0",
        },
      };

      vi.mocked(mockGitClient.getChangedFiles).mockResolvedValue([
        { path: "package.json", status: "modified" },
      ]);

      vi.mocked(mockGitClient.getFileContent)
        .mockResolvedValueOnce(JSON.stringify(basePackageJson))
        .mockResolvedValueOnce(JSON.stringify(headPackageJson));

      const analyzer = new DependencyChangeAnalyzer(
        mockGitClient,
        "HEAD~1",
        "HEAD",
        ["prod", "dev"]
      );
      const result = await analyzer.detectChangedPackages(workspacePackages);

      expect(result).toHaveLength(1);
      const pkg = result[0];
      assert(pkg.private === false);
      // Both lodash and vitest should be included
      expect(pkg.dependencyChanges).toHaveLength(2);
      expect(pkg.dependencyChanges.map((c) => c.name).sort()).toEqual([
        "lodash",
        "vitest",
      ]);
    });

    it("should include multiple dependency types when specified", async () => {
      const basePackageJson = {
        name: "test-package",
        version: "1.0.0",
        dependencies: {
          lodash: "^4.17.19",
        },
        devDependencies: {
          vitest: "^1.0.0",
        },
        peerDependencies: {
          react: "^17.0.0",
        },
      };

      const headPackageJson = {
        name: "test-package",
        version: "1.0.0",
        dependencies: {
          lodash: "^4.17.21",
        },
        devDependencies: {
          vitest: "^2.0.0",
        },
        peerDependencies: {
          react: "^18.0.0",
        },
      };

      vi.mocked(mockGitClient.getChangedFiles).mockResolvedValue([
        { path: "package.json", status: "modified" },
      ]);

      vi.mocked(mockGitClient.getFileContent)
        .mockResolvedValueOnce(JSON.stringify(basePackageJson))
        .mockResolvedValueOnce(JSON.stringify(headPackageJson));

      const analyzer = new DependencyChangeAnalyzer(
        mockGitClient,
        "HEAD~1",
        "HEAD",
        ["prod", "dev", "peer"]
      );
      const result = await analyzer.detectChangedPackages(workspacePackages);

      expect(result).toHaveLength(1);
      const pkg = result[0];
      assert(pkg.private === false);
      // All three dependencies should be included
      expect(pkg.dependencyChanges).toHaveLength(3);
      expect(pkg.dependencyChanges.map((c) => c.name).sort()).toEqual([
        "lodash",
        "react",
        "vitest",
      ]);
    });

    it("should return empty when only devDeps changed but not included", async () => {
      const basePackageJson = {
        name: "test-package",
        version: "1.0.0",
        dependencies: {
          lodash: "^4.17.21",
        },
        devDependencies: {
          vitest: "^1.0.0",
        },
      };

      const headPackageJson = {
        name: "test-package",
        version: "1.0.0",
        dependencies: {
          lodash: "^4.17.21",
        },
        devDependencies: {
          vitest: "^2.0.0",
        },
      };

      vi.mocked(mockGitClient.getChangedFiles).mockResolvedValue([
        { path: "package.json", status: "modified" },
      ]);

      vi.mocked(mockGitClient.getFileContent)
        .mockResolvedValueOnce(JSON.stringify(basePackageJson))
        .mockResolvedValueOnce(JSON.stringify(headPackageJson));

      const analyzer = new DependencyChangeAnalyzer(
        mockGitClient,
        "HEAD~1",
        "HEAD",
        defaultIncludeDeps
      );
      // Only prod deps included (default behavior)
      const result = await analyzer.detectChangedPackages(workspacePackages);

      // No production dependencies changed, so no packages should be detected
      expect(result).toHaveLength(0);
    });
  });
});
