/**
 * Generates Lucide SVG assets, computes per-file IPFS CIDs, and writes
 * src/lib/constants/agent-icon-ipfs.generated.ts
 *
 * Optional: set PINATA_JWT to pin each SVG after generation.
 *
 * Run: pnpm --filter web run agent-icons:ipfs
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import Hash from "ipfs-only-hash";

import {
  AGENT_ICON_PRESET_KEYS,
  type AgentIconPresetKey,
} from "../src/lib/constants/agent-icons";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, "..");
const ASSETS_DIR = path.join(WEB_ROOT, "assets", "agent-icon-ipfs");
const GENERATED_FILE = path.join(
  WEB_ROOT,
  "src/lib/constants/agent-icon-ipfs.generated.ts",
);
const LUCIDE_ICONS_DIR = path.resolve(
  WEB_ROOT,
  "node_modules/lucide-react/dist/esm/icons",
);

const LUCIDE_SLUG_OVERRIDES: Partial<Record<AgentIconPresetKey, string>> = {
  barChart: "chart-column",
  code: "code-2",
  gamepad: "gamepad-2",
};

function presetKeyToLucideSlug(key: AgentIconPresetKey): string {
  return (
    LUCIDE_SLUG_OVERRIDES[key] ?? key.replace(/([A-Z])/g, "-$1").toLowerCase()
  );
}

type LucideIconNode = Array<[string, Record<string, string>]>;

function iconNodeToSvgMarkup(iconNode: LucideIconNode): string {
  const body = iconNode
    .map(([tag, attrs]) => {
      const attrString = Object.entries(attrs)
        .map(([name, value]) => `${name}="${value}"`)
        .join(" ");
      return `<${tag} ${attrString} />`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img">
${body}
</svg>
`;
}

async function loadLucideIconNode(
  slug: string,
  visited = new Set<string>(),
): Promise<LucideIconNode> {
  if (visited.has(slug)) {
    throw new Error(`Circular lucide icon re-export detected for: ${slug}`);
  }
  visited.add(slug);

  const iconPath = path.join(LUCIDE_ICONS_DIR, `${slug}.js`);
  const source = readFileSync(iconPath, "utf8");
  const reexportMatch = source.match(
    /export\s+\{\s*default\s*\}\s+from\s+['"]\.\/(.+)\.js['"]/,
  );
  if (reexportMatch?.[1]) {
    return loadLucideIconNode(reexportMatch[1], visited);
  }

  const mod = (await import(pathToFileURL(iconPath).href)) as {
    __iconNode?: LucideIconNode;
  };
  if (!mod.__iconNode) {
    throw new Error(`Missing __iconNode export for lucide icon: ${slug}`);
  }
  return mod.__iconNode;
}

async function generateSvgAssets(): Promise<
  Record<AgentIconPresetKey, { filePath: string; ipfsUrl: string }>
> {
  mkdirSync(ASSETS_DIR, { recursive: true });
  const assets = {} as Record<
    AgentIconPresetKey,
    { filePath: string; ipfsUrl: string }
  >;

  for (const preset of AGENT_ICON_PRESET_KEYS) {
    const slug = presetKeyToLucideSlug(preset);
    const iconNode = await loadLucideIconNode(slug);
    const svg = iconNodeToSvgMarkup(iconNode);
    const filename = `${preset}.svg`;
    const filePath = path.join(ASSETS_DIR, filename);
    writeFileSync(filePath, svg, "utf8");

    const cid = await Hash.of(svg, { cidVersion: 1 });
    assets[preset] = {
      filePath,
      ipfsUrl: `ipfs://${cid.toString()}`,
    };
  }

  return assets;
}

async function pinAssetsToPinata(
  assets: Record<AgentIconPresetKey, { filePath: string; ipfsUrl: string }>,
): Promise<void> {
  const jwt = process.env.PINATA_JWT?.trim();
  if (!jwt) {
    console.info(
      "PINATA_JWT not set — skipped remote pin. Pin assets/agent-icon-ipfs before deploy.",
    );
    return;
  }

  for (const preset of AGENT_ICON_PRESET_KEYS) {
    const { filePath } = assets[preset];
    const buffer = readFileSync(filePath);
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([buffer], { type: "image/svg+xml" }),
      `${preset}.svg`,
    );
    formData.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));
    formData.append(
      "pinataMetadata",
      JSON.stringify({ name: `masumi-saas-agent-icon-${preset}` }),
    );

    const response = await fetch(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
        body: formData,
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Pinata pin failed for ${preset} (${response.status}): ${body}`,
      );
    }
  }

  console.info(`Pinned ${AGENT_ICON_PRESET_KEYS.length} agent icons to IPFS.`);
}

function writeGeneratedModule(
  assets: Record<AgentIconPresetKey, { filePath: string; ipfsUrl: string }>,
): void {
  const urlEntries = AGENT_ICON_PRESET_KEYS.map(
    (preset) =>
      `  ${JSON.stringify(preset)}: ${JSON.stringify(assets[preset].ipfsUrl)},`,
  ).join("\n");

  const content = `// AUTO-GENERATED by scripts/generate-agent-icon-ipfs.ts — do not edit.
import type { AgentIconPresetKey } from "./agent-icons";

export const AGENT_ICON_IPFS_URLS = {
${urlEntries}
} as const satisfies Record<AgentIconPresetKey, string>;

export function resolvePresetAgentIconIpfsUrl(
  preset: AgentIconPresetKey,
): string {
  return AGENT_ICON_IPFS_URLS[preset];
}
`;

  writeFileSync(GENERATED_FILE, content, "utf8");
}

async function main(): Promise<void> {
  const assets = await generateSvgAssets();
  writeGeneratedModule(assets);
  await pinAssetsToPinata(assets);

  console.info(`Generated ${AGENT_ICON_PRESET_KEYS.length} SVGs.`);
  console.info(`Wrote ${path.relative(WEB_ROOT, GENERATED_FILE)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
