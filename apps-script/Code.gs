const CONFIG = {
  SPREADSHEET_ID: '1-H1lwHr_J8_ITwiI0JDOj9tb-uFSdItetkXj1d5P67U',
  TIMEZONE: 'Asia/Tbilisi',
  VERSION: '1.0.0'
};

const SHEET_NAMES = {
  PRODUCTS: 'Products',
  STOCK_IN: 'StockIn',
  SALES: 'Sales',
  ADJUSTMENTS: 'Adjustments',
  ROOM_CHARGES: 'RoomCharges',
  DAILY_CLOSING: 'DailyClosing',
  SETTINGS: 'Settings'
};

const HEADERS = {
  Products: ['კოდი', 'დასახელება', 'ნაშთი', 'საშ. თვითღირებულება', 'გასაყიდი ფასი', 'სტატუსი', 'შექმნის თარიღი', 'განახლების თარიღი'],
  StockIn: ['თარიღი', 'დრო', 'კოდი', 'დასახელება', 'რაოდენობა', 'თვითღირებულება', 'ჯამი', 'წყარო'],
  Sales: ['გაყიდვის ID', 'თარიღი', 'დრო', 'კოდი', 'დასახელება', 'რაოდენობა', 'გასაყიდი ფასი', 'ჯამი', 'გადახდის ტიპი', 'ოთახი', 'მოლარე', 'სტატუსი'],
  Adjustments: ['თარიღი', 'დრო', 'კოდი', 'დასახელება', 'ძველი ნაშთი', 'ახალი ნაშთი', 'სხვაობა', 'კომენტარი', 'ოპერატორი'],
  RoomCharges: ['გაყიდვის ID', 'თარიღი', 'დრო', 'ოთახი', 'კოდი', 'დასახელება', 'რაოდენობა', 'თანხა', 'სტატუსი', 'მოლარე'],
  DailyClosing: ['დახურვის ID', 'თარიღი', 'დახურვის დრო', 'სულ გაყიდვა', 'ტერმინალი', 'ოთახზე დაწერა', 'ნაღდი', 'გაყიდული რაოდენობა', 'მოლარე', 'კომენტარი'],
  Settings: ['Key', 'Value']
};

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const callback = params.callback || '';

  try {
    const action = params.action || 'ping';
    const payload = parsePayload_(params.payload);
    const result = route_(action, payload);
    return output_(result, callback);
  } catch (err) {
    return output_({ ok: false, error: String(err && err.message ? err.message : err) }, callback);
  }
}

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const result = route_(body.action || 'ping', body.payload || {});
    return output_(result, '');
  } catch (err) {
    return output_({ ok: false, error: String(err && err.message ? err.message : err) }, '');
  }
}

function route_(action, payload) {
  switch (action) {
    case 'ping': return ok_({ version: CONFIG.VERSION, message: 'HotelMarket API works' });
    case 'setupDatabase': return setupDatabase();
    case 'getProducts': return getProducts(payload);
    case 'getProduct': return getProduct(payload);
    case 'addOrUpdateProduct': return addOrUpdateProduct(payload);
    case 'importRows': return importRows(payload);
    case 'processSale': return processSale(payload);
    case 'getDailyReport': return getDailyReport(payload);
    case 'closeDay': return closeDay(payload);
    case 'adjustStock': return adjustStock(payload);
    case 'resetTestData': return resetTestData(payload);
    default: throw new Error('Unknown action: ' + action);
  }
}

function output_(data, callback) {
  const text = callback && /^[A-Za-z0-9_\.]+$/.test(callback)
    ? callback + '(' + JSON.stringify(data) + ');'
    : JSON.stringify(data);
  const mime = callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON;
  return ContentService.createTextOutput(text).setMimeType(mime);
}

function parsePayload_(payload) {
  if (!payload) return {};
  if (typeof payload === 'object') return payload;
  return JSON.parse(payload);
}

function ok_(data) {
  const base = { ok: true };
  return Object.assign(base, data || {});
}

function ss_() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function sheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Sheet not found: ' + name + '. Run setupDatabase first.');
  return sh;
}

function today_() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
}

function nowTime_() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'HH:mm:ss');
}

function stamp_() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
}

