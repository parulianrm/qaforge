const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const input =
  process.argv[2] ||
  path.join(process.cwd(), 'development-center-be.with-payload.postman_collection.json');
const output =
  process.argv[3] ||
  path.join(process.cwd(), 'Assessment Center - API Test Case Report.xlsx');

const collection = JSON.parse(fs.readFileSync(input, 'utf8'));

function collectRequests(items, folders = [], rows = []) {
  for (const item of items || []) {
    if (item.request) {
      rows.push({ item, folders: [...folders] });
    }
    if (item.item) {
      collectRequests(item.item, [...folders, item.name].filter(Boolean), rows);
    }
  }
  return rows;
}

function rawUrl(request) {
  const url = request.url;
  if (!url) return '';
  if (typeof url === 'string') return url;
  return url.raw || [url.host, ...(url.path || [])].flat().filter(Boolean).join('/');
}

function normalizeEndpoint(url) {
  return String(url || '').replace('{{baseUrl}}', '').replace(/^https?:\/\/[^/]+/, '');
}

function inferExpectedResult(name, method) {
  const lower = String(name || '').toLowerCase();
  if (lower.includes('missing basic auth')) {
    return 'API menolak request tanpa Basic Auth dan mengembalikan response unauthorized/forbidden.';
  }
  if (lower.includes('invalid path parameter')) {
    return 'API menolak path parameter tidak valid dan mengembalikan error validasi atau not found.';
  }
  if (lower.includes('invalid query')) {
    return 'API menolak query parameter tidak valid dan mengembalikan error validasi.';
  }
  if (lower.includes('invalid body')) {
    return 'API menolak payload tidak valid dan mengembalikan detail error validasi.';
  }
  if (lower.includes('not found')) {
    return 'API mengembalikan response not found untuk data yang tidak tersedia.';
  }
  if (lower.includes('delete') || method === 'DELETE') {
    return 'API berhasil menghapus data atau mengembalikan response sukses sesuai kontrak endpoint.';
  }
  if (method === 'POST') return 'API berhasil membuat data baru dan mengembalikan response sukses beserta data/result.';
  if (method === 'PUT' || method === 'PATCH') return 'API berhasil memperbarui data dan mengembalikan response sukses beserta data/result.';
  if (method === 'GET') return 'API berhasil mengembalikan data sesuai parameter request.';
  return 'API mengembalikan response sesuai kontrak endpoint.';
}

