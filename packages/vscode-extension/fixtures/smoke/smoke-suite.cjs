const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const path = require('node:path');
const vscode = require('vscode');

const pollIntervalMs = 250;
const timeoutMs = 20_000;

module.exports.run = async function run() {
  const extensionId = requireEnvironmentVariable('DATALOG_SMOKE_EXTENSION_ID');
  const smokeFilePath = requireEnvironmentVariable('DATALOG_SMOKE_CURRENT_FILE_PATH');
  const schemaFilePath = path.join(path.dirname(smokeFilePath), 'schema.dl');
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
  const symbolNames = collectDocumentSymbolNames(symbols);
  const sharedUsagePosition = positionWithinSnippet(document, 'Shared(left, right)', 2, 2);
  const hoverContents = await waitForHoverContents(document.uri, sharedUsagePosition);
  const definitions = await waitForDefinitions(document.uri, sharedUsagePosition);
  const crossFileUsagePosition = positionWithinSnippet(document, 'SchemaShared(left, right)', 2);
  const crossFileDefinitions = await waitForDefinitions(document.uri, crossFileUsagePosition);
  const completionLabels = await waitForCompletionLabels(document.uri, positionAfterSnippet(document, '  Sha'));
  const foldingRanges = await waitForFoldingRanges(document.uri);
  const semanticLegend = await waitForSemanticTokensLegend(document.uri);
  const semanticTokens = await waitForSemanticTokens(document.uri);
  const decodedSemanticTokens = decodeSemanticTokens(semanticTokens, semanticLegend);

  assert(symbolNames.includes('Parent/2'), 'Smoke document symbols did not include grouped Parent/2.');
  assert(symbolNames.includes('Shared'), 'Smoke document symbols did not include Shared.');
  assert(symbolNames.includes('UsesShared'), 'Smoke document symbols did not include UsesShared.');

  assert(hoverContents.includes('**Shared/2**'), `Smoke hover did not describe Shared/2. Received: ${hoverContents}`);
  assert(hoverContents.includes('Arity: `2`'), `Smoke hover did not include Shared arity details. Received: ${hoverContents}`);

  assert(definitions.some((definition) => isDefinitionAtLine(definition, smokeFilePath, 5)), 'Smoke definition did not resolve Shared to the local definition line.');
  assert(crossFileDefinitions.some((definition) => isDefinitionAtLine(definition, schemaFilePath, 1)), 'Smoke definition did not resolve SchemaShared to the sibling workspace file.');

  assert(completionLabels.includes('Shared'), 'Smoke completions did not include Shared for the incomplete clause.');

  assert(foldingRanges.some((range) => getFoldingRangeStartLine(range) === 0 && getFoldingRangeEndLine(range) === 1), `Smoke folding ranges did not include the leading comment block. Received: ${JSON.stringify(foldingRanges)}`);
  assert(foldingRanges.some((range) => getFoldingRangeStartLine(range) === 8 && getFoldingRangeEndLine(range) === 11), `Smoke folding ranges did not include the multiline UsesShared clause. Received: ${JSON.stringify(foldingRanges)}`);

  assert(semanticLegend.tokenTypes.includes('comment'), 'Smoke semantic token legend did not include comment.');
  assert(semanticLegend.tokenTypes.includes('function'), 'Smoke semantic token legend did not include function.');
  assert(semanticLegend.tokenTypes.includes('property'), 'Smoke semantic token legend did not include property.');
  assert(semanticLegend.tokenModifiers.includes('definition'), 'Smoke semantic token legend did not include the definition modifier.');
  assert(decodedSemanticTokens.some((token) => token.tokenType === 'comment' && token.line === 0), 'Smoke semantic tokens did not include the leading comment token.');
  assert(decodedSemanticTokens.some((token) => token.tokenType === 'function' && token.line === 5 && token.tokenModifiers.includes('definition')), 'Smoke semantic tokens did not include the Shared definition token.');
  assert(decodedSemanticTokens.some((token) => token.tokenType === 'property' && token.line === 10), 'Smoke semantic tokens did not include the graph predicate property token.');
};

function requireEnvironmentVariable(name) {
  const value = process.env[name];

  assert(value, `Missing smoke environment variable: ${name}`);

  return value;
}

async function waitForDocumentSymbols(documentUri) {
  return waitForProviderResult({
    description: 'Datalog document symbols',
    request: () => vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', documentUri),
    isReady: (result) => Array.isArray(result) && result.length > 0,
  });
}

async function waitForHoverContents(documentUri, position) {
  const hovers = await waitForProviderResult({
    description: 'Datalog hover results',
    request: () => vscode.commands.executeCommand('vscode.executeHoverProvider', documentUri, position),
    isReady: (result) => Array.isArray(result) && hoverCollectionToText(result).trim().length > 0,
  });

  return hoverCollectionToText(hovers);
}

async function waitForDefinitions(documentUri, position) {
  return waitForProviderResult({
    description: 'Datalog definitions',
    request: () => vscode.commands.executeCommand('vscode.executeDefinitionProvider', documentUri, position),
    isReady: (result) => Array.isArray(result) && result.length > 0,
  });
}

