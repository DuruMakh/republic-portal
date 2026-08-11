import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const access = JSON.parse(
  readFileSync(new URL("./production-security-view-access.json", import.meta.url), "utf8"),
);
const expectedViews = [...access.public_read, ...access.signed_in_read].sort();

export function verifyProductionSecurityAdvisors(payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.results)) {
    throw new Error("Advisor payload must contain a results array.");
  }

  const names = [];
  for (const result of payload.results) {
    if (
      result?.name !== "security_definer_view" ||
      result?.level !== "ERROR" ||
      result?.facing !== "EXTERNAL" ||
      result?.metadata?.schema !== "public" ||
      result?.metadata?.type !== "view" ||
      typeof result?.metadata?.name !== "string"
    ) {
      throw new Error("Unexpected advisor result contract.");
    }
    names.push(result.metadata.name);
  }

  const sorted = [...names].sort();
  if (new Set(sorted).size !== sorted.length) throw new Error("Duplicate advisor view.");
  const missing = expectedViews.filter((name) => !sorted.includes(name));
  const extra = sorted.filter((name) => !expectedViews.includes(name));
  if (missing.length || extra.length) {
    throw new Error(
      `Advisor view set mismatch; missing=${missing.join(",")}; extra=${extra.join(",")}`,
    );
  }
  return { acceptedViews: sorted };
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const path = process.argv[2];
    if (!path) throw new Error("Expected one advisor JSON file path.");
    const payload = JSON.parse(readFileSync(resolve(path), "utf8"));
    const result = verifyProductionSecurityAdvisors(payload);
    process.stdout.write(`Accepted ${result.acceptedViews.length} reviewed advisor findings.\n`);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Advisor verification failed."}\n`,
    );
    process.exitCode = 1;
  }
}
