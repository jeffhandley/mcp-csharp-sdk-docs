// Finalize the combined multi-version docs site:
//   * copy the picker assets to <combinedDir>/assets/
//   * publish a cleaned docs-versions.json at the site root
//   * write a root index.html that redirects to the default version
//
// Usage:
//   node scripts/finalize-docs-site.mjs <combinedDir> [--versions <path>]

import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { manifestPath } from "./manifest-path.mjs";

function parseArgs(argv) {
  const positional = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) opts[a.slice(2)] = argv[++i];
    else positional.push(a);
  }
  return { positional, opts };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

async function main() {
  const { positional, opts } = parseArgs(process.argv.slice(2));
  const combinedDir = positional[0];
  if (!combinedDir) {
    console.error("usage: finalize-docs-site.mjs <combinedDir> [--versions <path>]");
    process.exit(2);
  }

  const pickerDir = new URL("../docs/version-picker/", import.meta.url);
  const versionsPath = opts.versions
    ? path.resolve(opts.versions)
    : manifestPath;
  const manifest = JSON.parse(await readFile(versionsPath, "utf8"));

  // 1. Copy picker assets.
  const assetsDir = path.join(combinedDir, "assets");
  await mkdir(assetsDir, { recursive: true });
  for (const name of ["version-picker.js", "version-picker.css"]) {
    await copyFile(new URL(name, pickerDir), path.join(assetsDir, name));
  }

  // 2. Public docs-versions.json (drop build-only fields like `ref` and `$comment`).
  const publicManifest = {
    default: manifest.default,
    versions: manifest.versions.map((v) => ({
      slug: v.slug,
      label: v.label,
      prerelease: !!v.prerelease,
    })),
  };
  await writeFile(
    path.join(combinedDir, "docs-versions.json"),
    JSON.stringify(publicManifest, null, 2) + "\n"
  );

  // 3. Root redirect to the default version (relative -> works under any base).
  const def = manifest.default;
  const target = `./${def}/`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>MCP C# SDK documentation</title>
<meta http-equiv="refresh" content="0; url=${escapeHtml(target)}">
<link rel="canonical" href="${escapeHtml(target)}">
<script>location.replace(${JSON.stringify(target)} + (location.hash || ""));</script>
</head>
<body>
<p>Redirecting to the <a href="${escapeHtml(target)}">MCP C# SDK documentation</a>&hellip;</p>
</body>
</html>
`;
  await writeFile(path.join(combinedDir, "index.html"), html);

  console.log(`[finalize] assets + docs-versions.json written; root redirects to ${target}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