async function waitForCompletionLabels(documentUri, position) {
  const completionList = await waitForProviderResult({
    description: 'Datalog completions',
    request: () => vscode.commands.executeCommand('vscode.executeCompletionItemProvider', documentUri, position),
    isReady: (result) => normalizeCompletionItems(result).length > 0,
  });

  return normalizeCompletionItems(completionList).map((item) => item.label);
}

async function waitForFoldingRanges(documentUri) {
  return waitForProviderResult({
    description: 'Datalog folding ranges',
    request: () => vscode.commands.executeCommand('vscode.executeFoldingRangeProvider', documentUri),
    isReady: (result) => Array.isArray(result) && result.length > 0,
  });
}

async function waitForSemanticTokensLegend(documentUri) {
  return waitForProviderResult({
    description: 'Datalog semantic token legend',
    request: () => vscode.commands.executeCommand('vscode.provideDocumentSemanticTokensLegend', documentUri),
    isReady: (result) => result && Array.isArray(result.tokenTypes) && Array.isArray(result.tokenModifiers),
  });
}

async function waitForSemanticTokens(documentUri) {
  return waitForProviderResult({
    description: 'Datalog semantic tokens',
    request: () => vscode.commands.executeCommand('vscode.provideDocumentSemanticTokens', documentUri),
    isReady: (result) => result && Array.isArray(Array.from(result.data ?? [])) && Array.from(result.data ?? []).length > 0,
  });
}

async function waitForProviderResult({ description, request, isReady }) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = await request();

    if (isReady(result)) {
      return result;
    }

    await delay(pollIntervalMs);
  }

  throw new Error(`Timed out waiting for ${description} from the language server.`);
}

function collectDocumentSymbolNames(symbols) {
  return symbols.flatMap((symbol) => [symbol.name, ...collectDocumentSymbolNames(symbol.children ?? [])]);
}

function positionAfterSnippet(document, snippet, occurrenceIndex = 0) {
  const { range } = findSnippet(document, snippet, occurrenceIndex);

  return range.end;
}

function positionWithinSnippet(document, snippet, characterOffset, occurrenceIndex = 0) {
  const { range } = findSnippet(document, snippet, occurrenceIndex);

  return range.start.translate(0, characterOffset);
}

function findSnippet(document, snippet, occurrenceIndex) {
  let offset = 0;

  for (let seen = 0; seen <= occurrenceIndex; seen += 1) {
    offset = document.getText().indexOf(snippet, offset);

    if (offset < 0) {
      throw new Error(`Smoke fixture snippet was not found: ${snippet}`);
    }

    if (seen === occurrenceIndex) {
      return {
        range: new vscode.Range(document.positionAt(offset), document.positionAt(offset + snippet.length)),
      };
    }

    offset += snippet.length;
  }

  throw new Error(`Smoke fixture snippet was not found: ${snippet}`);
}

function hoverContentsToText(hover) {
  return hover.contents
    .map((content) => {
      if (typeof content === 'string') {
        return content;
      }

      if ('value' in content) {
        return content.value;
      }

      return String(content);
    })
    .join('\n');
}

function hoverCollectionToText(hovers) {
  return hovers.map((hover) => hoverContentsToText(hover)).join('\n');
}

function normalizeCompletionItems(result) {
  if (Array.isArray(result)) {
    return result;
  }

  if (result && Array.isArray(result.items)) {
    return result.items;
  }

  return [];
}

function isDefinitionAtLine(definition, expectedFilePath, expectedLine) {
  const targetUri = 'targetUri' in definition ? definition.targetUri : definition.uri;
  const targetRange = 'targetSelectionRange' in definition ? definition.targetSelectionRange : definition.range;

  return targetUri?.fsPath === expectedFilePath && targetRange?.start?.line === expectedLine;
}

function getFoldingRangeStartLine(range) {
  return range.startLine ?? range.start;
}

function getFoldingRangeEndLine(range) {
  return range.endLine ?? range.end;
}

function decodeSemanticTokens(tokens, legend) {
  const decodedTokens = [];
  const data = Array.from(tokens.data ?? []);
  let line = 0;
  let character = 0;

  for (let index = 0; index < data.length; index += 5) {
    const deltaLine = data[index];
    const deltaStart = data[index + 1];
    const length = data[index + 2];
    const tokenTypeIndex = data[index + 3];
    const modifierMask = data[index + 4];

    line += deltaLine;
    character = deltaLine === 0 ? character + deltaStart : deltaStart;

    decodedTokens.push({
      line,
      startChar: character,
      length,
      tokenType: legend.tokenTypes[tokenTypeIndex] ?? `unknown:${tokenTypeIndex}`,
      tokenModifiers: decodeSemanticTokenModifiers(modifierMask, legend.tokenModifiers),
    });
  }

  return decodedTokens;
}

function decodeSemanticTokenModifiers(modifierMask, modifierLegend) {
  return modifierLegend.filter((_, index) => (modifierMask & (1 << index)) !== 0);
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
