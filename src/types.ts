import { Package } from "@manypkg/get-packages";

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
 * Types of dependency changes that can occur
 */
export type DependencyChangeType = "added" | "updated" | "removed";

/**
 * Represents a single dependency change in a package.json
 */
export interface DependencyChange {
  /** Name of the dependency */
  name: string;
  /** Type of change */
  type: DependencyChangeType;
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
