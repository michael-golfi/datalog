import { stat, readFile } from 'node:fs/promises';

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

export async function assertExists(filePath, message) {
  try {
    await stat(filePath);
  } catch {
    throw new Error(message);
  }
}
