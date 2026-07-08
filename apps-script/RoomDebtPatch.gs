// HotelMarket v1.2 patch
// ჩასვი Apps Script-ში Code.gs-ის ბოლოში ან შექმენი/განაახლე ფაილი RoomDebtPatch.gs.

const HM_ROOMS = [
  '101', '102', '103', '104',
  '201', '202', '203', '204',
  '301', '302', '303', '304',
  '401', '402', '403', '404',
  '501', '502', '503', '504'
];
const HM_SALE_PAYMENT_TYPES = ['ტერმინალი', 'ოთახზე დაწერა', 'ნაღდი'];
const HM_ROOM_SETTLEMENT_TYPES = ['ქეში', 'ბარათი'];
const HM_ROOM_PAYMENTS_SHEET = 'RoomPayments';

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const callback = params.callback || '';
  try {
    const action = params.action || 'ping';
    const payload = parsePayload_(params.payload);
    const result = routeV2_(action, payload);
    return output_(result, callback);
  } catch (err) {
    return output_({ ok: false, error: String(err && err.message ? err.message : err) }, callback);
  }
}

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const result = routeV2_(body.action || 'ping', body.payload || {});
    return output_(result, '');
  } catch (err) {
    return output_({ ok: false, error: String(err && err.message ? err.message : err) }, '');
  }
}

function routeV2_(action, payload) {
  switch (action) {
    case 'ping': return ok_({ version: '1.2.0', message: 'HotelMarket API works' });
    case 'setupDatabase': setupDatabase(); ensureRoomPaymentsSheet_(); ensureSalesExtraHeaders_(); return ok_({ message: 'Database is ready' });
    case 'getRooms': return ok_({ rooms: HM_ROOMS });
    case 'getProducts': return getProducts(payload);
    case 'getProduct': return getProduct(payload);
    case 'addOrUpdateProduct': return addOrUpdateProduct(payload);
    case 'importRows': return importRows(payload);
    case 'processSale': return processSaleV2_(payload);
    case 'getDailyReport': return getDailyReportV2_(payload);
    case 'getSalesHistory': return getSalesHistoryV2_(payload);
    case 'closeDay': return closeDay(payload);
    case 'adjustStock': return adjustStock(payload);
    case 'getRoomBalances': return getRoomBalancesV2_(payload);
    case 'settleRoomDebt': return settleRoomDebtV2_(payload);
    default: throw new Error('Unknown action: ' + action);
  }
}

function ensureRoomPaymentsSheet_() {
  const ss = ss_();
  const name = HM_ROOM_PAYMENTS_SHEET;
  const headers = ['გადახდის ID', 'თარიღი', 'დრო', 'ოთახი', 'თანხა', 'გადახდის ტიპი', 'მოლარე', 'კომენტარი'];
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#eef2ff');
  for (let i = 1; i <= headers.length; i++) sh.autoResizeColumn(i);
  return sh;
}

function ensureSalesExtraHeaders_() {
  const sh = sheet_(SHEET_NAMES.SALES);
  const extra = ['თვითღირებულება', 'თვითღირებულება ჯამი', 'მოგება'];
  sh.getRange(1, 13, 1, extra.length).setValues([extra]);
  sh.getRange(1, 13, 1, extra.length).setFontWeight('bold').setBackground('#eef2ff');
  for (let i = 13; i <= 15; i++) sh.autoResizeColumn(i);
  return sh;
}

function hmIncludes_(arr, value) {
  return arr.indexOf(text_(value)) !== -1;
}

function processSaleV2_(payload) {
  payload = payload || {};
  const items = payload.items || [];
  const paymentType = text_(payload.paymentType);
  const room = text_(payload.room || '');
  const cashier = text_(payload.cashier || '');

  if (!Array.isArray(items) || items.length === 0) throw new Error('კალათა ცარიელია');
  if (!paymentType) throw new Error('გადახდის ტიპის არჩევა სავალდებულოა');
  if (!hmIncludes_(HM_SALE_PAYMENT_TYPES, paymentType)) throw new Error('გადახდის ტიპი არასწორია');
  if (paymentType === 'ოთახზე დაწერა' && !room) throw new Error('ოთახის ნომერი აუცილებელია');
  if (paymentType === 'ოთახზე დაწერა' && !hmIncludes_(HM_ROOMS, room)) throw new Error('ოთახის ნომერი არასწორია');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    setupDatabase();
    ensureRoomPaymentsSheet_();
    ensureSalesExtraHeaders_();

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
      return { row: found.row, product: product, qty: item.qty, price: price, cost: product.avgCost };
    });

    const saleId = Utilities.getUuid();
    const date = today_();
    const time = nowTime_();
    let total = 0;
    let itemsCount = 0;
    const salesSheet = sheet_(SHEET_NAMES.SALES);
    const productsSheet = sheet_(SHEET_NAMES.PRODUCTS);
    const roomSheet = sheet_(SHEET_NAMES.ROOM_CHARGES);

    checked.forEach(function (item) {
      const lineTotal = round2_(item.qty * item.price);
      const costTotal = round2_(item.qty * item.cost);
      const profit = round2_(lineTotal - costTotal);
      total += lineTotal;
      itemsCount += item.qty;
      salesSheet.appendRow([saleId, date, time, item.product.code, item.product.name, item.qty, round2_(item.price), lineTotal, paymentType, room, cashier, 'აქტიური', round2_(item.cost), costTotal, profit]);
      productsSheet.getRange(item.row, 3).setValue(round2_(item.product.stock - item.qty));
      productsSheet.getRange(item.row, 8).setValue(stamp_());
      if (paymentType === 'ოთახზე დაწერა') {
        roomSheet.appendRow([saleId, date, time, room, item.product.code, item.product.name, item.qty, lineTotal, 'გადასახდელი', cashier]);
      }
    });

    return ok_({ saleId: saleId, total: round2_(total), itemsCount: itemsCount });
  } finally {
    lock.releaseLock();
  }
}