function num_(value) {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(String(value).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

function text_(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}

function round2_(n) {
  return Math.round((num_(n) + Number.EPSILON) * 100) / 100;
}

function setupDatabase() {
  const ss = ss_();
  Object.keys(HEADERS).forEach(function (name) {
    ensureSheet_(ss, name, HEADERS[name]);
  });

  const settings = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (settings.getLastRow() < 2) {
    settings.appendRow(['version', CONFIG.VERSION]);
    settings.appendRow(['timezone', CONFIG.TIMEZONE]);
    settings.appendRow(['createdAt', stamp_()]);
  }

  return ok_({ message: 'Database is ready', sheets: Object.keys(HEADERS) });
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#eef2ff');
  for (let i = 1; i <= headers.length; i++) sh.autoResizeColumn(i);
}

function dataRows_(sh) {
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
}

function findProduct_(code) {
  code = text_(code);
  const sh = sheet_(SHEET_NAMES.PRODUCTS);
  const rows = dataRows_(sh);
  for (let i = 0; i < rows.length; i++) {
    if (text_(rows[i][0]) === code) return { sheet: sh, row: i + 2, values: rows[i] };
  }
  return null;
}

function productObj_(row) {
  return {
    code: text_(row[0]),
    name: text_(row[1]),
    stock: num_(row[2]),
    avgCost: num_(row[3]),
    salePrice: num_(row[4]),
    status: text_(row[5]) || 'აქტიური',
    createdAt: text_(row[6]),
    updatedAt: text_(row[7])
  };
}

function getProducts(payload) {
  payload = payload || {};
  const rows = dataRows_(sheet_(SHEET_NAMES.PRODUCTS));
  let products = rows.filter(function (r) { return text_(r[0]); }).map(productObj_);
  if (payload.activeOnly !== false) {
    products = products.filter(function (p) { return p.status !== 'არააქტიური'; });
  }
  return ok_({ products: products });
}

function getProduct(payload) {
  const code = text_(payload && payload.code);
  if (!code) throw new Error('კოდი აუცილებელია');
  const found = findProduct_(code);
  if (!found) return ok_({ found: false });
  return ok_({ found: true, product: productObj_(found.values) });
}

function addOrUpdateProduct(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    setupDatabase();
    const product = upsertProduct_(payload || {}, 'manual');
    return ok_({ product: product });
  } finally {
    lock.releaseLock();
  }
}

function importRows(payload) {
  const rows = payload && payload.rows ? payload.rows : [];
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('ასატვირთი მონაცემი ცარიელია');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    setupDatabase();
    const imported = [];
    rows.forEach(function (row) {
      if (text_(row.code || row['კოდი'])) imported.push(upsertProduct_(row, 'import'));
    });
    return ok_({ importedCount: imported.length, products: imported });
  } finally {
    lock.releaseLock();
  }
}

function upsertProduct_(payload, source) {
  const code = text_(payload.code || payload['კოდი']);
  const name = text_(payload.name || payload['დასახელება']);
  const qty = Math.max(0, num_(payload.qty || payload.quantity || payload['რაოდენობა']));
  const cost = Math.max(0, num_(payload.cost || payload.costPrice || payload['თვითღირებულება'] || payload['მისი ფასი']));
  const salePriceInput = num_(payload.salePrice || payload.price || payload['გასაყიდი ფასი']);

  if (!code) throw new Error('პროდუქტის კოდი აუცილებელია');

  const productsSheet = sheet_(SHEET_NAMES.PRODUCTS);
  const stockInSheet = sheet_(SHEET_NAMES.STOCK_IN);
  const found = findProduct_(code);
  const now = stamp_();
  let product;

  if (found) {
    const old = productObj_(found.values);
    const newQty = old.stock + qty;
    let newAvg = old.avgCost;
    if (qty > 0) {
      newAvg = newQty > 0 ? ((old.stock * old.avgCost) + (qty * cost)) / newQty : cost;
    }
    const newName = name || old.name;
    const newSalePrice = salePriceInput > 0 ? salePriceInput : old.salePrice;
    product = {
      code: code,
      name: newName,
      stock: round2_(newQty),
      avgCost: round2_(newAvg),
      salePrice: round2_(newSalePrice),
      status: 'აქტიური',
      createdAt: old.createdAt || now,
      updatedAt: now
    };
    productsSheet.getRange(found.row, 1, 1, 8).setValues([[
      product.code, product.name, product.stock, product.avgCost, product.salePrice,
      product.status, product.createdAt, product.updatedAt
    ]]);
  } else {
    if (!name) throw new Error('ახალ პროდუქტს დასახელება სჭირდება');
    product = {
      code: code,
      name: name,
      stock: round2_(qty),
      avgCost: round2_(cost),
      salePrice: round2_(salePriceInput),
      status: 'აქტიური',
      createdAt: now,
      updatedAt: now
    };
    productsSheet.appendRow([product.code, product.name, product.stock, product.avgCost, product.salePrice, product.status, product.createdAt, product.updatedAt]);
  }

  if (qty > 0) {
    stockInSheet.appendRow([today_(), nowTime_(), code, product.name, qty, round2_(cost), round2_(qty * cost), source || 'manual']);
  }

  return product;
}

