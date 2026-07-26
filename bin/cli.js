#!/usr/bin/env node
// @barkermoney/skills CLI — install/list/update/remove Barker skills into a Claude
// Code-compatible skills directory. Zero dependencies, Node 18+.

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const PKG_ROOT = path.resolve(__dirname, "..");
const BUNDLED_SKILLS_DIR = path.join(PKG_ROOT, "skills");
const REPO = "https://github.com/YBSbarker/barker-mcp";

function defaultTarget() {
  return (
    process.env.BARKER_SKILLS_DIR ||
    path.join(os.homedir(), ".claude", "skills")
  );
}

function listBundledSkills() {
  if (!fs.existsSync(BUNDLED_SKILLS_DIR)) return [];
  return fs
    .readdirSync(BUNDLED_SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function parseArgs(argv) {
  const out = { _: [], target: null, force: false, all: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--all") out.all = true;
    else if (a === "--force" || a === "-f") out.force = true;
    else if (a === "--target") out.target = argv[++i];
    else if (a.startsWith("--target=")) out.target = a.slice("--target=".length);
    else out._.push(a);
  }
  return out;
}

function printHelp() {
  const skills = listBundledSkills();
  console.log(`@barkermoney/skills — Barker stablecoin yield skills for Claude Code

Usage:
  npx @barkermoney/skills <command> [options]

Commands:
  list                    Show bundled skills + which are installed
  install [name...]       Install one or more skills (or --all)
  install --all           Install every bundled skill
  remove <name...>        Uninstall one or more skills from the target dir
  update                  Re-install every skill currently in the target dir

Options:
  --target <dir>          Install dir (default: $BARKER_SKILLS_DIR or ~/.claude/skills)
  --force, -f             Overwrite if already installed
  --help, -h              Show this help

Bundled skills (${skills.length}):
${skills.map((s) => "  - " + s).join("\n")}

Docs: https://barker.money  ·  Repo: ${REPO}
`);
}

function printList() {
  const target = defaultTarget();
  const skills = listBundledSkills();
  console.log(`Bundled skills (${skills.length}):\n`);
  for (const s of skills) {
    const installed = fs.existsSync(path.join(target, s));
    const mark = installed ? "✓" : " ";
    console.log(`  ${mark} ${s}${installed ? "  (installed)" : ""}`);
  }
  console.log(`\nTarget dir: ${target}`);
  console.log(`(override with --target <dir> or $BARKER_SKILLS_DIR)`);
}

function ensureTarget(target) {
  fs.mkdirSync(target, { recursive: true });
}

function installOne(name, target, force) {
  const src = path.join(BUNDLED_SKILLS_DIR, name);
  if (!fs.existsSync(src)) {
    console.error(`✗ unknown skill: ${name}`);
    console.error(`  run 'npx @barkermoney/skills list' to see available skills`);
    return false;
  }
  const dst = path.join(target, name);
  if (fs.existsSync(dst)) {
    if (!force) {
      console.log(`• ${name} already installed (use --force to overwrite)`);
      return true;
    }
    fs.rmSync(dst, { recursive: true, force: true });
  }
  fs.cpSync(src, dst, { recursive: true });
  console.log(`✓ ${name} → ${dst}`);
  return true;
}

function cmdInstall(args) {
  const target = args.target || defaultTarget();
  const skills = listBundledSkills();
  let toInstall = args._.slice(1); // drop command name

  if (args.all) toInstall = skills;
  if (toInstall.length === 0) {
    console.error("✗ specify a skill name, or --all");
    console.error("  run 'npx @barkermoney/skills list' to see available skills");
    process.exit(1);
  }

  ensureTarget(target);
  console.log(`Installing into: ${target}\n`);

  let ok = 0;
  let fail = 0;
  for (const name of toInstall) {
    if (installOne(name, target, args.force)) ok++;
    else fail++;
  }

  console.log(`\n${ok} installed, ${fail} failed`);
  if (ok > 0) {
    console.log(`\nNext: restart Claude Code (or your agent runtime) to load the new skills.`);
  }
  if (fail > 0) process.exit(1);
}

function cmdRemove(args) {
  const target = args.target || defaultTarget();
  const toRemove = args._.slice(1);
  if (toRemove.length === 0) {
    console.error("✗ specify a skill name to remove");
    process.exit(1);
  }
  let ok = 0;
  for (const name of toRemove) {
    const dst = path.join(target, name);
    if (!fs.existsSync(dst)) {
      console.log(`• ${name} not installed at ${target}`);
      continue;
    }
    fs.rmSync(dst, { recursive: true, force: true });
    console.log(`✓ removed ${name}`);
    ok++;
  }
  console.log(`\n${ok} removed`);
}

function cmdUpdate(args) {
  const target = args.target || defaultTarget();
  const bundled = new Set(listBundledSkills());
  if (!fs.existsSync(target)) {
    console.log(`Target ${target} does not exist. Nothing to update.`);
    return;
  }
  const installed = fs
    .readdirSync(target, { withFileTypes: true })
    .filter((d) => d.isDirectory() && bundled.has(d.name))
    .map((d) => d.name);
  if (installed.length === 0) {
    console.log(`No Barker skills installed at ${target}.`);
    console.log(`Run 'npx @barkermoney/skills install --all' to install them.`);
    return;
  }
  console.log(`Updating ${installed.length} skill(s) in ${target}\n`);
  let ok = 0;
  for (const name of installed) {
    if (installOne(name, target, true)) ok++;
  }
  console.log(`\n${ok} updated`);
  console.log(`\nNext: restart Claude Code (or your agent runtime) to pick up changes.`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args._.length === 0) {
    printHelp();
    return;
  }
  const cmd = args._[0];
  switch (cmd) {
    case "list":
      printList();
      break;
    case "install":
      cmdInstall(args);
      break;
    case "remove":
    case "uninstall":
      cmdRemove(args);
      break;
    case "update":
      cmdUpdate(args);
      break;
    default:
      console.error(`✗ unknown command: ${cmd}`);
      console.error(`  run 'npx @barkermoney/skills --help' for usage`);
      process.exit(1);
  }
}

main();
