import { describe, it, expect, vi, beforeEach } from "vitest";
import { createChangesets } from "./changeset";
import { commandArgs } from "./types";

// Default releaseType value from CLI args
const defaultReleaseType = commandArgs.releaseType.default;

// Mock the dependencies
vi.mock("@changesets/write");
vi.mock("@changesets/read");
vi.mock("node:fs/promises", () => ({
  default: {
    rm: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("createChangesets", () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    const { default: writeChangeset } = await import("@changesets/write");
    vi.mocked(writeChangeset).mockResolvedValue("changeset-id");

    const { default: readChangesets } = await import("@changesets/read");
    vi.mocked(readChangesets).mockResolvedValue([]);
  });

  it("should create changeset for changed packages", async () => {
    const changedPackages = [
      {
        private: false as const,
        package: {
          dir: "/test",
          relativeDir: ".",
          packageJson: { name: "test-package", version: "1.0.0" },
        },
        dependencyChanges: [
          {
            name: "lodash",
            type: "updated" as const,
            oldVersion: "^4.17.19",
            newVersion: "^4.17.21",
          },
        ],
      },
    ];

    const result = await createChangesets(
      changedPackages,
      defaultReleaseType,
      "/test"
    );

    const { default: writeChangeset } = await import("@changesets/write");
    expect(writeChangeset).toHaveBeenCalledTimes(1);
    expect(writeChangeset).toHaveBeenCalledWith(
      expect.objectContaining({
        releases: [{ name: "test-package", type: defaultReleaseType }],
      }),
      "/test"
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("changeset-id");
    expect(result[0].recreated).toBe(false);
  });

  it("should return empty array when no packages to create changesets for", async () => {
    const result = await createChangesets([], defaultReleaseType, "/test");

    const { default: writeChangeset } = await import("@changesets/write");
    expect(writeChangeset).not.toHaveBeenCalled();
    expect(result).toHaveLength(0);
  });

  it("should handle multiple packages in monorepo", async () => {
    const changedPackages = [
      {
        private: false as const,
        package: {
          dir: "/test/packages/pkg-a",
          relativeDir: "packages/pkg-a",
          packageJson: { name: "pkg-a", version: "1.0.0" },
        },
        dependencyChanges: [
          {
            name: "lodash",
            type: "updated" as const,
            oldVersion: "^4.17.19",
            newVersion: "^4.17.21",
          },
        ],
      },
      {
        private: false as const,
        package: {
          dir: "/test/packages/pkg-b",
          relativeDir: "packages/pkg-b",
          packageJson: { name: "pkg-b", version: "1.0.0" },
        },
        dependencyChanges: [
          {
            name: "axios",
            type: "updated" as const,
            oldVersion: "^0.21.1",
            newVersion: "^1.4.0",
          },
        ],
      },
    ];

    await createChangesets(changedPackages, defaultReleaseType, "/test");

    const { default: writeChangeset } = await import("@changesets/write");
    expect(writeChangeset).toHaveBeenCalledTimes(2);
  });

  it("should remove existing auto-generated changesets before creating new ones", async () => {
    const { AUTO_GENERATED_BANNER } = await import("./changeset");
    const { default: readChangesets } = await import("@changesets/read");

    // Setup mock to return existing auto-generated changeset
    vi.mocked(readChangesets).mockResolvedValue([
      {
        id: "existing-changeset",
        summary: `${AUTO_GENERATED_BANNER}\n\nUpdated lodash (^4.17.19 -> ^4.17.20)`,
        releases: [{ name: "test-package", type: "patch" }],
      },
    ]);

    const changedPackages = [
      {
        private: false as const,
        package: {
          dir: "/test",
          relativeDir: ".",
          packageJson: { name: "test-package", version: "1.0.0" },
        },
        dependencyChanges: [
          {
            name: "lodash",
            type: "updated" as const,
            oldVersion: "^4.17.20",
            newVersion: "^4.17.21",
          },
        ],
      },
    ];

    const result = await createChangesets(
      changedPackages,
      defaultReleaseType,
      "/test"
    );

    // Should have created a new changeset with recreated flag
    expect(result).toHaveLength(1);
    expect(result[0].recreated).toBe(true);
  });

  it("should not remove changesets without auto-generated banner", async () => {
    const { default: readChangesets } = await import("@changesets/read");

    // Setup mock to return manually created changeset (no banner)
    vi.mocked(readChangesets).mockResolvedValue([
      {
        id: "manual-changeset",
        summary: "Manually created changeset for test-package",
        releases: [{ name: "test-package", type: "patch" }],
      },
    ]);

    const changedPackages = [
      {
        private: false as const,
        package: {
          dir: "/test",
          relativeDir: ".",
          packageJson: { name: "test-package", version: "1.0.0" },
        },
        dependencyChanges: [
          {
            name: "lodash",
            type: "updated" as const,
            oldVersion: "^4.17.20",
            newVersion: "^4.17.21",
          },
        ],
      },
    ];

    const result = await createChangesets(
      changedPackages,
      defaultReleaseType,
      "/test"
    );

    // Should have created a new changeset (not recreated since manual one wasn't removed)
    expect(result).toHaveLength(1);
    expect(result[0].recreated).toBe(false);
  });
});
