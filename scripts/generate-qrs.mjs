import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import QRCode from "qrcode";

try {
  process.loadEnvFile?.(".env.local");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const rawBaseUrl = process.env.NEXT_PUBLIC_APP_URL;

if (!rawBaseUrl) {
  throw new Error("Set NEXT_PUBLIC_APP_URL in .env.local before generating QR codes.");
}

const parsedBaseUrl = new URL(rawBaseUrl);
if (!['http:', 'https:'].includes(parsedBaseUrl.protocol)) {
  throw new Error("NEXT_PUBLIC_APP_URL must be an http or https URL.");
}
if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(parsedBaseUrl.hostname)) {
  throw new Error(
    "Use a deployed domain or your LAN IP address instead of localhost for QR codes.",
  );
}

const baseUrl = parsedBaseUrl.href.replace(/\/$/, "");
const outputDirectory = resolve("public", "qrs");
await mkdir(outputDirectory, { recursive: true });

const tables = [1, 2, 3];
const entries = [];

for (const table of tables) {
  const url = `${baseUrl}/menu/${table}?qr=1`;
  const filename = `table-${table}.png`;
  await QRCode.toFile(resolve(outputDirectory, filename), url, {
    errorCorrectionLevel: "H",
    margin: 3,
    width: 720,
    color: {
      dark: "#17110d",
      light: "#fffdf9",
    },
  });
  entries.push({ table, url, image: `/qrs/${filename}` });
}

await writeFile(
  resolve(outputDirectory, "manifest.json"),
  `${JSON.stringify({ baseUrl, entries }, null, 2)}\n`,
  "utf8",
);

console.log(`Generated QR codes for Tables 1, 2, and 3 using ${baseUrl}`);
