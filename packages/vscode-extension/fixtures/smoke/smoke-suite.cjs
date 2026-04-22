const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const vscode = require('vscode');

const pollIntervalMs = 250;
const timeoutMs = 20_000;

module.exports.run = async function run() {
  const extensionId = requireEnvironmentVariable('DATALOG_SMOKE_EXTENSION_ID');
  const smokeFilePath = requireEnvironmentVariable('DATALOG_SMOKE_FILE_PATH');
  const expectFailure = process.env.DATALOG_SMOKE_EXPECT_FAILURE === '1';
  const extension = vscode.extensions.getExtension(extensionId);

  assert(extension, `Smoke extension was not found: ${extensionId}`);

  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(smokeFilePath));
  await vscode.window.showTextDocument(document);

  assert.equal(document.languageId, 'datalog', 'Smoke fixture did not resolve to the datalog language.');

  try {
    await extension.activate();
  } catch (error) {
    if (expectFailure) {
      const message = `DATALOG_SMOKE_BROKEN_EXPECTED_FAILURE: ${getErrorMessage(error)}`;

      await recordBrokenFailureMarker(message);
      throw new Error(message);
    }

    throw error;
  }

  if (expectFailure) {
    throw new Error('DATALOG_SMOKE_BROKEN_EXPECTED_FAILURE: extension activation unexpectedly succeeded.');
  }

  const symbols = await waitForDocumentSymbols(document.uri);
  const symbolNames = symbols.map((symbol) => symbol.name);

  assert(symbolNames.includes('DefPred'), 'Smoke document symbols did not include DefPred.');
  assert(symbolNames.includes('Serving@'), 'Smoke document symbols did not include Serving@.');
};

function requireEnvironmentVariable(name) {
  const value = process.env[name];

  assert(value, `Missing smoke environment variable: ${name}`);

  return value;
}

async function waitForDocumentSymbols(documentUri) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', documentUri);

    if (Array.isArray(result) && result.length > 0) {
      return result;
    }

    await delay(pollIntervalMs);
  }

  throw new Error('Timed out waiting for Datalog document symbols from the language server.');
}

function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function recordBrokenFailureMarker(message) {
  const markerPath = process.env.DATALOG_SMOKE_BROKEN_MARKER_PATH;

  if (!markerPath) {
    return;
  }

  await fs.writeFile(markerPath, `${message}\n`, 'utf8');
}
