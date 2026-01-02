import { Package } from '@manypkg/get-packages';

/**
 * Represents the structure of a package.json file
 */
export interface PackageJson {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

/**
 * Types of dependency changes that can occur
 */
export type DependencyChangeType = 'added' | 'updated' | 'removed';

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
 * Represents a package that has changes in its package.json
 */
export interface ChangedPackage {
  /** Package information from @manypkg/get-packages */
  package: Package;
  /** List of dependency changes detected */
  dependencyChanges: DependencyChange[];
}