function titleCase(value) {
  return String(value || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_{}?=&/:]+/g, ' ')
    .replace(/\b(api|v1|v2|id|ids|get|post|put|patch|delete)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function inferFeatureName(endpoint, folders) {
  const folderName = [...folders].reverse().find((folder) => !/positive|negative/i.test(folder));
  if (folderName && !/^development center/i.test(folderName)) return titleCase(folderName);

  const cleanPath = String(endpoint || '').split('?')[0];
  const segments = cleanPath
    .split('/')
    .filter(Boolean)
    .filter((segment) => !/^v\d+$/i.test(segment))
    .filter((segment) => !/^api$/i.test(segment))
    .filter((segment) => !/^\{\{.*\}\}$/.test(segment))
    .filter((segment) => !/^[0-9a-f-]{8,}$/i.test(segment))
    .filter((segment) => !/^not-a-valid-id$/i.test(segment));
  return titleCase(segments.slice(-3).join(' ')) || 'API';
}

function inferAction(method) {
  if (method === 'GET') return 'menampilkan data';
  if (method === 'POST') return 'membuat data';
  if (method === 'PUT' || method === 'PATCH') return 'memperbarui data';
  if (method === 'DELETE') return 'menghapus data';
  return 'memproses request';
}

function inferSummary(name, endpoint, method, folders) {
  const feature = inferFeatureName(endpoint, folders);
  const lower = String(name || '').toLowerCase();
  const prefix = lower.startsWith('negative') ? '[NEGATIVE]' : lower.startsWith('positive') ? '[POSITIVE]' : '[API]';

  if (lower.includes('missing basic auth')) {
    return `${prefix} Memastikan akses ${feature} ditolak tanpa Basic Auth`;
  }
  if (lower.includes('invalid path parameter')) {
    return `${prefix} Memastikan validasi path parameter ${feature} berjalan dengan benar`;
  }
  if (lower.includes('invalid query')) {
    return `${prefix} Memastikan validasi query parameter ${feature} berjalan dengan benar`;
  }
  if (lower.includes('invalid body')) {
    return `${prefix} Memastikan validasi payload ${feature} berjalan dengan benar`;
  }
  if (lower.includes('not found')) {
    return `${prefix} Memastikan data ${feature} yang tidak ditemukan ditangani dengan benar`;
  }
  return `${prefix} Memastikan API dapat ${inferAction(method)} ${feature} dengan request valid`;
}

function inferDescription(name, endpoint, method, folders) {
  const module = folders.join(' > ') || 'API';
  const lower = String(name || '').toLowerCase();
  if (lower.includes('missing basic auth')) {
    return `Memastikan endpoint ${method} ${endpoint} pada modul ${module} tidak dapat diakses tanpa Basic Auth.`;
  }
  if (lower.includes('invalid path parameter')) {
    return `Memastikan endpoint ${method} ${endpoint} pada modul ${module} memvalidasi path parameter yang tidak sesuai.`;
  }
  if (lower.includes('invalid query')) {
    return `Memastikan endpoint ${method} ${endpoint} pada modul ${module} memvalidasi query parameter yang tidak sesuai.`;
  }
  if (lower.includes('invalid body')) {
    return `Memastikan endpoint ${method} ${endpoint} pada modul ${module} memvalidasi body payload yang tidak sesuai.`;
  }
  return `Memastikan endpoint ${method} ${endpoint} pada modul ${module} berjalan dengan payload dan parameter valid.`;
}

function inferScenario(name, endpoint, method, hasBody) {
  const steps = [
    `Given user memiliki akses API dan konfigurasi environment yang sesuai`,
    `When user mengirim request ${method} ke endpoint ${endpoint}`,
  ];
  if (hasBody) steps.push('And user menyertakan payload request sesuai skenario test');
  if (/missing basic auth/i.test(name)) steps.push('And user tidak menyertakan Basic Auth');
  if (/invalid path parameter/i.test(name)) steps.push('And user menggunakan path parameter tidak valid');
  if (/invalid query/i.test(name)) steps.push('And user menggunakan query parameter tidak valid');
  if (/invalid body/i.test(name)) steps.push('And user menggunakan body payload tidak valid');
  steps.push('Then API mengembalikan response sesuai expected result');
  return steps.join('\n');
}

function styleCell(ws, addr, style) {
  if (!ws[addr]) ws[addr] = { t: 's', v: '' };
  ws[addr].s = { ...(ws[addr].s || {}), ...style };
}

function rangeStyle(ws, range, style) {
  const decoded = XLSX.utils.decode_range(range);
  for (let r = decoded.s.r; r <= decoded.e.r; r++) {
    for (let c = decoded.s.c; c <= decoded.e.c; c++) {
      styleCell(ws, XLSX.utils.encode_cell({ r, c }), style);
    }
  }
}

const requests = collectRequests(collection.item);
const dataRows = requests.map(({ item, folders }, index) => {
  const method = item.request.method || '';
  const endpoint = normalizeEndpoint(rawUrl(item.request));
  const hasBody = Boolean(item.request.body);
  return [
    `AC-${String(index + 1).padStart(3, '0')}`,
    inferSummary(item.name, endpoint, method, folders),
    inferDescription(item.name, endpoint, method, folders),
    endpoint,
    'API',
    inferScenario(item.name, endpoint, method, hasBody),
    inferExpectedResult(item.name, method),
    '',
    'Not Tested',
  ];
});

const rows = [
  [],
  ['Modul Name', 'Development Center BE API', '', '', 'Open', '', '0', 'Failed', '0'],
  ['Testing Start Date', '26 June 2026', '', '', 'In Progress', '', '0', 'Blocking', '0'],
  ['Testing End Date', '', '', '', 'Passed', '', '0', 'Not Tested', dataRows.length],
  ['Defect Logging & Drive Evidence', '', '', '', 'Total Test Case', '', dataRows.length, 'Testing Coverage', '0%'],
  ['Name of Tester/s', 'Parulian R Manik', '', '', 'Testing Progress', '', '0%', '', ''],
  [],
  ['Test ID', 'Summary', 'Description', 'End Point', 'Test Type', 'Cucumber Scenario', 'Expected Result', 'Existing Result', 'Status'],
  ...dataRows,
];

const ws = XLSX.utils.aoa_to_sheet(rows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'API Test Cases');

ws['!cols'] = [
  { wch: 12 },
  { wch: 42 },
  { wch: 52 },
  { wch: 56 },
  { wch: 16 },
  { wch: 62 },
  { wch: 48 },
  { wch: 28 },
  { wch: 18 },
];
ws['!rows'] = rows.map((_, i) => ({ hpt: i >= 8 ? 58 : 20 }));
ws['!freeze'] = { xSplit: 0, ySplit: 8 };
ws['!autofilter'] = { ref: `A8:I${rows.length}` };
ws['!merges'] = [
  { s: { r: 1, c: 1 }, e: { r: 1, c: 3 } },
  { s: { r: 2, c: 1 }, e: { r: 2, c: 3 } },
  { s: { r: 3, c: 1 }, e: { r: 3, c: 3 } },
  { s: { r: 4, c: 1 }, e: { r: 4, c: 3 } },
  { s: { r: 5, c: 1 }, e: { r: 5, c: 3 } },
  { s: { r: 1, c: 4 }, e: { r: 1, c: 5 } },
  { s: { r: 2, c: 4 }, e: { r: 2, c: 5 } },
  { s: { r: 3, c: 4 }, e: { r: 3, c: 5 } },
  { s: { r: 4, c: 4 }, e: { r: 4, c: 5 } },
  { s: { r: 5, c: 4 }, e: { r: 5, c: 5 } },
];

const border = {
  top: { style: 'thin', color: { rgb: '000000' } },
  bottom: { style: 'thin', color: { rgb: '000000' } },
  left: { style: 'thin', color: { rgb: '000000' } },
  right: { style: 'thin', color: { rgb: '000000' } },
};
const headerFill = { fgColor: { rgb: '2F6B1B' } };
const lightGreen = { fgColor: { rgb: '93C47D' } };
const grayFill = { fgColor: { rgb: 'EDEDED' } };
const baseStyle = {
  border,
  alignment: { vertical: 'center', wrapText: true },
  font: { name: 'Arial', sz: 10 },
};

rangeStyle(ws, `A2:I6`, { ...baseStyle, font: { name: 'Arial', sz: 10, bold: true } });
rangeStyle(ws, `A8:I${rows.length}`, baseStyle);
rangeStyle(ws, 'A8:I8', {
  ...baseStyle,
  fill: headerFill,
  font: { name: 'Arial', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
});
rangeStyle(ws, 'E5:I6', {
  ...baseStyle,
  fill: lightGreen,
  font: { name: 'Arial', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
});
rangeStyle(ws, 'A2:I4', { ...baseStyle, fill: grayFill, font: { name: 'Arial', sz: 10, bold: true } });

for (let r = 8; r < rows.length; r++) {
  styleCell(ws, XLSX.utils.encode_cell({ r, c: 0 }), {
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  });
  styleCell(ws, XLSX.utils.encode_cell({ r, c: 4 }), {
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  });
  styleCell(ws, XLSX.utils.encode_cell({ r, c: 8 }), {
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  });
}

XLSX.writeFile(wb, output, { bookType: 'xlsx', cellStyles: true });
console.log(JSON.stringify({ output, testCases: dataRows.length }, null, 2));
