const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');

// Actual application functions and event callbacks; DOM and browser I/O are small
// stand-ins. Fixtures exercise batch decoding, not complete IPC container parsing.
const target = process.env.ARROW_TEST_HTML || 'src/index.template.html';
let html = fs.readFileSync(path.resolve(__dirname, '..', target), 'utf8');
if (html.includes('id="self-extract-payload"')) {
  const payload = html.match(/<script id="self-extract-payload" type="application\/octet-stream">([\s\S]*?)<\/script>/)[1];
  html = zlib.gunzipSync(Buffer.from(payload.replace(/\s/g, ''), 'base64')).toString('utf8');
}
function harness() {
  const elements = new Map(), writes = [], downloads = [], pendingClipboard = [];
  let clipboardDeferred = false;
  function element(tag = 'div') {
    const classes = new Set();
    return { tag, value: '', disabled: false, hidden: false, textContent: '', innerHTML: '', style: {}, dataset: {}, children: [], listeners: {}, attributes: {},
      classList: { add(c) { classes.add(c); }, remove(c) { classes.delete(c); }, toggle(c, flag) { if (flag ?? !classes.has(c)) classes.add(c); else classes.delete(c); }, contains(c) { return classes.has(c); } },
      addEventListener(type, fn) { this.listeners[type] = fn; }, setAttribute(name, value) { this.attributes[name] = String(value); },
      focus() { document.activeElement = this; },
      querySelector(selector) { const index = selector.match(/^\[data-sort-index="(\d+)"\]$/)?.[1]; return this.children.find(child => child.dataset?.sortIndex === index) || this.children.map(child => child.querySelector?.(selector)).find(Boolean) || null; },
      append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; },
      click() { if (this.tag === 'a') downloads.push({ name: this.download, url: this.href }); },
      showModal() { this.open = true; }, close() { this.open = false; },
      getBoundingClientRect() { return { left: 0, top: 0, right: 100, bottom: 100 }; }, remove() {}, select() {}
    };
  }
  const document = { body: element('body'), documentElement: {}, querySelector(s) { if (!elements.has(s)) elements.set(s, element(s)); return elements.get(s); }, querySelectorAll() { return []; }, createElement: element, addEventListener() {} };
  const context = { console, document, window: { addEventListener() {}, scrollTo() {} }, navigator: { language: 'en', clipboard: { writeText(text) { writes.push(text); if (clipboardDeferred) { const d = deferred(); pendingClipboard.push(d); return d.promise; } return Promise.resolve(); } } }, localStorage: { getItem() { return null; }, setItem() {} }, TextDecoder, TextEncoder, Uint8Array, ArrayBuffer, DataView, Map, Set, Date, Blob, URL: { createObjectURL(blob) { downloads.push({ blob }); return 'blob:synthetic'; }, revokeObjectURL() {} }, setTimeout() { return 1; }, clearTimeout() {}, APP_CONFIG: { slug: 'arrow-viewer', name: 'Arrow Viewer', nameJa: 'Arrow Viewer', version: '1.0.0' } };
  vm.createContext(context);
  const begin = html.indexOf('      const $=s=>'), end = html.indexOf('    })();', begin);
  assert.ok(begin > 0 && end > begin, 'application closure exists');
  vm.runInContext(html.slice(begin, end) + '\n globalThis.api={state,sortedRows,buildFileState,readPage,buildCurrentCsv,copyCsv,downloadCsv,prettyValue,cellText,decodeBatchColumns,renderData,renderActive,rootFields,closeFile,activateFile,inspectFile,openCell,setHeaderDetector(fn){detectContainer=fn;}};', context);
  const api = context.api;
  const get = s => document.querySelector(s);
  function mount(fileState) { api.state.files.push(fileState); api.state.activeId = fileState.id; api.renderActive(); return fileState; }
  function fixture(name = 'fictional.arrow', values = [101, 202]) {
    const reads = [];
    const file = { name, size: 204, lastModified: 0, slice(start) { const wait = deferred(); reads.push({ start, ...wait }); return { arrayBuffer: () => wait.promise }; } };
    const state = api.buildFileState(file);
    const field = { name: 'value', nullable: false, type: { id: 2, name: 'int', bitWidth: 32, signed: true }, children: [] };
    state.header = { schema: { fields: [field], endianness: 0, metadata: new Map(), features: [] }, dictionaries: [], batches: values.map((_, i) => ({ index: i, bodyStart: 100 + i * 100, bodyLength: 4, rowStart: i, rowEnd: i + 1, batch: { length: 1, nodes: [{ length: 1, nullCount: 0 }], buffers: [{ offset: 0, length: 0 }, { offset: 0, length: 4 }], compression: null } })) };
    state.fields = api.rootFields(state.header.schema); state.totalRows = values.length; state.pageSize = 1; state.inspection = 'ready'; mount(state);
    return { state, reads };
  }
  async function start(f, page) { f.state.page = page; const promise = api.readPage(f.state); await tick(); return { promise, read: f.reads.at(-1) }; }
  const click = s => get(s).listeners.click();
  return { api, get, document, writes, downloads, pendingClipboard, deferClipboard() { clipboardDeferred = true; }, fixture, mount, start, click };
}
function deferred() { let resolve, reject; const promise = new Promise((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; }
function intBody(n) { const b = new ArrayBuffer(4); new DataView(b).setInt32(0, n, true); return b; }
async function tick() { for (let i = 0; i < 6; i++) await Promise.resolve(); }
async function complete(read, value) { read.read.resolve(intBody(value)); await read.promise; }
function assertDisabled(h, disabled) { assert.equal(h.get('#copyCsvButton').disabled, disabled); assert.equal(h.get('#downloadCsvButton').disabled, disabled); }
async function noExports(h) { const writes = h.writes.length, downloads = h.downloads.length; await h.click('#copyCsvButton'); h.click('#downloadCsvButton'); assert.equal(h.writes.length, writes); assert.equal(h.downloads.length, downloads); }

for (const oldOutcome of ['success', 'failure']) {
  for (const oldFirst of [false, true]) {
    test(`old ${oldOutcome} ${oldFirst ? 'before' : 'after'} latest read cannot replace rows, error, or loading`, async () => {
      const h = harness(), f = h.fixture(); const old = await h.start(f, 1), latest = await h.start(f, 2);
      async function settleOld() { if (oldOutcome === 'success') old.read.resolve(intBody(101)); else old.read.reject(new Error('obsolete')); await old.promise; }
      if (oldFirst) { await settleOld(); assert.equal(f.state.loading, true); assert.equal(f.state.rows.length, 0); assert.equal(f.state.error, ''); assertDisabled(h, true); }
      await complete(latest, 202);
      if (!oldFirst) await settleOld();
      assert.equal(f.state.loading, false); assert.equal(f.state.error, ''); assert.equal(f.state.rows[0].recordNumber, 2); assert.equal(f.state.rows[0].value.value, 202); assertDisabled(h, false);
      await h.click('#copyCsvButton'); assert.equal(h.writes[0], '__record,value\r\n2,202');
    });
  }
}
test('pending and failed pages block both actual CSV callbacks and clear previous rows; retry succeeds', async () => {
  const h = harness(), f = h.fixture(); await complete(await h.start(f, 1), 101);
  const next = await h.start(f, 2); assertDisabled(h, true); assert.equal(f.state.rows.length, 0); await noExports(h);
  next.read.reject(new Error('ordinary read failure')); await next.promise;
  assert.equal(f.state.error, 'ordinary read failure'); assertDisabled(h, true); await noExports(h);
  const retry = await h.start(f, 2); assert.equal(f.state.error, ''); await complete(retry, 202); assertDisabled(h, false);
  await h.click('#copyCsvButton'); assert.equal(h.writes.at(-1), '__record,value\r\n2,202');
});
test('obsolete successful read cannot erase the latest page error', async () => {
  const h = harness(), f = h.fixture(); const old = await h.start(f, 1), latest = await h.start(f, 2);
  latest.read.reject(new Error('latest failure')); await latest.promise; await complete(old, 101);
  assert.equal(f.state.error, 'latest failure'); assert.equal(f.state.rows.length, 0); assertDisabled(h, true); await noExports(h);
});
test('page-size event owns its request even when old page number is the same', async () => {
  const h = harness(), f = h.fixture(); const old = await h.start(f, 1);
  const next = h.get('#pageSizeSelect').listeners.change({ target: { value: '2' } }); await tick();
  const newer = f.reads.at(-1); await complete(old, 101); assert.equal(f.state.loading, true);
  newer.resolve(intBody(303)); await tick(); f.reads.at(-1).resolve(intBody(404)); await next;
  assert.deepEqual(Array.from(f.state.rows, row => row.value.value), [303, 404]); assertDisabled(h, false);
});
test('selection mismatch cannot export a previously committed page even before another read starts', async () => {
  const h = harness(), f = h.fixture(); await complete(await h.start(f, 1), 101); f.state.page = 2; h.api.renderData(f.state); assertDisabled(h, true); await noExports(h);
});
test('background file read commits only to its file and does not change active tab or export', async () => {
  const h = harness(), a = h.fixture('a.arrow'); const pending = await h.start(a, 1); const b = h.fixture('b.arrow'); await complete(await h.start(b, 2), 222);
  const status = h.get('#statusBanner').textContent; await complete(pending, 111);
  assert.equal(h.api.state.activeId, b.state.id); assert.equal(h.get('#statusBanner').textContent, status); assert.equal(h.get('#outputFilename').value, 'b-preview');
  await h.click('#copyCsvButton'); assert.equal(h.writes.at(-1), '__record,value\r\n2,222');
  h.api.activateFile(a.state.id); await h.click('#copyCsvButton'); assert.equal(h.writes.at(-1), '__record,value\r\n1,111');
});
for (const outcome of ['success', 'failure']) test(`closing a file invalidates its pending ${outcome} and cache writes`, async () => {
  const h = harness(), f = h.fixture(); const pending = await h.start(f, 1); h.api.closeFile(f.state.id);
  if (outcome === 'success') pending.read.resolve(intBody(101)); else pending.read.reject(new Error('closed file'));
  await pending.promise; assert.equal(f.state.rows.length, 0); assert.equal(f.state.error, ''); assert.equal(f.state.loading, false); assert.equal(f.state.batchCache.size, 0); assert.equal(h.api.state.files.length, 0); assertDisabled(h, true); await noExports(h);
});
test('closed inspection cannot publish a late failure', async () => {
  const h = harness(), wait = deferred(); const state = h.mount(h.api.buildFileState({ name: 'pending.arrow', size: 64, slice() { return { arrayBuffer: () => wait.promise }; } }));
  const inspect = h.api.inspectFile(state); h.api.closeFile(state.id); const phase = state.inspection;
  wait.reject(new Error('closed inspection')); await inspect; assert.equal(state.error, ''); assert.equal(state.inspection, phase); assert.equal(h.get('#statusBanner').textContent, '');
});
test('valid empty page exports headers and is not reread on tab activation', async () => {
  const h = harness(), f = h.fixture('empty.arrow', []); await h.api.readPage(f.state); assert.equal(f.state.rows.length, 0); assertDisabled(h, false);
  const generation = f.state.readGeneration; h.api.activateFile(f.state.id); await tick(); assert.equal(f.state.readGeneration, generation);
  await h.click('#copyCsvButton'); assert.equal(h.writes.at(-1), '__record,value'); h.click('#downloadCsvButton'); assert.equal(await h.downloads.find(x => x.blob).blob.text(), '__record,value');
});
for (const inspection of ['pending', 'reading', 'error']) test(`schema copy without a header is disabled and safe during ${inspection}`, async () => {
  const h = harness(); const state = h.mount(h.api.buildFileState({ name: 'waiting.arrow' })); state.inspection = inspection; h.api.renderActive();
  assert.equal(h.get('#copySchemaButton').disabled, true); await h.click('#copySchemaButton'); assert.equal(h.writes.length, 0); assertDisabled(h, true); await noExports(h);
});
test('schema copy works as soon as a valid header exists, including a pending or failed row read', async () => {
  const h = harness(), f = h.fixture(); f.state.inspection = 'reading'; const pending = await h.start(f, 1);
  assert.equal(h.get('#copySchemaButton').disabled, false); await h.click('#copySchemaButton'); assert.equal(JSON.parse(h.writes.at(-1)).fields[0].name, 'value');
  pending.read.reject(new Error('body error')); await pending.promise; await h.click('#copySchemaButton'); assert.equal(JSON.parse(h.writes.at(-1)).fields[0].name, 'value');
});
test('copy completion from a previous page does not announce success for the current page', async () => {
  const h = harness(), f = h.fixture(); await complete(await h.start(f, 1), 101); h.deferClipboard(); const copy = h.click('#copyCsvButton');
  const next = await h.start(f, 2); h.pendingClipboard[0].resolve(); await copy; assert.equal(h.get('#appToastMessage').textContent, ''); await complete(next, 202);
});
function binaryValue(api) {
  const bytes = Uint8Array.from({ length: 100 }, (_, i) => i), body = new Uint8Array(108); new DataView(body.buffer).setInt32(4, 100, true); body.set(bytes, 8);
  return api.decodeBatchColumns([{ name: 'payload', type: { id: 4, name: 'binary' }, children: [] }], { length: 1, nodes: [{ length: 1, nullCount: 0 }], buffers: [{ offset: 0, length: 0 }, { offset: 0, length: 8 }, { offset: 8, length: 100 }], compression: null }, body, new Map()).get('payload')[0];
}
function hex(bytes) { return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(' '); }
test('decoded binary exports every byte while the table preview remains compact', async () => {
  const h = harness(), f = h.fixture(); await complete(await h.start(f, 1), 101); const bytes = binaryValue(h.api); f.state.rows[0].value.value = bytes;
  assert.equal(bytes.length, 100); assert.match(h.api.cellText(bytes), /1e 1f … \(100 bytes\)$/); assert.equal(h.api.prettyValue(bytes), hex(bytes));
  await h.click('#copyCsvButton'); assert.equal(h.writes.at(-1), '__record,value\r\n1,' + hex(bytes)); h.click('#downloadCsvButton'); assert.equal(await h.downloads.find(x => x.blob).blob.text(), h.writes.at(-1));
  h.api.openCell(f.state.rows[0], 'value', bytes); assert.equal(h.get('#cellValue').textContent, hex(bytes)); await h.click('#copyCellButton'); assert.equal(h.writes.at(-1), hex(bytes));
});
test('nested binary and BigInt are complete in CSV, expanded records, inspector, and clipboard', async () => {
  const h = harness(), f = h.fixture(); await complete(await h.start(f, 1), 101); const bytes = binaryValue(h.api), value = { list: [{ bytes, large: 9007199254740993n }], map: new Map([['payload', bytes]]) }; f.state.rows[0].value.value = value;
  const expected = { list: [{ bytes: hex(bytes), large: '9007199254740993' }], map: { payload: hex(bytes) } };
  assert.deepEqual(JSON.parse(h.api.prettyValue(value)), expected); assert.match(h.api.cellText(value), /… \(100 bytes\)/);
  const csvField = JSON.stringify(expected); await h.click('#copyCsvButton'); assert.equal(h.writes.at(-1), '__record,value\r\n1,"' + csvField.replaceAll('"', '""') + '"');
  h.api.openCell(f.state.rows[0], 'value', value); await h.click('#copyCellButton'); assert.deepEqual(JSON.parse(h.writes.at(-1)), expected);
  f.state.viewMode = 'record'; h.api.renderData(f.state); const pre = h.get('#recordList').children[0].children[1]; assert.deepEqual(JSON.parse(pre.textContent).value, expected);
});
test('CSV retains quoting, visible-column order, sort, null, Unicode, and edited filenames per tab', async () => {
  const h = harness(), f = h.fixture('source.arrow'); await complete(await h.start(f, 1), 101);
  f.state.fields = [{ index: 0, name: 'text' }, { index: 1, name: 'hidden' }, { index: 2, name: 'number' }]; f.state.hiddenFields.add(1); f.state.sort = { field: f.state.fields[2], dir: 1 };
  f.state.rows = [{ recordNumber: 1, value: { text: '日本語, "quoted"\nnext', hidden: 'secret-column', number: 2n } }, { recordNumber: 2, value: { text: null, hidden: 'hidden', number: 1n } }];
  h.get('#outputFilename').value = 'Edited/name.csv'; h.get('#outputFilename').listeners.input({ target: h.get('#outputFilename') });
  await h.click('#copyCsvButton'); assert.equal(h.writes.at(-1), '__record,text,number\r\n2,null,1\r\n1,"日本語, ""quoted""\nnext",2'); h.click('#downloadCsvButton'); assert.equal(h.downloads.at(-1).name, 'Edited-name.csv');
  const b = h.fixture('second.arrow'); await complete(await h.start(b, 1), 333); h.api.activateFile(f.state.id); assert.equal(h.get('#outputFilename').value, 'Edited-name');
});
test('obsolete page completion cannot evict newer cached batches', async () => {
  const h = harness(), f = h.fixture('cache.arrow', [101, 202, 303]);
  const old = await h.start(f, 1); await complete(await h.start(f, 2), 202); await complete(await h.start(f, 3), 303);
  assert.deepEqual(Array.from(f.state.batchCacheOrder), [1, 2]); await complete(old, 101);
  assert.deepEqual(Array.from(f.state.batchCacheOrder), [1, 2]); assert.deepEqual(Array.from(f.state.batchCache.keys()), [1, 2]);
});
test('obsolete dictionary load cannot start another body read or commit dictionaries', async () => {
  const h = harness(), f = h.fixture(); const field = f.state.header.schema.fields[0]; field.dictionary = { id: '7', indexType: field.type }; const batch = f.state.header.batches[0].batch;
  f.state.header.dictionaries = [{ id: '7', bodyStart: 10, bodyLength: 4, batch }];
  const old = await h.start(f, 1), latest = await h.start(f, 2); assert.equal(f.reads.length, 2);
  old.read.resolve(intBody(101)); await tick(); assert.equal(f.state.dictionariesLoaded, false); assert.equal(f.state.dictionaries.size, 0); assert.equal(f.reads.length, 2); await old.promise;
  latest.read.resolve(intBody(202)); await tick(); assert.equal(f.reads.at(-1).start, 200); f.reads.at(-1).resolve(intBody(0)); await latest.promise;
  assert.equal(f.state.rows[0].value.value, 202);
});
// Header detection is stubbed only for lifecycle ordering; the parser is unchanged
// and complete IPC import is deliberately outside this source-only test claim.
for (const outcome of ['success', 'failure']) test(`header inspection does not hide newer page ${outcome} behind an obsolete initial read`, async () => {
  const h = harness(), f = h.fixture(), header = f.state.header; header.totalRows = 2; h.api.setHeaderDetector(async () => header);
  const initial = h.api.inspectFile(f.state); await tick(); const old = f.reads[0]; const latest = await h.start(f, 2);
  if (outcome === 'success') await complete(latest, 202); else { latest.read.reject(new Error('latest read failed')); await latest.promise; }
  assert.equal(f.state.inspection, 'ready'); assert.equal(h.get('#copySchemaButton').disabled, false);
  if (outcome === 'success') assert.equal(h.get('#statusBanner').textContent, 'Ready.'); else assert.match(h.get('#statusBanner').textContent, /latest read failed/);
  const status = h.get('#statusBanner').textContent; old.resolve(intBody(101)); await initial; assert.equal(h.get('#statusBanner').textContent, status);
});
test('closing during header inspection prevents a late header success from starting row reads', async () => {
  const h = harness(), f = h.fixture(), header = f.state.header, wait = deferred(); header.totalRows = 2; h.api.setHeaderDetector(() => wait.promise);
  const initial = h.api.inspectFile(f.state); h.api.closeFile(f.state.id); wait.resolve(header); await initial;
  assert.equal(f.state.header, null); assert.equal(f.reads.length, 0); assert.equal(f.state.rows.length, 0); assertDisabled(h, true);
});

function loadedValues(h, values, name = 'sort.arrow') {
  const f = h.fixture(name);
  f.state.rows = values.map((value, i) => ({ recordNumber: i + 1, value: { value } }));
  f.state.pageResult = { page: 1, pageSize: 1, generation: f.state.readGeneration };
  h.api.renderData(f.state);
  return f;
}
function tableHeaders(h) { return h.get('#dataTableWrap').children[0].children[0].children[0].children; }
function headerButton(h, index = 1) { return tableHeaders(h)[index].children[0]; }
function tableOrder(h) { return h.get('#dataTableWrap').children[0].children[1].children.map(row => Number(row.children[0].textContent)); }
function csvOrder(h, fs) { return h.api.buildCurrentCsv(fs).split('\r\n').slice(1).map(line => Number(line.split(',')[0])); }
function longBytes(last, length = 120) { const bytes = new Uint8Array(length); bytes[length - 1] = last; return bytes; }

for (const [label, wrap] of [
  ['binary', bytes => bytes],
  ['nested struct', bytes => ({ payload: bytes })],
  ['nested list/map', bytes => [{ payload: new Map([['bytes', bytes], ['large', 9007199254740993n]]) }]]
]) {
  for (const dir of [1, -1]) test(`${label} sorting uses complete values past compact preview limits (${dir})`, () => {
    const h = harness(), f = loadedValues(h, [wrap(longBytes(2)), wrap(longBytes(1)), wrap(longBytes(2)), null]);
    assert.equal(h.api.cellText(f.state.rows[0].value.value), h.api.cellText(f.state.rows[1].value.value));
    const source = f.state.rows.slice();
    f.state.sort = { field: f.state.fields[0], dir }; h.api.renderData(f.state);
    const expected = dir === 1 ? [2, 1, 3, 4] : [1, 3, 2, 4];
    assert.deepEqual(tableOrder(h), expected);
    assert.deepEqual(csvOrder(h, f.state), expected);
    h.click('#recordModeButton');
    assert.deepEqual(h.get('#recordList').children.map(card => Number(card.children[0].children[0].textContent.match(/\d+$/)[0])), expected);
    assert.deepEqual(f.state.rows, source, 'sorting never mutates the loaded source order');
    assert.equal(f.reads.length, 0, 'sorting never reads another batch');
  });
}
test('sorting prepares each complete comparison key once per sort', () => {
  const h = harness(); let serializations = 0, accesses = 0;
  const f = loadedValues(h, []);
  f.state.rows = Array.from({ length: 100 }, (_, i) => ({ recordNumber: i + 1, value: { get value() { accesses++; return { toJSON() { serializations++; return { payload: longBytes((i * 37) % 100) }; } }; } } }));
  f.state.sort = { field: f.state.fields[0], dir: 1 };
  const sorted = h.api.sortedRows(f.state);
  assert.equal(serializations, 100, 'serialization is outside the comparison callback');
  assert.equal(accesses, 100, 'each row field is read once');
  assert.equal(sorted[0].recordNumber, 1);
  assert.equal(f.reads.length, 0);
});
test('primitive sorting keeps numeric precision, null-last, stable ties, and source rows', () => {
  const h = harness();
  for (const [values, asc, desc] of [
    [[9007199254740993n, 9007199254740991, 9007199254740992n, null, undefined, 9007199254740993n], [2, 3, 1, 6, 4, 5], [1, 6, 3, 2, 4, 5]],
    [[10, -2, 0, 1.5, null], [2, 3, 4, 1, 5], [1, 4, 3, 2, 5]],
    [['b', 'a', 'b', null], [2, 1, 3, 4], [1, 3, 2, 4]],
    [[true, false, false, null], [2, 3, 1, 4], [1, 2, 3, 4]],
    [[new Date('2026-02-01Z'), new Date('2026-01-01Z'), null], [2, 1, 3], [1, 2, 3]]
  ]) {
    const f = loadedValues(h, values), original = f.state.rows.slice();
    for (const [dir, expected] of [[1, asc], [-1, desc]]) {
      f.state.sort = { field: f.state.fields[0], dir };
      assert.deepEqual(Array.from(h.api.sortedRows(f.state), row => row.recordNumber), expected);
      assert.deepEqual(f.state.rows, original);
    }
  }
});
test('native sortable headers expose direction, cycle three states, and restore keyboard focus', () => {
  const h = harness(), f = loadedValues(h, [2, 1, 2, null]);
  const header = tableHeaders(h)[1], button = headerButton(h);
  assert.equal(button?.tag, 'button'); assert.equal(button.type, 'button');
  assert.equal(header.attributes.scope, 'col');
  assert.equal(button.textContent, 'value');
  assert.match(button.attributes['aria-label'], /value.*ascending/i);
  assert.equal(button.listeners.keydown, undefined, 'native Enter/Space activation needs no duplicate handler');
  button.focus(); button.listeners.click();
  assert.deepEqual(tableOrder(h), [2, 1, 3, 4]); assert.equal(tableHeaders(h)[1].attributes['aria-sort'], 'ascending');
  assert.equal(h.get('#sortSummary').textContent, 'Current page: value · ascending');
  assert.equal(h.get('#clearSortButton').disabled, false);
  assert.equal(h.document.activeElement, headerButton(h));
  headerButton(h).listeners.click();
  assert.deepEqual(tableOrder(h), [1, 3, 2, 4]); assert.equal(tableHeaders(h)[1].attributes['aria-sort'], 'descending');
  assert.match(headerButton(h).attributes['aria-label'], /clear.*value/i);
  headerButton(h).listeners.click();
  assert.deepEqual(tableOrder(h), [1, 2, 3, 4]); assert.equal(f.state.sort, null);
  assert.equal(tableHeaders(h)[1].attributes['aria-sort'], undefined);
  assert.equal(h.get('#sortSummary').textContent, 'Current page: source order');
  assert.equal(h.get('#clearSortButton').disabled, true);
  assert.equal(f.reads.length, 0);
});
test('clear-sort remains available in Record view and with a hidden sorted field', () => {
  const h = harness(), f = loadedValues(h, [2, 1]);
  headerButton(h).listeners.click(); f.state.hiddenFields.add(0); h.api.renderData(f.state);
  assert.equal(tableHeaders(h).length, 1);
  assert.equal(h.get('#sortSummary').textContent, 'Current page: value · ascending (hidden column)');
  assert.equal(h.get('#clearSortButton').disabled, false);
  h.click('#recordModeButton');
  assert.equal(h.get('#clearSortButton').disabled, false);
  assert.deepEqual(csvOrder(h, f.state), [2, 1]);
  h.click('#clearSortButton');
  assert.equal(f.state.sort, null); assert.deepEqual(csvOrder(h, f.state), [1, 2]);
  assert.equal(h.get('#sortSummary').textContent, 'Current page: source order');
  assert.equal(f.reads.length, 0);
});
test('sort controls and next-action labels update between English and Japanese without changing sort', () => {
  const h = harness(), f = loadedValues(h, [2, 1]); headerButton(h).listeners.click();
  h.click('#languageButton');
  assert.equal(h.get('#sortSummary').textContent, '現在ページ: value · 昇順');
  assert.equal(h.get('#clearSortButton').textContent, '並べ替えを解除');
  assert.match(headerButton(h).attributes['aria-label'], /value.*降順/);
  assert.deepEqual(tableOrder(h), [2, 1]);
  f.state.hiddenFields.add(0); h.api.renderData(f.state);
  assert.match(h.get('#sortSummary').textContent, /非表示の列/);
  h.click('#clearSortButton'); assert.equal(h.get('#sortSummary').textContent, '現在ページ: 元の順序');
  h.click('#languageButton'); assert.equal(h.get('#clearSortButton').textContent, 'Clear sort');
  assert.equal(f.reads.length, 0);
});
test('sort status is per file and stale header callbacks cannot mutate another active tab', () => {
  const h = harness(), a = loadedValues(h, [2, 1], 'a.arrow');
  const oldButton = headerButton(h); oldButton.listeners.click();
  const b = loadedValues(h, [4, 3], 'b.arrow');
  assert.equal(h.get('#sortSummary').textContent, 'Current page: source order');
  oldButton.listeners.click(); assert.equal(a.state.sort.dir, 1); assert.equal(b.state.sort, null);
  h.api.activateFile(a.state.id); assert.equal(h.get('#sortSummary').textContent, 'Current page: value · ascending');
  h.api.closeFile(a.state.id); oldButton.listeners.click();
  assert.equal(h.get('#sortSummary').textContent, 'Current page: source order');
  h.api.closeFile(b.state.id); assert.equal(h.get('#clearSortButton').disabled, true);
  h.click('#clearSortButton'); assert.equal(h.api.state.files.length, 0);
});
test('sort controls are safe while loading or failed and page navigation still clears sort', async () => {
  const h = harness(), f = h.fixture(); await complete(await h.start(f, 1), 101);
  headerButton(h).listeners.click(); const old = headerButton(h);
  const next = h.click('#nextButton'); await tick();
  assert.equal(f.state.sort, null); assert.equal(h.get('#clearSortButton').disabled, true);
  old.listeners.click(); assert.equal(f.state.sort, null);
  f.reads.at(-1).reject(new Error('failed next page')); await next;
  assert.equal(h.get('#clearSortButton').disabled, true); old.listeners.click(); assert.equal(f.state.sort, null);
  await complete(await h.start(f, 2), 202); headerButton(h).listeners.click();
  h.click('#clearSortButton'); assert.equal(f.state.sort, null); assert.equal(f.state.page, 2);
  assert.equal(f.state.rows[0].recordNumber, 2);
});
test('sort toolbar exists outside either view and has a polite summary with a native clear button', () => {
  assert.match(html, /id="sortSummary"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /<button[^>]*id="clearSortButton"[^>]*type="button"[^>]*disabled/);
  assert.ok(html.indexOf('id="sortSummary"') < html.indexOf('id="dataTableWrap"'));
});

test('sort labels keep special column names as literal text in both languages', () => {
  const h = harness(), f = loadedValues(h, [2, 1]);
  const name = "<img onerror=alert(1)> {direction} {hidden} 日本語 $& $` $\'";
  f.state.fields[0].name = name;
  for (const row of f.state.rows) row.value[name] = row.value.value;
  h.api.renderData(f.state); headerButton(h).listeners.click();
  assert.equal(headerButton(h).textContent, name);
  assert.equal(headerButton(h).attributes['aria-label'], `Sort ${name} descending`);
  assert.equal(h.get('#sortSummary').textContent, `Current page: ${name} · ascending`);
  h.click('#languageButton');
  assert.equal(h.get('#sortSummary').textContent, `現在ページ: ${name} · 昇順`);
});
test('retained header from an earlier successful page cannot sort its replacement page', async () => {
  const h = harness(), f = h.fixture(); await complete(await h.start(f, 1), 101);
  const oldButton = headerButton(h);
  await complete(await h.start(f, 2), 202);
  oldButton.listeners.click(); assert.equal(f.state.sort, null);
  assert.equal(h.get('#sortSummary').textContent, 'Current page: source order');
  assert.equal(f.state.page, 2); assert.equal(f.state.rows[0].recordNumber, 2);
});
test('sort change to another column starts ascending and does not mutate page readiness or output names', () => {
  const h = harness(), f = loadedValues(h, [2, 1]);
  f.state.fields.push({ index: 1, name: 'second' });
  f.state.rows[0].value.second = 3; f.state.rows[1].value.second = 4;
  const page = f.state.pageResult; f.state.outputFilename = 'edited-export'; h.api.renderData(f.state);
  headerButton(h).listeners.click(); headerButton(h).listeners.click();
  headerButton(h, 2).listeners.click();
  assert.equal(f.state.sort.field.name, 'second'); assert.equal(f.state.sort.dir, 1);
  assert.equal(tableHeaders(h)[1].attributes['aria-sort'], undefined);
  assert.equal(tableHeaders(h)[2].attributes['aria-sort'], 'ascending');
  assert.equal(f.state.pageResult, page); assert.equal(f.state.outputFilename, 'edited-export');
  assert.deepEqual(tableOrder(h), [1, 2]);
});
test('empty success and unloaded/error states keep sort controls neutral and disabled', async () => {
  const h = harness(); assert.equal(h.get('#clearSortButton').disabled, true);
  assert.equal(h.get('#sortSummary').textContent, 'Current page: not loaded');
  const empty = h.fixture('empty.arrow', []); await h.api.readPage(empty.state);
  assert.equal(h.get('#clearSortButton').disabled, true);
  assert.equal(h.get('#sortSummary').textContent, 'Current page: source order');
  h.click('#recordModeButton'); h.click('#clearSortButton'); assert.equal(empty.state.sort, null);
  const unloaded = h.mount(h.api.buildFileState({ name: 'unloaded.arrow' }));
  assert.equal(h.get('#clearSortButton').disabled, true);
  assert.equal(h.get('#sortSummary').textContent, 'Current page: not loaded');
  unloaded.error = 'bad header'; unloaded.inspection = 'error'; h.api.renderActive();
  h.click('#clearSortButton'); assert.equal(unloaded.sort, null);
});
test('page-size callback clears sorting and keeps retained headers inert through the replacement read', async () => {
  const h = harness(), f = h.fixture(); await complete(await h.start(f, 1), 101);
  headerButton(h).listeners.click(); const old = headerButton(h);
  const resized = h.get('#pageSizeSelect').listeners.change({ target: { value: '2' } }); await tick();
  assert.equal(f.state.sort, null); assert.equal(f.state.page, 1); assert.equal(f.state.pageSize, 2);
  old.listeners.click(); assert.equal(f.state.sort, null); assert.equal(h.get('#clearSortButton').disabled, true);
  // The first batch is cached; only the second body needs a new read.
  f.reads.at(-1).resolve(intBody(202)); await resized;
  old.listeners.click(); assert.equal(f.state.sort, null);
  assert.equal(h.get('#sortSummary').textContent, 'Current page: source order');
  assert.deepEqual(tableOrder(h), [1, 2]); assert.equal(f.reads.length, 2);
});
