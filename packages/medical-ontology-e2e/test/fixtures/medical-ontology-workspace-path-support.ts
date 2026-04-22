import path from 'node:path';
import { fileURLToPath } from 'node:url';

const medicalOntologyWorkspaceRoot = path.dirname(fileURLToPath(new URL('../../package.json', import.meta.url)));

export function resolveMedicalOntologyWorkspacePath(...segments: string[]): string {
  return path.join(medicalOntologyWorkspaceRoot, ...segments);
}
