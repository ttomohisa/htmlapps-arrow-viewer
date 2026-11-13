'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('phone widths hide only the hero local-processing badge', () => {
  for (const file of ['src/index.template.html', 'arrow-viewer.html']) {
    const html = read(file);
    const phoneRules = html.match(/@media \(max-width: 620px\)\s*\{([\s\S]*?)\n    \}/);
    assert.ok(phoneRules, file + ' must contain the phone breakpoint');
    assert.match(phoneRules[1], /\.local-badge\s*\{\s*display:\s*none;\s*\}/);
    assert.match(html, /<div class="local-badge">/, 'keep the desktop badge');
    assert.match(html, /data-i18n="helpPrivacyBody"/, 'privacy explanation stays available in Help');
  }
});

test('tag and release only on main after version checks and a successful standalone build', () => {
  const yaml = read('.github/workflows/release.yml');
  assert.match(yaml, /on:\s*\n\s*push:\s*\n\s*branches:\s*\n\s*- main/);
  assert.match(yaml, /if: github\.ref == 'refs\/heads\/main'/);
  assert.match(yaml, /permissions:\s*\n\s*contents: write/);
  assert.match(yaml, /concurrency:\s*\n\s*group: arrow-viewer-github-release\s*\n\s*cancel-in-progress: false/);
  assert.match(yaml, /run: \.\/scripts\/resolve-release-state\.ps1/);
  const preflight = read('scripts/resolve-release-state.ps1');
  assert.match(preflight, /Get-Content -Raw -Encoding utf8 app\.config\.json/);
  assert.match(preflight, /gh release list --limit 1000 --json tagName,isDraft/);
  assert.match(preflight, /if \(\$LASTEXITCODE -ne 0\) \{ throw 'Could not list GitHub releases\.' \}/);
  assert.match(preflight, /if \(\$existingRelease\.isDraft\)/);
  assert.match(preflight, /Set-ReleaseOutput 'publish' 'false'/);
  assert.match(preflight, /git tag --list -- \$tag/);
  assert.match(preflight, /if \(\$tagCommit\.Trim\(\) -ne \$head\.Trim\(\)\)/);
  assert.match(preflight, /Set-ReleaseOutput 'publish' 'true'/);
  assert.match(preflight, /if \(-not \$CheckOnly\)/);
  assert.match(yaml, /run: \.\/scripts\/check-repository\.ps1/);
  assert.match(yaml, /if: steps\.version\.outputs\.publish == 'true'/);
  assert.match(yaml, /git tag -a \$env:RELEASE_TAG/);
  assert.match(yaml, /git push origin/);
  assert.match(yaml, /'--verify-tag'/);
  assert.match(yaml, /'--generate-notes'/);
  assert.match(yaml, /dist\/index\.html/);
  assert.match(yaml, /dist\/index\.self-extract\.html/);
});

test('PR CI validates changes to the release workflow', () => {
  const yaml = read('.github/workflows/build-standalone.yml');
  assert.match(yaml, /"\.github\/workflows\/release\.yml"/);
  assert.match(yaml, /run: \.\/scripts\/resolve-release-state\.ps1 -CheckOnly/);
  assert.match(yaml, /fetch-depth: 0/);
});
