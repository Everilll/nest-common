#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');

async function generateCommon() {
  const sourceDir = path.join(__dirname, 'templates', 'common');
  
  const targetDir = path.join(process.cwd(), 'src', 'common');

  if (!fs.existsSync(path.join(process.cwd(), 'src'))) {
    console.error('\x1b[31m%s\x1b[0m', '❌ Error: Folder "src" tidak ditemukan!');
    console.error('\x1b[33m%s\x1b[0m', 'Pastikan Anda menjalankan perintah ini di dalam root project NestJS Anda.');
    process.exit(1);
  }

  try {
    await fs.copy(sourceDir, targetDir);
    console.log('\x1b[32m%s\x1b[0m', '⚡ [Sukses] Folder common komplit berhasil dipasang di src/common!');
  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', '❌ Gagal menyalin folder:', err);
  }
}

generateCommon();
