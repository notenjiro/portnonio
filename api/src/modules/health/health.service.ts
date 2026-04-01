import fs from "fs/promises";
import { env } from "../../config/env";
import { paths } from "../../config/paths";
import { fileExists } from "../../storage/json-file";

export async function getHealthStatus() {
  await fs.mkdir(paths.dataDir, { recursive: true });

  const storeExists = await fileExists(paths.storeFile);

  return {
    ok: true,
    service: "portnonio-api",
    env: env.NODE_ENV,
    port: env.PORT,
    dataDir: paths.dataDir,
    files: {
      store: {
        path: paths.storeFile,
        exists: storeExists,
      },
    },
  };
}