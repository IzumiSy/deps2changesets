import { afterEach, beforeEach, describe, expect, it } from "vitest";
import writeChangeset from "@changesets/write";
import { mkdtemp, mkdir, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createChangesets } from "./changeset";
import { commandArgs } from "./types";

const defaultReleaseType = commandArgs.releaseType.default;
let cwd: string;

beforeEach(async () => {
  cwd = await mkdtemp(path.join(os.tmpdir(), "deps2changesets-"));
  await mkdir(path.join(cwd, ".changeset"));
});

afterEach(async () => {
  await rm(cwd, { force: true, recursive: true });
});

describe("createChangesets", () => {
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

  it("creates a changeset for a changed package", async () => {
    const result = await createChangesets(changedPackages, defaultReleaseType, cwd);

    expect(result).toHaveLength(1);
    expect(result[0].id).toMatch(/^deps2changesets-[a-f0-9]{8}$/);
    const files = await readdir(path.join(cwd, ".changeset"));
    expect(files).toEqual([`${result[0].id}.md`]);
    await expect(readFile(path.join(cwd, ".changeset", files[0]), "utf8")).resolves.toContain(
      "Updated [lodash](https://www.npmjs.com/package/lodash) (^4.17.19 -> ^4.17.21)",
    );
  });

  it("matches @changesets/write output", async () => {
    const [actual] = await createChangesets(changedPackages, defaultReleaseType, cwd);
    const expected = await writeChangeset(
      {
        summary: "Updated [lodash](https://www.npmjs.com/package/lodash) (^4.17.19 -> ^4.17.21)",
        releases: [{ name: "test-package", type: defaultReleaseType }],
      },
      cwd,
    );

    await expect(readFile(path.join(cwd, ".changeset", `${actual.id}.md`), "utf8")).resolves.toBe(
      await readFile(path.join(cwd, ".changeset", `${expected}.md`), "utf8"),
    );
  });

  it("does not create a duplicate changeset for the same dependency change", async () => {
    const first = await createChangesets(changedPackages, defaultReleaseType, cwd);
    const second = await createChangesets(changedPackages, defaultReleaseType, cwd);

    expect(second).toEqual(first);
    await expect(readdir(path.join(cwd, ".changeset"))).resolves.toHaveLength(1);
  });

  it("returns an empty array when no packages need changesets", async () => {
    await expect(createChangesets([], defaultReleaseType, cwd)).resolves.toEqual([]);
  });

  it("creates one changeset per changed package", async () => {
    const result = await createChangesets(
      [
        ...changedPackages,
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
      ],
      defaultReleaseType,
      cwd,
    );

    expect(result).toHaveLength(2);
    await expect(readdir(path.join(cwd, ".changeset"))).resolves.toHaveLength(2);
  });
});