function getDailyReportV2_(payload) {
  ensureRoomPaymentsSheet_();
  const report = getDailyReport(payload);
  const date = text_(payload && payload.date) || today_();
  report.roomPayments = getRoomPaymentsSummaryV2_(date);
  return report;
}

function getSalesHistoryV2_(payload) {
  payload = payload || {};
  const date = text_(payload.date) || today_();
  const rows = dataRows_(sheet_(SHEET_NAMES.SALES));
  const costMap = getCurrentProductCostMap_();
  const history = [];

  rows.forEach(function (r) {
    if (text_(r[1]) !== date || text_(r[11]) !== 'აქტიური') return;
    const code = text_(r[3]);
    const qty = num_(r[5]);
    const salePrice = num_(r[6]);
    const revenue = num_(r[7]);
    const storedCost = num_(r[12]);
    const cost = storedCost > 0 ? storedCost : (costMap[code] || 0);
    const costTotal = round2_(qty * cost);
    history.push({
      saleId: text_(r[0]),
      date: text_(r[1]),
      time: text_(r[2]),
      code: code,
      name: text_(r[4]),
      qty: qty,
      cost: round2_(cost),
      costTotal: costTotal,
      salePrice: round2_(salePrice),
      revenue: round2_(revenue),
      paymentType: text_(r[8]),
      room: text_(r[9]),
      cashier: text_(r[10])
    });
  });

  history.sort(function (a, b) {
    return (b.date + ' ' + b.time).localeCompare(a.date + ' ' + a.time);
  });
  return ok_({ date: date, history: history });
}

function getCurrentProductCostMap_() {
  const map = {};
  const rows = dataRows_(sheet_(SHEET_NAMES.PRODUCTS));
  rows.forEach(function (r) {
    map[text_(r[0])] = num_(r[3]);
  });
  return map;
}

function getRoomPaymentsSummaryV2_(date) {
  const rows = dataRows_(ensureRoomPaymentsSheet_());
  const byPayment = { 'ქეში': 0, 'ბარათი': 0 };
  let total = 0;
  rows.forEach(function (r) {
    if (text_(r[1]) !== date) return;
    const amount = num_(r[4]);
    const paymentType = text_(r[5]);
    total += amount;
    if (!byPayment[paymentType]) byPayment[paymentType] = 0;
    byPayment[paymentType] += amount;
  });
  Object.keys(byPayment).forEach(function (k) { byPayment[k] = round2_(byPayment[k]); });
  return { total: round2_(total), byPayment: byPayment };
}

function getRoomBalancesV2_(payload) {
  payload = payload || {};
  setupDatabase();
  ensureRoomPaymentsSheet_();

  const balances = {};
  HM_ROOMS.forEach(function (room) {
    balances[room] = { room: room, balance: 0, itemsCount: 0 };
  });

  const rows = dataRows_(sheet_(SHEET_NAMES.ROOM_CHARGES));
  rows.forEach(function (r) {
    const room = text_(r[3]);
    const amount = num_(r[7]);
    const status = text_(r[8]);
    if (status !== 'გადასახდელი') return;
    if (!balances[room]) balances[room] = { room: room, balance: 0, itemsCount: 0 };
    balances[room].balance += amount;
    balances[room].itemsCount += 1;
  });

  const result = Object.keys(balances).sort().map(function (room) {
    return { room: room, balance: round2_(balances[room].balance), itemsCount: balances[room].itemsCount };
  });
  const total = result.reduce(function (sum, r) { return sum + r.balance; }, 0);
  return ok_({ rooms: HM_ROOMS, balances: result, total: round2_(total) });
}

function settleRoomDebtV2_(payload) {
  payload = payload || {};
  const room = text_(payload.room);
  const paymentType = text_(payload.paymentType);
  const cashier = text_(payload.cashier || '');
  const comment = text_(payload.comment || '');

  if (!room) throw new Error('ოთახის ნომერი აუცილებელია');
  if (!hmIncludes_(HM_ROOMS, room)) throw new Error('ოთახის ნომერი არასწორია');
  if (!paymentType) throw new Error('გადახდის ტიპი აირჩიე');
  if (!hmIncludes_(HM_ROOM_SETTLEMENT_TYPES, paymentType)) throw new Error('გადახდის ტიპი არასწორია');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    setupDatabase();
    const roomPaymentsSheet = ensureRoomPaymentsSheet_();
    const sh = sheet_(SHEET_NAMES.ROOM_CHARGES);
    const rows = dataRows_(sh);
    let total = 0;
    let markedRows = 0;

    rows.forEach(function (r, i) {
      if (text_(r[3]) === room && text_(r[8]) === 'გადასახდელი') {
        total += num_(r[7]);
        sh.getRange(i + 2, 9).setValue('გადახდილია');
        markedRows += 1;
      }
    });

    total = round2_(total);
    if (total <= 0 || markedRows === 0) throw new Error('ამ ოთახზე დავალიანება არ არის');

    const paymentId = Utilities.getUuid();
    roomPaymentsSheet.appendRow([paymentId, today_(), nowTime_(), room, total, paymentType, cashier, comment]);
    return ok_({ paymentId: paymentId, room: room, amount: total, paymentType: paymentType, markedRows: markedRows });
  } finally {
    lock.releaseLock();
  }
}
