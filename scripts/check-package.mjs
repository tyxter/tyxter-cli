import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

execFileSync('pnpm', ['build'], { stdio: 'inherit' });
const result = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { encoding: 'utf8' }));
const pack = Array.isArray(result) ? result[0] : Object.values(result)[0];
const files = pack.files.map((file) => file.path);
assert(files.includes('LICENSE'), 'package must contain the license');
assert(files.includes('dist/main.js'), 'package must contain the executable');
assert(files.includes('dist/state.js'), 'package must contain imported modules');
assert(files.every((file) => file === 'package.json' || file === 'README.md' || file === 'LICENSE' || /^dist\/[^/]+\.(?:js(?:\.map)?|d\.ts)$/.test(file)), 'package contains unexpected files');
assert(!files.some((file) => file.includes('.test.')), 'package must not contain tests');
console.log(`Package contains ${files.length} runtime and documentation files`);

const root = resolve('.');
const metadata = JSON.parse(readFileSync('package.json', 'utf8'));
const aliasDir = resolve('packages/tyxter-cli');
const alias = JSON.parse(readFileSync(join(aliasDir, 'package.json'), 'utf8'));
assert.equal(alias.version, metadata.version, 'alias must use the release version');
assert.equal(alias.dependencies[metadata.name], metadata.version, 'alias must pin the exact CLI version');
const aliasResult = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  cwd: aliasDir, encoding: 'utf8',
}));
const aliasPack = Array.isArray(aliasResult) ? aliasResult[0] : Object.values(aliasResult)[0];
assert.deepEqual(aliasPack.files.map((file) => file.path).sort(), [
  'LICENSE', 'README.md', 'bin/tyxter-cli.js', 'package.json',
]);
assert.equal(readFileSync(join(aliasDir, 'LICENSE'), 'utf8'), readFileSync('LICENSE', 'utf8'));

// Install the actual release tarballs outside the checkout. This catches missing
// runtime files and broken bin links that source-based unit tests cannot detect.
const dir = mkdtempSync(join(tmpdir(), 'tyxter-package-'));
try {
  const tarballs = [root, aliasDir].map((cwd, index) => {
    // Both names normalize to tyxter-cli-<version>.tgz on npm 12.
    const destination = join(dir, String(index));
    mkdirSync(destination);
    const packedResult = JSON.parse(execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', destination], {
      cwd, encoding: 'utf8',
    }));
    const packed = Array.isArray(packedResult) ? packedResult[0] : Object.values(packedResult)[0];
    return join(destination, packed.filename);
  });
  execFileSync('npm', ['install', '--prefix', dir, '--ignore-scripts', '--no-audit', '--no-fund', ...tarballs], {
    cwd: dir, stdio: 'inherit',
  });
  for (const bin of ['tyxter', 'tyxter-cli']) {
    const options = { cwd: dir, encoding: 'utf8' };
    assert.equal(execFileSync(join(dir, 'node_modules/.bin', bin), ['--version'], options).trim(), metadata.version);
    assert.match(execFileSync(join(dir, 'node_modules/.bin', bin), ['--help'], options), /listen/);
    assert.throws(() => execFileSync(join(dir, 'node_modules/.bin', bin), ['unknown-command'], {
      ...options, stdio: 'pipe',
    }), (error) => error.status === 1, 'unknown commands must fail through both executables');
  }
  console.log('Both npm tarballs install and run without pnpm or Docker');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
