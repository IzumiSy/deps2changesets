import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChangesetService } from './ChangesetService';
import type { IGitClient } from './interfaces';

// Mock the dependencies
vi.mock('@changesets/write');
vi.mock('@manypkg/get-packages');

describe('ChangesetService', () => {
  let mockGitClient: IGitClient;
  let service: ChangesetService;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mocks
    const { default: writeChangeset } = await import('@changesets/write');
    const { getPackages } = await import('@manypkg/get-packages');

    vi.mocked(writeChangeset).mockResolvedValue('changeset-id');
    vi.mocked(getPackages).mockResolvedValue({
      packages: [],
      rootPackage: {
        dir: '/test',
        relativeDir: '.',
        packageJson: { name: 'test-package', version: '1.0.0' },
      },
      tool: 'pnpm' as const,
      rootDir: '/test',
    } as any);

    mockGitClient = {
      getChangedFiles: vi.fn(),
      getFileContent: vi.fn(),
      getCommits: vi.fn(),
    };

    service = new ChangesetService(mockGitClient);
  });

  describe('detectChangedPackages', () => {
    it('should detect single dependency update', async () => {
      const basePackageJson = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
          lodash: '^4.17.19',
        },
      };

      const headPackageJson = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
          lodash: '^4.17.21',
        },
      };

      vi.mocked(mockGitClient.getChangedFiles).mockResolvedValue([
        { path: 'package.json', status: 'modified' },
      ]);

      vi.mocked(mockGitClient.getFileContent)
        .mockResolvedValueOnce(JSON.stringify(basePackageJson))
        .mockResolvedValueOnce(JSON.stringify(headPackageJson));

      const result = await service.detectChangedPackages('HEAD~1', 'HEAD', '/test');

      expect(result).toHaveLength(1);
      expect(result[0].dependencyChanges).toHaveLength(1);
      expect(result[0].dependencyChanges[0].name).toBe('lodash');
      expect(result[0].dependencyChanges[0].type).toBe('updated');
      expect(result[0].dependencyChanges[0].oldVersion).toBe('^4.17.19');
      expect(result[0].dependencyChanges[0].newVersion).toBe('^4.17.21');
    });

    it('should return empty array when no package.json files changed', async () => {
      vi.mocked(mockGitClient.getChangedFiles).mockResolvedValue([
        { path: 'README.md', status: 'modified' },
      ]);

      const result = await service.detectChangedPackages('HEAD~1', 'HEAD', '/test');

      expect(result).toHaveLength(0);
    });

    it('should detect added dependency', async () => {
      const basePackageJson = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {},
      };

      const headPackageJson = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
          lodash: '^4.17.21',
        },
      };

      vi.mocked(mockGitClient.getChangedFiles).mockResolvedValue([
        { path: 'package.json', status: 'modified' },
      ]);

      vi.mocked(mockGitClient.getFileContent)
        .mockResolvedValueOnce(JSON.stringify(basePackageJson))
        .mockResolvedValueOnce(JSON.stringify(headPackageJson));

      const result = await service.detectChangedPackages('HEAD~1', 'HEAD', '/test');

      expect(result).toHaveLength(1);
      expect(result[0].dependencyChanges).toHaveLength(1);
      expect(result[0].dependencyChanges[0].type).toBe('added');
      expect(result[0].dependencyChanges[0].newVersion).toBe('^4.17.21');
    });

    it('should detect removed dependency', async () => {
      const basePackageJson = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
          lodash: '^4.17.21',
        },
      };

      const headPackageJson = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {},
      };

      vi.mocked(mockGitClient.getChangedFiles).mockResolvedValue([
        { path: 'package.json', status: 'modified' },
      ]);

      vi.mocked(mockGitClient.getFileContent)
        .mockResolvedValueOnce(JSON.stringify(basePackageJson))
        .mockResolvedValueOnce(JSON.stringify(headPackageJson));

      const result = await service.detectChangedPackages('HEAD~1', 'HEAD', '/test');

      expect(result).toHaveLength(1);
      expect(result[0].dependencyChanges).toHaveLength(1);
      expect(result[0].dependencyChanges[0].type).toBe('removed');
      expect(result[0].dependencyChanges[0].oldVersion).toBe('^4.17.21');
    });
  });

  describe('checkForExistingChangeset', () => {
    it('should return true when changeset commit exists', async () => {
      vi.mocked(mockGitClient.getCommits).mockResolvedValue([
        { message: '[add changeset] Update dependencies' },
      ]);

      const result = await service.checkForExistingChangeset('HEAD~1', 'HEAD', '[add changeset]');

      expect(result).toBe(true);
    });

    it('should return false when no changeset commit exists', async () => {
      vi.mocked(mockGitClient.getCommits).mockResolvedValue([
        { message: 'chore: update dependencies' },
      ]);

      const result = await service.checkForExistingChangeset('HEAD~1', 'HEAD', '[add changeset]');

      expect(result).toBe(false);
    });
  });

  describe('createChangesets', () => {
    it('should create changeset for changed packages', async () => {
      const changedPackages = [
        {
          package: {
            dir: '/test',
            relativeDir: '.',
            packageJson: { name: 'test-package', version: '1.0.0' },
          },
          dependencyChanges: [
            {
              name: 'lodash',
              type: 'updated' as const,
              oldVersion: '^4.17.19',
              newVersion: '^4.17.21',
            },
          ],
        },
      ];

      const result = await service.createChangesets(changedPackages, 'patch', '/test');

      const { default: writeChangeset } = await import('@changesets/write');
      expect(writeChangeset).toHaveBeenCalledTimes(1);
      expect(writeChangeset).toHaveBeenCalledWith(
        expect.objectContaining({
          releases: [{ name: 'test-package', type: 'patch' }],
        }),
        '/test'
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('changeset-id');
    });

    it('should return empty array when no packages to create changesets for', async () => {
      const result = await service.createChangesets([], 'patch', '/test');

      const { default: writeChangeset } = await import('@changesets/write');
      expect(writeChangeset).not.toHaveBeenCalled();
      expect(result).toHaveLength(0);
    });

    it('should handle multiple packages in monorepo', async () => {
      const { getPackages } = await import('@manypkg/get-packages');
      vi.mocked(getPackages).mockResolvedValue({
        packages: [
          {
            dir: '/test/packages/pkg-a',
            relativeDir: 'packages/pkg-a',
            packageJson: { name: 'pkg-a', version: '1.0.0' },
          },
          {
            dir: '/test/packages/pkg-b',
            relativeDir: 'packages/pkg-b',
            packageJson: { name: 'pkg-b', version: '1.0.0' },
          },
        ],
        rootPackage: undefined,
        tool: 'pnpm' as const,
        rootDir: '/test',
      } as any);

      const changedPackages = [
        {
          package: {
            dir: '/test/packages/pkg-a',
            relativeDir: 'packages/pkg-a',
            packageJson: { name: 'pkg-a', version: '1.0.0' },
          },
          dependencyChanges: [
            {
              name: 'lodash',
              type: 'updated' as const,
              oldVersion: '^4.17.19',
              newVersion: '^4.17.21',
            },
          ],
        },
        {
          package: {
            dir: '/test/packages/pkg-b',
            relativeDir: 'packages/pkg-b',
            packageJson: { name: 'pkg-b', version: '1.0.0' },
          },
          dependencyChanges: [
            {
              name: 'axios',
              type: 'updated' as const,
              oldVersion: '^0.21.1',
              newVersion: '^1.4.0',
            },
          ],
        },
      ];

      await service.createChangesets(changedPackages, 'patch', '/test');

      const { default: writeChangeset } = await import('@changesets/write');
      expect(writeChangeset).toHaveBeenCalledTimes(2);
    });
  });
});
