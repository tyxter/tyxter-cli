import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, mkdir, readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('release channels', () => {
  it('keeps prerelease and metadata tags off latest', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tyxter-release-'));
    try {
      await mkdir(join(dir, 'scripts'));
      const script = join(dir, 'scripts', 'release-metadata.mjs');
      await copyFile('scripts/release-metadata.mjs', script);
      for (const version of ['0.1.0-next.1', '0.1.0+build.1']) {
        await writeFile(join(dir, 'package.json'), JSON.stringify({ version }));
        await writeFile(join(dir, 'CHANGELOG.md'), `## [${version}]\n\n- A change.\n`);
        const { stdout } = await promisify(execFile)(process.execPath, [script], {
          env: { PATH: process.env.PATH, GITHUB_REF: `refs/tags/v${version}` },
        });
        expect(stdout).toBe('stable=false\n');
      }
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it('allows latest only for the exact stable package tag', async () => {
    const { version } = JSON.parse(await readFile('package.json', 'utf8')) as { version: string };
    const dir = await mkdtemp(join(tmpdir(), 'tyxter-release-'));
    try {
      for (const [ref, stable] of [['refs/heads/main', false], [`refs/tags/v${version}`, true]]) {
        const output = join(dir, 'output');
        const result = await promisify(execFile)(process.execPath, ['scripts/release-metadata.mjs'], {
          env: { ...process.env, GITHUB_REF: String(ref), GITHUB_OUTPUT: output },
        });
        expect(result.stdout).toBe(`stable=${stable}\n`);
      }
      await expect(promisify(execFile)(process.execPath, ['scripts/release-metadata.mjs'], {
        env: { ...process.env, GITHUB_REF: 'refs/tags/v999.0.0' },
      })).rejects.toMatchObject({ stderr: expect.stringContaining('must match') });
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});

describe('release notes', () => {
  const changelog = [
    '# Changelog', '', '## [Unreleased]', '',
    '## [0.2.0] - 2026-01-02', '', '### Fixed', '', '- Second fix. (#2)', '',
    '## [0.1.0] - 2026-01-01', '', 'First release.', '',
    '[0.2.0]: https://example.test/compare/v0.1.0...v0.2.0', '',
  ].join('\n');
  async function run(version: string, text: string): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'tyxter-release-'));
    try {
      await mkdir(join(dir, 'scripts'));
      const script = join(dir, 'scripts', 'release-metadata.mjs');
      await copyFile('scripts/release-metadata.mjs', script);
      await writeFile(join(dir, 'package.json'), JSON.stringify({ version }));
      await writeFile(join(dir, 'CHANGELOG.md'), text);
      const notes = join(dir, 'notes.md');
      await promisify(execFile)(process.execPath, [script], {
        env: { PATH: process.env.PATH, GITHUB_REF: `refs/tags/v${version}`, RELEASE_NOTES_FILE: notes },
      });
      return await readFile(notes, 'utf8');
    } finally { await rm(dir, { recursive: true, force: true }); }
  }
  it("writes only the version's changelog section", async () => {
    expect(await run('0.2.0', changelog)).toBe('### Fixed\n\n- Second fix. (#2)\n');
    expect(await run('0.1.0', changelog)).toBe('First release.\n');
  });
  it('refuses a version whose changelog section is missing or empty', async () => {
    for (const [version, text] of [['0.3.0', changelog], ['0.2.0', '## [0.2.0]\n\n## [0.1.0]\n\n- A change.\n']]) {
      await expect(run(version, text)).rejects.toMatchObject({
        stderr: expect.stringContaining(`CHANGELOG.md must have a section for ${version}`),
      });
    }
  });
});
