/**
 * Interface for logging operations
 */
export interface ILogger {
  info(message: string): void;
  warn(message: string): void;
}

/**
 * Silent logger implementation (no-op)
 */
export const silentLogger: ILogger = {
  info: () => {},
  warn: () => {},
};

/**
 * Console logger implementation
 */
export const consoleLogger: ILogger = {
  info: (message: string) => console.log(message),
  warn: (message: string) => console.warn(message),
};

/**
 * Interface for Git operations (local repository)
 */
export interface IGitClient {
  /**
   * Get list of files changed between two commits
   */
  getChangedFiles(
    fromRef: string,
    toRef: string
  ): Promise<Array<{ path: string; status: string }>>;

  /**
   * Get content of a file at a specific commit
   */
  getFileContent(path: string, ref: string): Promise<string>;

  /**
   * Get list of commits in a range
   */
  getCommits(
    fromRef: string,
    toRef: string
  ): Promise<Array<{ message: string }>>;
}
