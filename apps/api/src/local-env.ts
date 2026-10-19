import fs from "node:fs";
import { fileURLToPath } from "node:url";
// Local entry points only. Production server never loads development credentials.
const envPath = fileURLToPath(new URL("../../../.env.local", import.meta.url));
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
