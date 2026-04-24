import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { DATALOG_SAMPLE } from './datalog-sample.js';
import { computeCompletions } from './completions.js';
import { DatalogDocumentStore } from '../workspace/datalog-document-store.js';
import { DatalogWorkspaceIndex } from '../workspace/datalog-workspace-index.js';

describe('computeCompletions', () => {
  it('suggests graph predicates inside Edge predicate position', () => {
    const source = `${DATALOG_SAMPLE}\nEdge("concept/chickpea_bowl", "food/`;
    const items = computeCompletions(source, {
      line: source.split('\n').length - 1,
      character: 'Edge("concept/chickpea_bowl", "food/'.length,
    });

    expect(items.map((item) => item.label)).toContain('food/has_cuisine');
    expect(items.map((item) => item.label)).toContain('food/preferred_label');
  });

  it('suggests rule predicates at clause start', () => {
    const source = `${DATALOG_SAMPLE}\nCla`;
    const items = computeCompletions(source, { line: source.split('\n').length - 1, character: 3 });

    expect(items.map((item) => item.label)).toContain('ClassAncestor');
    expect(items.map((item) => item.label)).not.toContain('DefPred');
  });

  it('suggests compound fields inside @ records', () => {
    const source = `${DATALOG_SAMPLE}\nServing@(serv/`;
    const items = computeCompletions(source, {
      line: source.split('\n').length - 1,
      character: 'Serving@(serv/'.length,
    });

    expect(items.map((item) => item.label)).toContain('serv/id=');
    expect(items.map((item) => item.label)).toContain('serv/subject=');
  });

  it('uses workspace predicates, builtins, and local precedence at clause predicate positions with stable ordering', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'datalog-completions-'));

    try {
      await writeFile(join(workspaceRoot, 'workspace.dl'), [
        'WorkspaceOnly(child, parent).',
        'ClassAncestor(left, right).',
      ].join('\n'), 'utf8');

      const workspaceIndex = new DatalogWorkspaceIndex({
        documentStore: new DatalogDocumentStore(),
      });
      await workspaceIndex.setWorkspaceRootPath(workspaceRoot);

      const source = [
        'LocalOnly(child, parent).',
        'ClassAncestor(local_child, local_parent).',
        'same_clause(X, Y) :- Cla',
      ].join('\n');
      const items = computeCompletions(source, {
        line: 2,
        character: 'same_clause(X, Y) :- Cla'.length,
      }, {
        workspaceIndex,
      });

      expect(items.map((item) => item.label)).toEqual(['ClassAncestor']);
      expect(items[0]).toMatchObject({
        detail: 'Local predicate',
        sortText: '0:predicate:user-predicate:ClassAncestor/2',
      });

      const allItems = computeCompletions(source, {
        line: 2,
        character: 'same_clause(X, Y) :- '.length,
      }, {
        workspaceIndex,
      });

      expect(allItems.map((item) => item.label)).toContain('WorkspaceOnly');
      expect(allItems.map((item) => item.label)).toContain('ClassAncestor');
      expect(allItems.map((item) => item.label)).toContain('Edge');
      expect(allItems.find((item) => item.label === 'ClassAncestor')).toMatchObject({
        detail: 'Local predicate',
      });
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('suppresses predicate suggestions in comments and ordinary strings', () => {
    const commentSource = `${DATALOG_SAMPLE}\n% Cla`;
    const commentItems = computeCompletions(commentSource, {
      line: commentSource.split('\n').length - 1,
      character: '% Cla'.length,
    });

    const stringSource = `${DATALOG_SAMPLE}\nNote("Cla`;
    const stringItems = computeCompletions(stringSource, {
      line: stringSource.split('\n').length - 1,
      character: 'Note("Cla'.length,
    });

    expect(commentItems).toEqual([]);
    expect(stringItems).toEqual([]);
  });

  it('suggests graph ids only for quoted graph-reference positions', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'datalog-completions-'));

    try {
      await writeFile(join(workspaceRoot, 'workspace.dl'), 'WorkspaceNodeFact(value).', 'utf8');
      const workspaceIndex = new DatalogWorkspaceIndex({
        documentStore: new DatalogDocumentStore(),
      });
      await workspaceIndex.setWorkspaceRootPath(workspaceRoot);
      workspaceIndex.upsertOpenDocument({
        uri: pathToFileURL(join(workspaceRoot, 'open.dl')).href,
        source: 'OpenWorkspace(node_value).',
      });

      const edgeSource = `${DATALOG_SAMPLE}\nEdge("concept/chickpea_bowl", "food/instance_of", "cla`;
      const edgeItems = computeCompletions(edgeSource, {
        line: edgeSource.split('\n').length - 1,
        character: 'Edge("concept/chickpea_bowl", "food/instance_of", "cla'.length,
      }, {
        workspaceIndex,
      });

      const defPredSource = `${DATALOG_SAMPLE}\nDefPred("food/new_predicate", "1", "cla`;
      const defPredItems = computeCompletions(defPredSource, {
        line: defPredSource.split('\n').length - 1,
        character: 'DefPred("food/new_predicate", "1", "cla'.length,
      }, {
        workspaceIndex,
      });

      expect(edgeItems.map((item) => item.label)).toContain('class/Thing');
      expect(edgeItems.map((item) => item.label)).toContain('class/FoodConcept');
      expect(edgeItems.every((item) => item.detail === 'Known graph node id')).toBe(true);
      expect(defPredItems).toEqual([]);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('suggests only clause-scoped local variables in variable term positions', () => {
    const source = [
      'shared_scope(X, Y) :-',
      '  Parent(X, Existing),',
      '  Edge(Existing, "food/instance_of", Ex',
    ].join('\n');

    const items = computeCompletions(source, {
      line: 2,
      character: '  Edge(Existing, "food/instance_of", Ex'.length,
    });

    expect(items.map((item) => item.label)).toEqual(['Existing']);
    expect(items[0]).toMatchObject({
      detail: 'Clause-scoped variable',
      sortText: '0:variable:Existing',
    });
  });
});
