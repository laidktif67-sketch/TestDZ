#!/usr/bin/env node
/**
 * Synchronize documented brand palette values into an existing design-token file.
 * Preview with --dry-run. Existing outputs are backed up before any write.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const GUIDELINES = path.resolve(process.cwd(), "docs/brand-guidelines.md");
const TOKENS = path.resolve(process.cwd(), "assets/design-tokens.json");
const CSS = path.resolve(process.cwd(), "assets/design-tokens.css");
const GENERATOR = path.resolve(__dirname, "../../design-system/scripts/generate-tokens.cjs");
const HEX = /^#[0-9a-f]{6}$/i;

function slugify(value, fallback) {
  const slug = value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || fallback;
}

function extractColorsFromMarkdown(content) {
  const roles = {
    primary: { name: "primary", base: null, dark: null, light: null },
    secondary: { name: "secondary", base: null, dark: null, light: null },
    accent: { name: "accent", base: null, dark: null, light: null },
  };
  const row = /^\s*\|\s*\*{0,2}([^*|]+?)\*{0,2}\s*\|\s*(#[0-9a-f]{6})\b[^|]*\|/gim;
  const sections = [
    ["primary", /###\s+Primary Colors\s*\n([\s\S]*?)(?=\n###|\n##|$)/i],
    ["secondary", /###\s+Secondary Colors\s*\n([\s\S]*?)(?=\n###|\n##|$)/i],
    ["accent", /###\s+Accent Colors\s*\n([\s\S]*?)(?=\n###|\n##|$)/i],
  ];
  for (const [role, re] of sections) {
    const match = content.match(re);
    if (!match) continue;
    for (const item of match[1].matchAll(row)) {
      const label = item[1].trim();
      const hex = item[2].toUpperCase();
      const normalized = label.toLowerCase();
      if (/\bdark\b/.test(normalized)) roles[role].dark = hex;
      else if (/\blight\b/.test(normalized)) roles[role].light = hex;
      else if (!roles[role].base) {
        roles[role].base = hex;
        roles[role].name = slugify(label, role);
      }
    }
  }
  // Quick Reference is a fallback for role values, not a source for color names.
  for (const role of Object.keys(roles)) {
    if (!roles[role].base) {
      const quick = content.match(new RegExp("^\\s*\\|\\s*" + role + " Color\\s*\\|\\s*(#[0-9a-f]{6})", "im"));
      if (quick) roles[role].base = quick[1].toUpperCase();
    }
  }
  // Some guides document an accent swatch in the secondary table.
  if (!roles.accent.base) {
    const secondary = content.match(sections[1][1]);
    if (secondary) {
      for (const item of secondary[1].matchAll(row)) {
        if (/\baccent\b/i.test(item[1])) {
          roles.accent.base = item[2].toUpperCase();
          roles.accent.name = slugify(item[1].trim(), "accent");
          break;
        }
      }
    }
  }
  for (const role of Object.keys(roles)) {
    if (!HEX.test(roles[role].base || "")) {
      throw new Error("Missing or invalid required " + role + " color in brand guidelines.");
    }
  }
  return roles;
}

function adjustBrightness(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const channels = [n >> 16, (n >> 8) & 255, n & 255]
    .map(v => Math.max(0, Math.min(255, v + Math.round(255 * amount))));
  return "#" + channels.map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function colorScale(c) {
  return {
    "50": { "$value": c.light || adjustBrightness(c.base, 0.9), "$type": "color" },
    "100": { "$value": c.light || adjustBrightness(c.base, 0.8), "$type": "color" },
    "200": { "$value": adjustBrightness(c.base, 0.6), "$type": "color" },
    "300": { "$value": adjustBrightness(c.base, 0.4), "$type": "color" },
    "400": { "$value": adjustBrightness(c.base, 0.2), "$type": "color" },
    "500": { "$value": c.base, "$type": "color" },
    "600": { "$value": c.dark || adjustBrightness(c.base, -0.15), "$type": "color" },
    "700": { "$value": adjustBrightness(c.base, -0.3), "$type": "color" },
    "800": { "$value": adjustBrightness(c.base, -0.45), "$type": "color" },
    "900": { "$value": adjustBrightness(c.base, -0.6), "$type": "color" },
  };
}

function updateDesignTokens(tokens, colors) {
  if (!tokens || typeof tokens !== "object" || Array.isArray(tokens)) {
    throw new Error("Token JSON root must be an object.");
  }
  if (!tokens.primitive || typeof tokens.primitive !== "object") {
    throw new Error("Token file is missing primitive object; refusing to invent a token schema.");
  }
  if (!tokens.primitive.color || typeof tokens.primitive.color !== "object") {
    throw new Error("Token file is missing primitive.color; refusing to invent a token schema.");
  }
  const primitive = tokens.primitive.color;
  for (const role of ["primary", "secondary", "accent"]) {
    primitive[colors[role].name] = colorScale(colors[role]);
  }
  if (tokens.semantic?.color) {
    const sem = tokens.semantic.color;
    for (const [role, prefix] of [["primary", "primary"], ["secondary", "secondary"], ["accent", "accent"]]) {
      const name = colors[role].name;
      const shades = role === "primary"
        ? [["", "500"], ["-hover", "600"], ["-active", "700"], ["-light", "400"], ["-lighter", "100"], ["-dark", "600"]]
        : role === "secondary"
          ? [["", "500"], ["-hover", "600"], ["-light", "300"], ["-dark", "600"]]
          : [["", "500"], ["-hover", "600"], ["-light", "300"]];
      for (const [suffix, shade] of shades) {
        sem[prefix + suffix] = { "$value": "{primitive.color." + name + "." + shade + "}", "$type": "color" };
      }
    }
    // Keep semantic status colors untouched: brand roles do not define status meaning.
  }
  if (tokens.component?.button?.secondary && colors.primary.base) {
    tokens.component.button.secondary["bg-hover"] = {
      "$value": colors.primary.base + "1A", "$type": "color"
    };
  }
  return tokens;
}

function backup(file) {
  if (!fs.existsSync(file)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = file + ".backup-" + stamp;
  fs.copyFileSync(file, target, fs.constants.COPYFILE_EXCL);
  return target;
}

function atomicWrite(file, content) {
  const temp = file + ".tmp-" + process.pid;
  fs.writeFileSync(temp, content, { encoding: "utf8", flag: "wx" });
  fs.renameSync(temp, file);
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!fs.existsSync(GUIDELINES)) throw new Error("Brand guide not found: " + GUIDELINES);
  if (!fs.existsSync(TOKENS)) throw new Error("Existing token JSON not found: " + TOKENS + ". Create/review it with design-system first.");
  const colors = extractColorsFromMarkdown(fs.readFileSync(GUIDELINES, "utf8"));
  const originalJson = fs.readFileSync(TOKENS, "utf8");
  const tokens = updateDesignTokens(JSON.parse(originalJson), colors);
  const nextJson = JSON.stringify(tokens, null, 2) + "\n";

  console.log("Palette preview:");
  for (const role of ["primary", "secondary", "accent"]) {
    console.log("  " + role + ": " + colors[role].name + " " + colors[role].base);
  }
  if (dryRun) {
    console.log("\nDry run: no files changed.");
    console.log(JSON.stringify(tokens.primitive.color, null, 2));
    return;
  }
  if (!fs.existsSync(GENERATOR)) {
    throw new Error("Design-system token generator not found at " + GENERATOR + "; no files changed.");
  }

  const jsonBackup = backup(TOKENS);
  const cssBackup = backup(CSS);
  try {
    atomicWrite(TOKENS, nextJson);
    execFileSync(process.execPath, [GENERATOR, "--config", TOKENS, "-o", CSS], {
      cwd: process.cwd(), stdio: "inherit"
    });
  } catch (error) {
    if (jsonBackup) fs.copyFileSync(jsonBackup, TOKENS);
    if (cssBackup) fs.copyFileSync(cssBackup, CSS);
    else if (fs.existsSync(CSS)) fs.unlinkSync(CSS);
    throw new Error("Token sync failed; previous outputs were restored. " + error.message);
  }
  console.log("\nSync complete. Backups:");
  console.log("  JSON: " + (jsonBackup || "none (file did not previously exist)"));
  console.log("  CSS: " + (cssBackup || "none (file did not previously exist)"));
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error("Brand token sync failed: " + error.message);
    process.exitCode = 1;
  }
}
module.exports = { extractColorsFromMarkdown, colorScale, updateDesignTokens, adjustBrightness };
