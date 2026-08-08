/**
 * Copies the Prisma-generated client from src/generated/prisma into dist/
 * after tsc compiles. tsc only emits .ts files; the generated client ships as
 * .js/.d.ts and must be copied verbatim for the compiled app to resolve it.
 */
const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
      continue;
    }
    // Windows: the Prisma query engine DLL is loaded by the running dev server
    // (`nest start --watch`), so copyFileSync to a live dist/ raises EBUSY.
    // The engine is byte-identical between builds — skip the copy when the
    // destination already matches, and swallow EBUSY as a no-op.
    if (fs.existsSync(d)) {
      try {
        if (fs.readFileSync(s).equals(fs.readFileSync(d))) continue;
      } catch {
        // unreadable destination (locked) — treat as identical and skip
        continue;
      }
    }
    try {
      fs.copyFileSync(s, d);
    } catch (e) {
      if (e.code !== 'EBUSY') throw e;
    }
  }
}

copyDir(
  path.join(__dirname, '..', 'src', 'generated', 'prisma'),
  path.join(__dirname, '..', 'dist', 'generated', 'prisma'),
);
console.log('✔ copied generated prisma client into dist/');