function processSale(payload) {
  payload = payload || {};
  const items = payload.items || [];
  const paymentType = text_(payload.paymentType || 'ტერმინალი');
  const room = text_(payload.room || '');
  const cashier = text_(payload.cashier || '');

  if (!Array.isArray(items) || items.length === 0) throw new Error('კალათა ცარიელია');
  if (paymentType === 'ოთახზე დაწერა' && !room) throw new Error('ოთახის ნომერი აუცილებელია');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    setupDatabase();
    const merged = {};
    items.forEach(function (item) {
      const code = text_(item.code);
      const qty = Math.max(0, num_(item.qty || item.quantity));
      if (!code || qty <= 0) return;
      if (!merged[code]) merged[code] = { code: code, qty: 0, price: num_(item.price || item.salePrice) };
      merged[code].qty += qty;
      if (num_(item.price || item.salePrice) > 0) merged[code].price = num_(item.price || item.salePrice);
    });

    const saleItems = Object.keys(merged).map(function (code) { return merged[code]; });
    if (saleItems.length === 0) throw new Error('კალათაში სწორი პროდუქტი არ არის');

    const checked = saleItems.map(function (item) {
      const found = findProduct_(item.code);
      if (!found) throw new Error('პროდუქტი ვერ მოიძებნა: ' + item.code);
      const product = productObj_(found.values);
      if (product.status === 'არააქტიური') throw new Error('პროდუქტი არააქტიურია: ' + product.name);
      if (product.stock < item.qty) throw new Error('არასაკმარისი ნაშთი: ' + product.name + ' / ნაშთი: ' + product.stock);
      const price = item.price > 0 ? item.price : product.salePrice;
      if (price <= 0) throw new Error('გასაყიდი ფასი არასწორია: ' + product.name);
      return { row: found.row, product: product, qty: item.qty, price: price };
    });

    const saleId = Utilities.getUuid();
    const date = today_();
    const time = nowTime_();
    let total = 0;
    let itemsCount = 0;
    const salesSheet = sheet_(SHEET_NAMES.SALES);
    const roomSheet = sheet_(SHEET_NAMES.ROOM_CHARGES);

    checked.forEach(function (item) {
      const lineTotal = round2_(item.qty * item.price);
      total += lineTotal;
      itemsCount += item.qty;
      salesSheet.appendRow([saleId, date, time, item.product.code, item.product.name, item.qty, round2_(item.price), lineTotal, paymentType, room, cashier, 'აქტიური']);
      sheet_(SHEET_NAMES.PRODUCTS).getRange(item.row, 3).setValue(round2_(item.product.stock - item.qty));
      sheet_(SHEET_NAMES.PRODUCTS).getRange(item.row, 8).setValue(stamp_());
      if (paymentType === 'ოთახზე დაწერა') {
        roomSheet.appendRow([saleId, date, time, room, item.product.code, item.product.name, item.qty, lineTotal, 'გადასახდელი', cashier]);
      }
    });

    return ok_({ saleId: saleId, total: round2_(total), itemsCount: itemsCount });
  } finally {
    lock.releaseLock();
  }
}

function getDailyReport(payload) {
  payload = payload || {};
  const date = text_(payload.date) || today_();
  const rows = dataRows_(sheet_(SHEET_NAMES.SALES));
  const byPayment = { 'ტერმინალი': 0, 'ოთახზე დაწერა': 0, 'ნაღდი': 0 };
  const byProduct = {};
  const byRoom = {};
  let total = 0;
  let itemsCount = 0;
  let salesRows = 0;

  rows.forEach(function (r) {
    if (text_(r[1]) !== date || text_(r[11]) !== 'აქტიური') return;
    const code = text_(r[3]);
    const name = text_(r[4]);
    const qty = num_(r[5]);
    const lineTotal = num_(r[7]);
    const payment = text_(r[8]);
    const room = text_(r[9]);
    total += lineTotal;
    itemsCount += qty;
    salesRows++;
    if (!byPayment[payment]) byPayment[payment] = 0;
    byPayment[payment] += lineTotal;
    if (!byProduct[code]) byProduct[code] = { code: code, name: name, qty: 0, total: 0 };
    byProduct[code].qty += qty;
    byProduct[code].total += lineTotal;
    if (payment === 'ოთახზე დაწერა' && room) {
      if (!byRoom[room]) byRoom[room] = { room: room, total: 0 };
      byRoom[room].total += lineTotal;
    }
  });

  const products = Object.keys(byProduct).map(function (k) {
    byProduct[k].qty = round2_(byProduct[k].qty);
    byProduct[k].total = round2_(byProduct[k].total);
    return byProduct[k];
  });
  const rooms = Object.keys(byRoom).map(function (k) {
    byRoom[k].total = round2_(byRoom[k].total);
    return byRoom[k];
  });

  Object.keys(byPayment).forEach(function (k) { byPayment[k] = round2_(byPayment[k]); });

  return ok_({
    date: date,
    total: round2_(total),
    itemsCount: round2_(itemsCount),
    salesRows: salesRows,
    byPayment: byPayment,
    products: products,
    rooms: rooms
  });
}

