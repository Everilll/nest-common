#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

const COLORS = {
  red: '\x1b[31m%s\x1b[0m',
  green: '\x1b[32m%s\x1b[0m',
  yellow: '\x1b[33m%s\x1b[0m',
  cyan: '\x1b[36m%s\x1b[0m',
  magenta: '\x1b[35m%s\x1b[0m',
};

function log(color, msg) {
  console.log(COLORS[color] || '%s', msg);
}

function fail(msg, err) {
  log('red', `❌ ${msg}`);
  if (err) console.error(err);
  process.exit(1);
}

async function generateCommon() {
  const sourceDir = path.join(__dirname, 'templates', 'common');
  const targetDir = path.join(process.cwd(), 'src', 'common');
  const appModulePath = path.join(process.cwd(), 'src', 'app.module.ts');

  // ── Validasi awal ────────────────────────────────────────────
  if (!fs.existsSync(path.join(process.cwd(), 'src'))) {
    fail('Error: "src" folder not found! Please run this command inside the root of your NestJS project.');
  }

  if (!fs.existsSync(sourceDir)) {
    fail(`Template source not found at ${sourceDir}. Reinstall the package or check your installation.`);
  }

  log('magenta', '💎 Welcome to @averildwi/nest-common Scaffolder 💎\n');

  // ── [1/3] Copy folder common (tanpa menimpa file yang sudah ada) ──
  let skippedFiles = [];
  try {
    log('cyan', '📂 [1/3] Injecting universal common modules into src/common...');

    if (fs.existsSync(targetDir)) {
      log('yellow', '⚠️ [Warning] src/common already exists — only missing files will be added, existing files are left untouched.');
    }

    async function walk(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      let files = [];
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files = files.concat(await walk(full));
        } else {
          files.push(full);
        }
      }
      return files;
    }

    const allTemplateFiles = await walk(sourceDir);
    for (const filePath of allTemplateFiles) {
      const rel = path.relative(sourceDir, filePath);
      const dest = path.join(targetDir, rel);
      if (fs.existsSync(dest)) skippedFiles.push(rel);
    }

    await fs.copy(sourceDir, targetDir, {
      overwrite: false,
      errorOnExist: false,
    });

    if (skippedFiles.length > 0) {
      log('yellow', `⚠️ [Skip] ${skippedFiles.length} existing file(s) were not overwritten:`);
      skippedFiles.forEach((f) => console.log(`    - src/common/${f}`));
    }

    log('green', '✅ [Success] Common boilerplate folder successfully copied!');
  } catch (err) {
    fail('Failed to copy common folder structure.', err);
  }

  // ── [2/3] Auto-register to app.module.ts ────────────────────────
  try {
    if (fs.existsSync(appModulePath)) {
      log('cyan', '✍️ [2/3] Auto-registering AppConfigModule and HashingModule into src/app.module.ts...');
      let appModuleContent = await fs.readFile(appModulePath, 'utf8');
      const original = appModuleContent;

      const hasImportLine = /from\s+['"]\.\/common\/config\/app-config\.module['"]/.test(appModuleContent);
      const hasModuleUsage = /AppConfigModule\.forProject\s*\(/.test(appModuleContent);

      if (hasImportLine && hasModuleUsage) {
        log('yellow', '⚠️ [Skip] Modules are already registered inside app.module.ts.');
      } else {
        if (!hasImportLine) {
          const importLines =
            `import { AppConfigModule } from './common/config/app-config.module';\n` +
            `import { HashingModule } from './common/hashing/hashing.module';\n`;

          const lastImportMatch = [...appModuleContent.matchAll(/^import .+;$/gm)].pop();
          if (lastImportMatch) {
            const insertAt = lastImportMatch.index + lastImportMatch[0].length;
            appModuleContent =
              appModuleContent.slice(0, insertAt) + '\n' + importLines.trimEnd() + appModuleContent.slice(insertAt);
          } else {
            appModuleContent = importLines + appModuleContent;
          }
        }

        // regist to imports: [...] array
        if (!hasModuleUsage) {
          const importsRegex = /(imports\s*:\s*\[)/;
          if (importsRegex.test(appModuleContent)) {
            appModuleContent = appModuleContent.replace(
              importsRegex,
              `$1\n    AppConfigModule.forProject(),\n    HashingModule,`,
            );
          } else {
            log('yellow', '⚠️ [Warning] Could not find an "imports: [" array in app.module.ts. Please add these manually:');
            console.log('    AppConfigModule.forProject(),\n    HashingModule,');
          }
        }

        if (appModuleContent !== original) {
          await fs.writeFile(appModulePath, appModuleContent, 'utf8');
          log('green', '✅ [Success] Injected AppConfigModule.forProject() and HashingModule into AppModule graph.');
        }
      }
    } else {
      log('yellow', '⚠️ [Skip] src/app.module.ts not found — skipping auto-module injection. Please register the modules manually.');
    }
  } catch (err) {
    fail('Failed to inject code into app.module.ts automatically.', err);
  }

  // ── [3/3] Install dependencies ───────────────────────────────
  try {
    const dependencies = [
      '@nestjs/config',
      '@nestjs/passport',
      '@nestjs/swagger',
      'class-validator',
      'class-transformer',
      'joi',
    ].join(' ');

    log('cyan', '\n📦 [3/3] Installing core framework and ecosystem dependencies...');
    execSync(`npm install ${dependencies}`, { stdio: 'inherit' });
    log('green', '✅ [Success] All required dependencies successfully installed via npm.');
  } catch (err) {
    fail('npm dependency installation failed. Please check your network or package.json.', err);
  }

  // ── Optional: lint fix
  try {
    const pkgJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      const pkgJson = await fs.readJson(pkgJsonPath);
      if (pkgJson.scripts && pkgJson.scripts.lint) {
        log('cyan', '🧹 Running "npm run lint" to auto-format the injected code...');
        execSync('npm run lint', { stdio: 'ignore' });
        log('green', '✅ [Success] Lint auto-fix applied.');
      }
    }
  } catch (err) {
    log('yellow', '⚠️ [Warning] "npm run lint" failed or reported issues — this does NOT affect the scaffolding result, please check your lint config manually.');
  }

  log('magenta', '\n🎉 [Scaffolding Completed] Your project architecture is ready!');
}

generateCommon().catch((err) => {
  fail('Unexpected error during scaffolding.', err);
});