import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const ref = process.env.GITHUB_REF ?? '';
const numeric = '(0|[1-9][0-9]*)';
const identifier = '(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)';
const semver = new RegExp(`^${numeric}\\.${numeric}\\.${numeric}(?:-${identifier}(?:\\.${identifier})*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`);
if (!semver.test(version)) throw new Error('package.json must contain a valid SemVer version');
if (ref.startsWith('refs/tags/') && ref !== `refs/tags/v${version}`) {
  throw new Error('Release tag must match v<package.json version>');
}
// Every version has a section in CHANGELOG.md; it becomes the GitHub release body.
const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8').split(/\r?\n/);
const heading = changelog.findIndex((line) => line.startsWith(`## [${version}]`));
const body = heading === -1 ? [] : changelog.slice(heading + 1);
const next = body.findIndex((line) => /^## |^\[[^\]]+\]: /.test(line));
const notes = (next === -1 ? body : body.slice(0, next)).join('\n').trim();
if (!notes) throw new Error(`CHANGELOG.md must have a section for ${version}`);
if (process.env.RELEASE_NOTES_FILE) writeFileSync(process.env.RELEASE_NOTES_FILE, `${notes}\n`);
const stable = ref === `refs/tags/v${version}` && /^\d+\.\d+\.\d+$/.test(version);
const output = `stable=${stable}\n`;
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output);
process.stdout.write(output);
