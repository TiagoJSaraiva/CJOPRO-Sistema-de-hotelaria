#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const JSON_OUTPUT = process.argv.includes("--json");

const REQUIRED_FILES = [
  "README.md",
  "CONTRIBUTING.md",
  "docs/README.md",
  "docs/architecture.md",
  "docs/commands.md",
  "docs/database-workflow.md",
  "docs/development-guide.md",
  "docs/testing-strategy.md",
  "docs/ui-quality.md",
  "AGENTS.md",
  ".github/AGENTS.md",
  "apps/backend-service/AGENTS.md",
  "apps/booking-engine-service/AGENTS.md",
  "apps/pms/AGENTS.md",
  "packages/shared/AGENTS.md",
  "scripts/AGENTS.md",
  "supabase/AGENTS.md",
];

const BUILTIN_PNPM_COMMANDS = new Set([
  "--filter",
  "add",
  "audit",
  "exec",
  "install",
  "outdated",
  "remove",
  "run",
]);

const checks = [];
const errors = [];

function toRepositoryPath(absolutePath) {
  return relative(ROOT_DIRECTORY, absolutePath).split(sep).join("/");
}

function lineAt(contents, index) {
  return contents.slice(0, index).split(/\r?\n/).length;
}

function addError(id, { file, line = 1, message, hint }) {
  errors.push({ id, file, line, message, hint });
}

function addCheck(id, label, details) {
  checks.push({
    id,
    label,
    ok: !errors.some((error) => error.id === id),
    details,
  });
}

function collectMarkdownFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(entryPath));
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") {
      files.push(entryPath);
    }
  }
  return files;
}

function slugifyHeading(heading) {
  return heading
    .replace(/<[^>]+>/g, "")
    .replace(/[`*_~]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s+/g, "-");
}

function collectAnchors(contents) {
  const anchors = new Set();
  const occurrences = new Map();

  for (const line of contents.split(/\r?\n/)) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) {
      continue;
    }

    const baseSlug = slugifyHeading(match[2]);
    const occurrence = occurrences.get(baseSlug) ?? 0;
    occurrences.set(baseSlug, occurrence + 1);
    anchors.add(occurrence === 0 ? baseSlug : `${baseSlug}-${occurrence}`);
  }

  return anchors;
}

function parseLinkDestination(rawDestination) {
  const trimmed = rawDestination.trim();
  if (trimmed.startsWith("<")) {
    const closing = trimmed.indexOf(">");
    return closing === -1 ? trimmed.slice(1) : trimmed.slice(1, closing);
  }
  return trimmed.split(/\s+/)[0];
}

function validateLinks(markdownFiles) {
  let linkCount = 0;
  const linkPattern = /(?:!\[[^\]]*\]|\[[^\]]*\])\(([^)\r\n]+)\)/g;

  for (const markdownPath of markdownFiles) {
    const contents = readFileSync(markdownPath, "utf8");
    for (const match of contents.matchAll(linkPattern)) {
      linkCount += 1;
      const destination = parseLinkDestination(match[1]);
      if (/^(?:https?:|mailto:)/i.test(destination)) {
        continue;
      }

      const [rawPath, rawFragment] = destination.split("#", 2);
      let decodedPath;
      let decodedFragment;
      try {
        decodedPath = decodeURIComponent(rawPath || "");
        decodedFragment = decodeURIComponent(rawFragment || "");
      } catch {
        addError("links", {
          file: toRepositoryPath(markdownPath),
          line: lineAt(contents, match.index),
          message: `link possui escape inválido: ${destination}`,
          hint: "Use um caminho relativo codificado como URL.",
        });
        continue;
      }

      if (/^(?:[a-zA-Z]:[\\/]|[\\/])/.test(decodedPath)) {
        addError("links", {
          file: toRepositoryPath(markdownPath),
          line: lineAt(contents, match.index),
          message: `link local absoluto não é portável: ${destination}`,
          hint: "Use um caminho relativo ao documento.",
        });
        continue;
      }

      const targetPath = decodedPath
        ? resolve(dirname(markdownPath), decodedPath)
        : markdownPath;
      if (!existsSync(targetPath)) {
        addError("links", {
          file: toRepositoryPath(markdownPath),
          line: lineAt(contents, match.index),
          message: `alvo local não existe: ${destination}`,
          hint: "Corrija o caminho ou adicione o arquivo referenciado.",
        });
        continue;
      }

      if (decodedFragment && extname(targetPath).toLowerCase() === ".md") {
        const anchors = collectAnchors(readFileSync(targetPath, "utf8"));
        if (!anchors.has(decodedFragment.toLocaleLowerCase("pt-BR"))) {
          addError("links", {
            file: toRepositoryPath(markdownPath),
            line: lineAt(contents, match.index),
            message: `fragmento não existe em ${toRepositoryPath(targetPath)}: #${decodedFragment}`,
            hint: "Use o slug de um heading existente no documento de destino.",
          });
        }
      }
    }
  }

  addCheck(
    "links",
    "Links e imagens locais",
    `${linkCount} referências verificadas`,
  );
}

