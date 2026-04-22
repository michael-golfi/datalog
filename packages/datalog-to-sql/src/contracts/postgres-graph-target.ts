export interface PostgresGraphTarget {
  readonly dialect: 'postgresql';
  readonly minimumVersion: 13;
  readonly vertexTable: 'vertices';
  readonly edgeTable: 'edges';
}

export const POSTGRES_GRAPH_TARGET: PostgresGraphTarget = {
  dialect: 'postgresql',
  minimumVersion: 13,
  vertexTable: 'vertices',
  edgeTable: 'edges',
};
