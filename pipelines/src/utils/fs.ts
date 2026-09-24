import fs from 'node:fs/promises';
import path from 'node:path';

/** Ensures that the directory of the given file path exists. */
export async function ensureDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

/** Checks if a file exists on disk. */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Reads and parses a JSON file safely. */
export async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

/** Writes data formatted as compact JSON (or pretty JSON if indent > 0) with trailing newline. */
export async function writeJson(filePath: string, data: unknown, indent = 0): Promise<void> {
  await ensureDir(filePath);
  const jsonStr = indent > 0 ? JSON.stringify(data, null, indent) : JSON.stringify(data);
  await fs.writeFile(filePath, `${jsonStr}\n`, 'utf-8');
}
