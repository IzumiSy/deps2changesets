import { Package } from "@manypkg/get-packages";

/**
 * CLI argument definitions
 */
export const commandArgs = {
  range: {
    type: "string",
    short: "r",
    description:
      "Git commit range (e.g., 'main..HEAD', 'a1b2c3..d4e5f6'). Defaults to 'main..HEAD' for dependabot branches.",
    default: "main..HEAD",
  },
  releaseType: {
    type: "enum",
    short: "t",
    description: "Release type for changesets",
    choices: ["patch", "minor", "major"],
    default: "patch",
  },
  cwd: {
    type: "string",
    short: "c",
    description: "Working directory",
    default: process.cwd(),
  },
  dryRun: {
    type: "boolean",
    short: "d",
    description: "Preview changes without creating changesets",
    default: false,
  },
  includeDeps: {
    type: "enum",
    short: "i",
    description: "Dependency types to include in changesets.",
    choices: ["prod", "dev", "peer", "optional"],
    multiple: true,
    default: "prod",
  },
} as const;

/**
 * Dependency types that can be included (derived from commandArgs)
 */
export type DepType = (typeof commandArgs.includeDeps.choices)[number];

/**
 * Represents the structure of a package.json file
 */
export interface PackageJson {
  name: string;
  version: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

/**
 * Represents a single dependency change in a package.json
 */
export interface DependencyChange {
  /** Name of the dependency */
  name: string;
  /** Type of change */
  type: "added" | "updated" | "removed";
  /** Old version (for updated/removed) */
  oldVersion?: string;
  /** New version (for updated/added) */
  newVersion?: string;
}

/**
 * Public package that needs a changeset
 */
export interface PublicChangedPackage {
  private: false;
  /** Package information from @manypkg/get-packages */
  package: Package;
  /** List of dependency changes detected */
  dependencyChanges: DependencyChange[];
}

/**
 * Private package that doesn't need a changeset
 */
export interface PrivateChangedPackage {
  private: true;
  /** Package information from @manypkg/get-packages */
  package: Package;
}

/**
 * Discriminated union for changed packages
 */
export type ChangedPackage = PublicChangedPackage | PrivateChangedPackage;
