import { describe, expect, it, vi } from 'vitest';

import { createLanguageClientOptions } from './create-language-client-options.js';

describe('createLanguageClientOptions', () => {
  it('watches Datalog files and targets the datalog language', () => {
    const watcher = { kind: 'watcher' };
    const createFileSystemWatcher = vi.fn(() => watcher);

    const options = createLanguageClientOptions(createFileSystemWatcher);

    expect(createFileSystemWatcher).toHaveBeenCalledWith('**/*.dl');
    expect(options).toEqual({
      documentSelector: [{ scheme: 'file', language: 'datalog' }],
      synchronize: {
        fileEvents: watcher,
      },
    });
  });
});
