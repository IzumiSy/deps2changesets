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
}