function collectCodeSegments(contents) {
  const segments = [];
  for (const match of contents.matchAll(/```[^\r\n]*\r?\n([\s\S]*?)```/g)) {
    segments.push({ value: match[1], index: match.index });
  }
  for (const match of contents.matchAll(/`([^`\r\n]+)`/g)) {
    segments.push({ value: match[1], index: match.index });
  }
  return segments;
}

function validateCommands(markdownFiles, packageJson) {
  const scripts = new Set(Object.keys(packageJson.scripts ?? {}));
  let referenceCount = 0;

  for (const markdownPath of markdownFiles) {
    const contents = readFileSync(markdownPath, "utf8");
    for (const segment of collectCodeSegments(contents)) {
      for (const match of segment.value.matchAll(
        /\bpnpm(?:\s+run)?\s+([:@\w-]+)/g,
      )) {
        referenceCount += 1;
        const command = match[1];
        if (scripts.has(command) || BUILTIN_PNPM_COMMANDS.has(command)) {
          continue;
        }

        addError("commands", {
          file: toRepositoryPath(markdownPath),
          line: lineAt(contents, segment.index + match.index),
          message: `comando pnpm não existe na raiz: ${command}`,
          hint: "Corrija o nome ou declare o script em package.json e no catálogo.",
        });
      }
    }
  }

  addCheck(
    "commands",
    "Referências a comandos pnpm",
    `${referenceCount} referências verificadas`,
  );
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validateCommandCatalog(packageJson) {
  const catalogPath = resolve(ROOT_DIRECTORY, "docs/commands.md");
  if (!existsSync(catalogPath)) {
    addCheck("catalog", "Catálogo de scripts", "catálogo ausente");
    return;
  }

  const catalog = readFileSync(catalogPath, "utf8");
  const scripts = Object.keys(packageJson.scripts ?? {});
  for (const script of scripts) {
    const escapedScript = escapeRegularExpression(script);
    const pattern = new RegExp(
      `pnpm(?:\\s+run)?\\s+${escapedScript}(?![\\w:-])`,
    );
    if (!pattern.test(catalog)) {
      addError("catalog", {
        file: "docs/commands.md",
        message: `script da raiz não documentado: ${script}`,
        hint: `Adicione pnpm ${script} ao catálogo com finalidade, requisito e efeito.`,
      });
    }
  }

  addCheck(
    "catalog",
    "Catálogo de scripts",
    `${scripts.length} scripts documentados`,
  );
}

for (const requiredFile of REQUIRED_FILES) {
  if (!existsSync(resolve(ROOT_DIRECTORY, requiredFile))) {
    addError("required-files", {
      file: requiredFile,
      message: "documento ou instrução obrigatória ausente",
      hint: "Restaure o arquivo canônico ou ajuste conscientemente a lista obrigatória.",
    });
  }
}
addCheck(
  "required-files",
  "Arquivos canônicos",
  `${REQUIRED_FILES.length} arquivos obrigatórios`,
);

const markdownFiles = [
  resolve(ROOT_DIRECTORY, "README.md"),
  resolve(ROOT_DIRECTORY, "CONTRIBUTING.md"),
  ...collectMarkdownFiles(resolve(ROOT_DIRECTORY, "docs")),
  ...REQUIRED_FILES.filter((file) => file.endsWith("AGENTS.md")).map((file) =>
    resolve(ROOT_DIRECTORY, file),
  ),
].filter(
  (file, index, files) => existsSync(file) && files.indexOf(file) === index,
);

const packageJson = JSON.parse(
  readFileSync(resolve(ROOT_DIRECTORY, "package.json"), "utf8"),
);
validateLinks(markdownFiles);
validateCommands(markdownFiles, packageJson);
validateCommandCatalog(packageJson);

const result = {
  ok: errors.length === 0,
  filesChecked: markdownFiles.length,
  checks,
  errors,
};

if (JSON_OUTPUT) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  process.stdout.write(
    `Documentação: ${markdownFiles.length} arquivos verificados.\n`,
  );
  for (const check of checks) {
    process.stdout.write(
      `${check.ok ? "[ok]" : "[falha]"} ${check.label}: ${check.details}\n`,
    );
  }
  for (const error of errors) {
    process.stderr.write(
      `\n${error.file}:${error.line} — ${error.message}\nCorreção: ${error.hint}\n`,
    );
  }
}

process.exitCode = result.ok ? 0 : 1;
