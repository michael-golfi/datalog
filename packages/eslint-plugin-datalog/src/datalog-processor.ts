import type { Linter } from 'eslint';

import {
  createDatalogVirtualFilename,
  createVirtualDatalogSource,
  remapDatalogMessages,
} from './datalog-source.js';

export const datalogProcessor = {
  meta: {
    name: 'datalog-processor',
    version: '0.0.1',
  },
  preprocess(source: string, filename: string): Array<{ text: string; filename: string }> {
    return [
      {
        text: createVirtualDatalogSource(source),
        filename: createDatalogVirtualFilename(filename),
      },
    ];
  },
  postprocess(messageLists: Linter.LintMessage[][]): Linter.LintMessage[] {
    return remapDatalogMessages(messageLists);
  },
  supportsAutofix: false,
};
