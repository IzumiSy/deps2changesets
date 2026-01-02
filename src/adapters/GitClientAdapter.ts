import { simpleGit, SimpleGit } from 'simple-git';
import type { IGitClient } from '../interfaces';

/**
 * Adapter for local Git operations using simple-git
 */
export class GitClientAdapter implements IGitClient {
  private git: SimpleGit;

  constructor(cwd: string) {
    this.git = simpleGit(cwd);
  }

  async getChangedFiles(
    fromRef: string,
    toRef: string
  ): Promise<Array<{ path: string; status: string }>> {
    const diff = await this.git.diffSummary([fromRef, toRef]);
    return diff.files.map(file => ({
      path: file.file,
      status: this.mapGitStatusToStatus(
        'insertions' in file ? file : { insertions: 0, deletions: 0 }
      ),
    }));
  }

  async getFileContent(path: string, ref: string): Promise<string> {
    try {
      return await this.git.show([`${ref}:${path}`]);
    } catch (error) {
      throw new Error(`Failed to get content of ${path} at ${ref}: ${error}`);
    }
  }

  async getCommits(fromRef: string, toRef: string): Promise<Array<{ message: string }>> {
    const log = await this.git.log({ from: fromRef, to: toRef });
    return log.all.map(commit => ({ message: commit.message }));
  }

  private mapGitStatusToStatus(file: { insertions?: number; deletions?: number }): string {
    const insertions = file.insertions ?? 0;
    const deletions = file.deletions ?? 0;

    if (insertions > 0 && deletions === 0) {
      return 'added';
    } else if (insertions === 0 && deletions > 0) {
      return 'removed';
    } else {
      return 'modified';
    }
  }
}
