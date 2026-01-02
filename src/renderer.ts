import type { PublicChangedPackage, DependencyChange } from "./types";

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

/**
 * Format a single dependency change line
 */
function formatDependencyChange(change: DependencyChange): string {
  const nameWidth = 20;
  const paddedName = change.name.padEnd(nameWidth);

  switch (change.type) {
    case "updated":
      return `  ${colors.cyan}↑${colors.reset} ${paddedName} ${colors.dim}${change.oldVersion}${colors.reset} → ${change.newVersion}`;
    case "added":
      return `  ${colors.green}+${colors.reset} ${paddedName} ${change.newVersion}`;
    case "removed":
      return `  ${colors.red}-${colors.reset} ${paddedName} ${colors.dim}${change.oldVersion}${colors.reset}`;
  }
}

/**
 * Render all changed packages with their dependency changes
 */
export function renderChangedPackages(
  changedPackages: PublicChangedPackage[]
): void {
  if (changedPackages.length === 0) {
    return;
  }

  for (const pkg of changedPackages) {
    console.log(`\n${pkg.package.packageJson.name}`);
    for (const change of pkg.dependencyChanges) {
      console.log(formatDependencyChange(change));
    }
  }
  console.log();
}

/**
 * Render the final result message
 */
export function renderResult(count: number, dryRun: boolean): void {
  if (count === 0) {
    console.log("No dependency changes detected.");
    return;
  }

  if (dryRun) {
    console.log(`ℹ Would create ${count} changeset(s) (dry-run)`);
  } else {
    console.log(
      `${colors.green}✓${colors.reset} Created ${count} changeset(s)`
    );
  }
}
