export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows.filter(values => values.some(value => value.trim() !== ''));
}

export function csvRecords(text) {
  const rows = parseCsv(String(text).replace(/^\uFEFF/, ''));
  if (rows.length < 2) throw new Error('CSV must contain a header and at least one transaction.');
  const headers = rows[0].map(header => header.trim().toLowerCase());
  const required = ['date', 'type', 'amount', 'account'];
  if (!required.every(header => headers.includes(header))) throw new Error('CSV requires Date, Type, Amount, and Account columns.');
  return rows.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() || ''])));
}
