export interface ImmutableDatalogMigration {
  readonly id: string;
  readonly description: string;
  readonly fixturePath: string;
  readonly fingerprint: string;
}

export interface AppliedImmutableDatalogMigration {
  readonly id: string;
  readonly fingerprint: string;
}
