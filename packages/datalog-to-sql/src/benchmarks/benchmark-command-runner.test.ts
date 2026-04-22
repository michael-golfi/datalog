import { beforeEach, describe, expect, it, vi } from 'vitest';

const spawnSync = vi.fn();

vi.mock('node:child_process', () => ({
  spawnSync,
}));

describe('benchmark-command-runner', () => {
  beforeEach(() => {
    spawnSync.mockReset();
  });

  it('returns stdout for successful commands', async () => {
    spawnSync.mockReturnValue({ status: 0, stdout: 'ok', stderr: '' });
    const { runCommand } = await import('./benchmark-command-runner.js');

    expect(runCommand({ command: 'docker', args: ['ps'] })).toBe('ok');
  });

  it('returns stdout for failed commands when throwOnFailure is false', async () => {
    spawnSync.mockReturnValue({ status: 1, stdout: 'partial', stderr: 'boom' });
    const { runCommand } = await import('./benchmark-command-runner.js');

    expect(runCommand({ command: 'docker', args: ['ps'], throwOnFailure: false })).toBe('partial');
  });

  it('throws a descriptive error for failed commands by default', async () => {
    spawnSync.mockReturnValue({ status: 1, stdout: '', stderr: 'boom' });
    const { runCommand } = await import('./benchmark-command-runner.js');

    expect(() => runCommand({ command: 'docker', args: ['ps'] })).toThrow('docker ps failed: boom');
  });
});