function closeDay(payload) {
  payload = payload || {};
  const report = getDailyReport({ date: payload.date || today_() });
  const closeId = Utilities.getUuid();
  sheet_(SHEET_NAMES.DAILY_CLOSING).appendRow([
    closeId,
    report.date,
    nowTime_(),
    report.total,
    report.byPayment['ტერმინალი'] || 0,
    report.byPayment['ოთახზე დაწერა'] || 0,
    report.byPayment['ნაღდი'] || 0,
    report.itemsCount,
    text_(payload.cashier || ''),
    text_(payload.comment || '')
  ]);
  return ok_({ closeId: closeId, report: report });
}

function adjustStock(payload) {
  payload = payload || {};
  const code = text_(payload.code);
  const newQty = Math.max(0, num_(payload.newQty));
  const comment = text_(payload.comment || '');
  const operator = text_(payload.operator || '');
  if (!code) throw new Error('კოდი აუცილებელია');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const found = findProduct_(code);
    if (!found) throw new Error('პროდუქტი ვერ მოიძებნა');
    const product = productObj_(found.values);
    const diff = round2_(newQty - product.stock);
    found.sheet.getRange(found.row, 3).setValue(round2_(newQty));
    found.sheet.getRange(found.row, 8).setValue(stamp_());
    sheet_(SHEET_NAMES.ADJUSTMENTS).appendRow([today_(), nowTime_(), code, product.name, product.stock, round2_(newQty), diff, comment, operator]);
    return ok_({ code: code, oldQty: product.stock, newQty: round2_(newQty), diff: diff });
  } finally {
    lock.releaseLock();
  }
}

function resetTestData(payload) {
  payload = payload || {};
  if (text_(payload.confirmText) !== 'RESET') throw new Error('დადასტურებისთვის ჩაწერე RESET');
  const mode = text_(payload.mode || 'salesOnly');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    setupDatabase();
    if (mode === 'all') {
      clearBody_(sheet_(SHEET_NAMES.PRODUCTS));
      clearBody_(sheet_(SHEET_NAMES.STOCK_IN));
      clearBody_(sheet_(SHEET_NAMES.SALES));
      clearBody_(sheet_(SHEET_NAMES.ADJUSTMENTS));
      clearBody_(sheet_(SHEET_NAMES.ROOM_CHARGES));
      clearBody_(sheet_(SHEET_NAMES.DAILY_CLOSING));
    } else if (mode === 'salesAndStock') {
      clearBody_(sheet_(SHEET_NAMES.STOCK_IN));
      clearBody_(sheet_(SHEET_NAMES.SALES));
      clearBody_(sheet_(SHEET_NAMES.ADJUSTMENTS));
      clearBody_(sheet_(SHEET_NAMES.ROOM_CHARGES));
      clearBody_(sheet_(SHEET_NAMES.DAILY_CLOSING));
      zeroProducts_();
    } else {
      clearBody_(sheet_(SHEET_NAMES.SALES));
      clearBody_(sheet_(SHEET_NAMES.ROOM_CHARGES));
      clearBody_(sheet_(SHEET_NAMES.DAILY_CLOSING));
    }
    return ok_({ mode: mode, message: 'Test data reset completed' });
  } finally {
    lock.releaseLock();
  }
}

function clearBody_(sh) {
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, sh.getLastColumn()).clearContent();
}

function zeroProducts_() {
  const sh = sheet_(SHEET_NAMES.PRODUCTS);
  const last = sh.getLastRow();
  if (last < 2) return;
  sh.getRange(2, 3, last - 1, 2).setValues(Array(last - 1).fill([0, 0]));
  sh.getRange(2, 8, last - 1, 1).setValues(Array(last - 1).fill([stamp_()]));
}
