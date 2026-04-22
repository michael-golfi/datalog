import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function verifyConsumerSurface(stageRoot) {
  const consumerRequire = createRequire(path.join(stageRoot, 'package.json'));
  const parserEntry = consumerRequire.resolve('@datalog/parser');
  const lspEntry = consumerRequire.resolve('@datalog/lsp');
  consumerRequire.resolve('@datalog/lsp/server');
  consumerRequire.resolve('@datalog/lsp/semantic-tokens');
  consumerRequire.resolve('vscode-languageclient/node');
  consumerRequire.resolve('vscode-languageserver');
  consumerRequire.resolve('vscode-languageserver-textdocument');

  const parserModule = await import(pathToFileURL(parserEntry).href);
  const lspModule = await import(pathToFileURL(lspEntry).href);

  if (typeof parserModule.parseDocument !== 'function') {
    throw new Error('Packaged parser surface is missing parseDocument().');
  }

  if (typeof lspModule.createLanguageServer !== 'function') {
    throw new Error('Packaged LSP surface is missing createLanguageServer().');
  }
}
