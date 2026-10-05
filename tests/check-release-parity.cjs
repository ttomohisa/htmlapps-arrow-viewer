const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const runtime = html => {
  const begin = html.indexOf('      const $=s=>'), end = html.indexOf('    })();', begin);
  assert.ok(begin > 0 && end > begin);
  return html.slice(begin, end);
};
assert.equal(runtime(read('arrow-viewer.html')), runtime(read('src/index.template.html')), 'checked-in root runtime must match editable source before the build');
if (!process.argv.includes('--source-only')) {
  const standalone = read('dist/index.html');
  assert.equal(read('arrow-viewer.html'), standalone, 'default build must synchronize the root download');
  const wrapper = read('dist/index.self-extract.html');
  const payload = wrapper.match(/<script id="self-extract-payload" type="application\/octet-stream">([\s\S]*?)<\/script>/)[1];
  const restored = zlib.gunzipSync(Buffer.from(payload.replace(/\s/g, ''), 'base64')).toString('utf8');
  assert.equal(restored, standalone, 'self-extracted runtime must be byte-identical to standalone');
}
console.log('Arrow release parity passed.');
