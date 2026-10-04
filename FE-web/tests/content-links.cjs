const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

for (const file of ['../src/utils/contentLinks.ts', '../../FE-app/src/services/contentLinks.js']) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, URL });
  test(`${file}: plain source URLs are actionable and preserve query parameters`, () => {
    const parts = exports.contentParts('Nội dung\nNguồn bài viết: https://example.com/news?q=lu&lang=vi.');
    const links = parts.filter(part => part.url);
    assert.equal(links.length, 1);
    assert.equal(links[0].url, 'https://example.com/news?q=lu&lang=vi');
    assert.equal(parts.map(part => part.text).join(''), 'Nội dung\nNguồn bài viết: https://example.com/news?q=lu&lang=vi.');
  });
  test(`${file}: legacy anchors retain their link without rendering HTML`, () => {
    const parts = exports.contentParts('<a href="https://example.com/?a=1&amp;b=2"><b>Bài gốc</b></a>');
    assert.equal(parts.find(part => part.url).url, 'https://example.com/?a=1&b=2');
    assert.equal(parts.some(part => part.text.includes('<')), false);
    assert.equal(exports.contentParts('<a href="javascript:alert(1)">Không mở</a>').some(part => part.url), false);
  });
}
