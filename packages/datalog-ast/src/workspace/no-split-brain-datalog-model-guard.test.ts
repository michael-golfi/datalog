import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

interface GuardedDeclaration {
  readonly line: number;
  readonly kind: 'interface' | 'type';
  readonly name: string;
  readonly simpleAliasTarget: string | null;
}

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const packagesRoot = path.join(repoRoot, 'packages');
const datalogAstSourceRoot = path.join(packagesRoot, 'datalog-ast', 'src');
const ignoredDirectoryNames = new Set(['coverage', 'dist', 'node_modules', 'out-tsc', 'test-output']);

function getRepoRelativePath(filePath: string) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function hasExportModifier(modifiers: ts.NodeArray<ts.ModifierLike> | undefined) {
  return modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function isGuardedModelName(name: string) {
  return name.startsWith('Datalog') || name === 'EdgeFact' || name === 'EdgeFactPattern' || name === 'VertexFact'
    || name === 'VertexFactPattern';
}

function isTestFile(filePath: string) {
  return filePath.endsWith('.test.ts') || filePath.endsWith('.spec.ts');
}

function readSourceFile(filePath: string) {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  return ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function getSimpleAliasTarget(typeNode: ts.TypeNode) {
  if (!ts.isTypeReferenceNode(typeNode)) {
    return null;
  }

  if (ts.isIdentifier(typeNode.typeName)) {
    return typeNode.typeName.text;
  }

  if (!ts.isQualifiedName(typeNode.typeName)) {
    return null;
  }

  return typeNode.typeName.right.text;
}

function walkTypeScriptFiles(rootDir: string) {
  const files: string[] = [];
  const pending = [rootDir];

  while (pending.length > 0) {
    const currentDir = pending.pop();
    if (!currentDir) {
      continue;
    }

    const entries = fs.readdirSync(currentDir, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirectoryNames.has(entry.name)) {
          pending.push(entryPath);
        }

        continue;
      }

      if (entry.isFile() && entryPath.endsWith('.ts') && !entryPath.endsWith('.d.ts')) {
        files.push(entryPath);
      }
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function collectCanonicalModelNames() {
  const canonicalNames = new Set<string>();

  for (const filePath of walkTypeScriptFiles(datalogAstSourceRoot)) {
    if (isTestFile(filePath)) {
      continue;
    }

    const sourceFile = readSourceFile(filePath);
    for (const statement of sourceFile.statements) {
      const isGuardedDeclaration = (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement))
        && hasExportModifier(statement.modifiers)
        && isGuardedModelName(statement.name.text);
      if (isGuardedDeclaration) {
        canonicalNames.add(statement.name.text);
      }
    }
  }

  return canonicalNames;
}

function collectGuardedDeclarations(filePath: string, guardedNames: ReadonlySet<string>) {
  const sourceFile = readSourceFile(filePath);
  const declarations: GuardedDeclaration[] = [];

  for (const statement of sourceFile.statements) {
    const isExportedTypeAlias = ts.isTypeAliasDeclaration(statement) && hasExportModifier(statement.modifiers);
    const isExportedInterface = ts.isInterfaceDeclaration(statement) && hasExportModifier(statement.modifiers);
    if (!isExportedTypeAlias && !isExportedInterface) {
      continue;
    }

    if (!guardedNames.has(statement.name.text)) {
      continue;
    }

    const start = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile));
    declarations.push({
      line: start.line + 1,
      kind: ts.isInterfaceDeclaration(statement) ? 'interface' : 'type',
      name: statement.name.text,
      simpleAliasTarget: ts.isTypeAliasDeclaration(statement) ? getSimpleAliasTarget(statement.type) : null,
    });
  }

  return {
    declarations,
  };
}

function collectSplitBrainDefinitionViolations() {
  const violations: string[] = [];
  const guardedNames = collectCanonicalModelNames();

  for (const filePath of walkTypeScriptFiles(packagesRoot)) {
    if (filePath.startsWith(datalogAstSourceRoot)) {
      continue;
    }

    const { declarations } = collectGuardedDeclarations(filePath, guardedNames);
    for (const declaration of declarations) {
      if (declaration.kind === 'interface' || declaration.simpleAliasTarget === null) {
        violations.push(`${getRepoRelativePath(filePath)}:${declaration.line} ${declaration.kind} ${declaration.name}`);
      }
    }
  }

  return violations;
}

describe('no-split-brain datalog model guard', () => {
  it('keeps concrete datalog model definitions inside @datalog/ast', () => {
    expect(collectSplitBrainDefinitionViolations()).toEqual([]);
  });
});
