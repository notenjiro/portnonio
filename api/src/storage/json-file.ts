import fs from "fs/promises";
import path from "path";

async function ensureParentDir(filePath: string): Promise<void> {
  const dirPath = path.dirname(filePath);
  await fs.mkdir(dirPath, { recursive: true });
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  const exists = await fileExists(filePath);

  if (!exists) {
    return fallback;
  }

  const raw = await fs.readFile(filePath, "utf8");

  if (!raw.trim()) {
    return fallback;
  }

  return JSON.parse(raw) as T;
}

export async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  await ensureParentDir(filePath);

  const tempPath = `${filePath}.tmp`;
  const content = `${JSON.stringify(data, null, 2)}\n`;

  await fs.writeFile(tempPath, content, "utf8");
  await fs.rename(tempPath, filePath);
}