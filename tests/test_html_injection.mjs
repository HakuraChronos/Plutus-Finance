import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { escapeHtml } from '../app/js/utils/security.js';

const attributeBreakout = '"><img src=x onerror="globalThis.compromised=true">';
const styleInjection = '<style>body{display:none}</style>';

assert.equal(
  escapeHtml(attributeBreakout),
  '&quot;&gt;&lt;img src=x onerror=&quot;globalThis.compromised=true&quot;&gt;',
  'quotes and angle brackets must be encoded before entering a quoted HTML attribute'
);
assert.equal(
  escapeHtml(styleInjection),
  '&lt;style&gt;body{display:none}&lt;/style&gt;',
  'HTML-like search text must remain text rather than create a style element'
);

const renderedSearchAttribute = `value="${escapeHtml(attributeBreakout)}"`;
assert.doesNotMatch(renderedSearchAttribute, /value=""><img/i);
assert.match(renderedSearchAttribute, /&quot;&gt;&lt;img/);

const transactionSource = await readFile(new URL('../app/js/views/transactionsView.js', import.meta.url), 'utf8');
assert.match(
  transactionSource,
  /value="\$\{escapeHtml\(searchQuery\)\}"/,
  'the transaction search value must use contextual HTML escaping'
);
assert.doesNotMatch(
  transactionSource,
  /value="\$\{searchQuery\}"/,
  'raw search text must never be interpolated into the HTML attribute'
);
assert.match(
  transactionSource,
  /class="trans-amount \$\{escapeHtml\(t\.type\)\} privacy-sensitive"/,
  'restored transaction types must not be interpolated raw into a class attribute'
);

console.log('Transaction HTML injection prevention: PASS');
