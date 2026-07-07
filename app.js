const HM_API_URL = 'https://script.google.com/macros/s/AKfycbwqc-d9leOrTtWSxpHKSqgw_F3OWh4BIP4zxgButlVkmwpKG6FaQOL0VAqQZNzhQgLEbQ/exec';

let products = [];
let cart = [];

const $ = (id) => document.getElementById(id);
const money = (n) => `${Number(n || 0).toFixed(2)} ₾`;

function api(action, payload = {}) {
  return new Promise((resolve, reject) => {
    const cb = `hm_cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('კავშირის დრო ამოიწურა'));
    }, 30000);

    function cleanup() {
      clearTimeout(timer);
      delete window[cb];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[cb] = (data) => {
      cleanup();
      if (!data || data.ok === false) reject(new Error(data && data.error ? data.error : 'უცნობი შეცდომა'));
      else resolve(data);
    };

    const url = `${HM_API_URL}?action=${encodeURIComponent(action)}&callback=${encodeURIComponent(cb)}&payload=${encodeURIComponent(JSON.stringify(payload))}`;
    script.onerror = () => {
      cleanup();
      reject(new Error('API ლინკთან კავშირი ვერ მოხერხდა'));
    };
    script.src = url;
    document.body.appendChild(script);
  });
}

function setNotice(id, msg, type = '') {
  const el = $(id);
  if (!el) return;
  el.textContent = msg || '';
  el.className = `notice ${type}`;
}

function setLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
}

async function checkApi() {
  const status = $('apiStatus');
  try {
    const res = await api('ping');
    status.textContent = `კავშირი OK · v${res.version}`;
    status.className = 'status ok';
  } catch (err) {
    status.textContent = err.message;
    status.className = 'status bad';
  }
}

function initTabs() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      $(btn.dataset.page).classList.add('active');
      if (btn.dataset.page === 'products') refreshProducts();
      if (btn.dataset.page === 'reports') loadReport();
    });
  });
}

async function refreshProducts() {
  try {
    const res = await api('getProducts', { activeOnly: false });
    products = res.products || [];
    renderProducts();
  } catch (err) {
    setNotice('productMsg', err.message, 'bad');
  }
}

function renderProducts() {
  const body = $('productsBody');
  body.innerHTML = '';
  products.forEach((p) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(p.code)}</td><td>${escapeHtml(p.name)}</td><td>${p.stock}</td><td>${money(p.avgCost)}</td><td>${money(p.salePrice)}</td><td>${escapeHtml(p.status)}</td>`;
    body.appendChild(tr);
  });
}

async function scanProduct() {
  const code = $('scanCode').value.trim();
  const qty = Number($('scanQty').value || 1);
  if (!code) return setNotice('scanResult', 'კოდი ჩაწერე ან ლაზერით გაატარე', 'bad');
  if (qty <= 0) return setNotice('scanResult', 'რაოდენობა არასწორია', 'bad');

  try {
    const res = await api('getProduct', { code });
    if (!res.found) return setNotice('scanResult', 'პროდუქტი ვერ მოიძებნა', 'bad');
    const p = res.product;
    if (Number(p.stock) < qty) return setNotice('scanResult', `ნაშთი არ არის საკმარისი. დარჩენილია: ${p.stock}`, 'bad');
    addToCart(p, qty);
    $('scanCode').value = '';
    $('scanQty').value = 1;
    $('scanCode').focus();
    setNotice('scanResult', `${p.name} დაემატა კალათაში`, 'ok');
  } catch (err) {
    setNotice('scanResult', err.message, 'bad');
  }
}

function addToCart(product, qty) {
  const found = cart.find((x) => x.code === product.code);
  if (found) found.qty += Number(qty);
  else cart.push({ code: product.code, name: product.name, qty: Number(qty), price: Number(product.salePrice || 0) });
  renderCart();
}

function renderCart() {
  const body = $('cartBody');
  body.innerHTML = '';
  let total = 0;
  cart.forEach((item, idx) => {
    const line = Number(item.qty) * Number(item.price);
    total += line;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(item.code)}</td>
      <td>${escapeHtml(item.name)}</td>
      <td><input type="number" min="0.01" step="0.01" value="${item.qty}" data-cart-qty="${idx}"></td>
      <td><input type="number" min="0" step="0.01" value="${item.price}" data-cart-price="${idx}"></td>
      <td>${money(line)}</td>
      <td><button class="danger" data-remove="${idx}">X</button></td>`;
    body.appendChild(tr);
  });
  $('cartTotal').textContent = money(total);

  document.querySelectorAll('[data-cart-qty]').forEach((input) => input.addEventListener('change', (e) => {
    cart[Number(e.target.dataset.cartQty)].qty = Number(e.target.value || 0);
    renderCart();
  }));
  document.querySelectorAll('[data-cart-price]').forEach((input) => input.addEventListener('change', (e) => {
    cart[Number(e.target.dataset.cartPrice)].price = Number(e.target.value || 0);
    renderCart();
  }));
  document.querySelectorAll('[data-remove]').forEach((btn) => btn.addEventListener('click', (e) => {
    cart.splice(Number(e.target.dataset.remove), 1);
    renderCart();
  }));
}

async function finishSale() {
  if (!cart.length) return setNotice('scanResult', 'კალათა ცარიელია', 'bad');
  const paymentType = $('paymentType').value;
  const room = $('roomNumber').value.trim();
  if (paymentType === 'ოთახზე დაწერა' && !room) return setNotice('scanResult', 'ოთახის ნომერი აუცილებელია', 'bad');

  const btn = $('finishSale');
  setLoading(btn, true);
  try {
    const res = await api('processSale', {
      items: cart,
      paymentType,
      room,
      cashier: $('cashierName').value.trim()
    });
    cart = [];
    renderCart();
    await refreshProducts();
    setNotice('scanResult', `გაყიდვა დასრულდა. ჯამი: ${money(res.total)}`, 'ok');
  } catch (err) {
    setNotice('scanResult', err.message, 'bad');
  } finally {
    setLoading(btn, false);
  }
}

async function saveProduct() {
  const btn = $('saveProduct');
  setLoading(btn, true);
  try {
    const payload = {
      code: $('pCode').value.trim(),
      name: $('pName').value.trim(),
      qty: $('pQty').value,
      cost: $('pCost').value,
      salePrice: $('pPrice').value
    };
    const res = await api('addOrUpdateProduct', payload);
    setNotice('productMsg', `${res.product.name} შენახულია`, 'ok');
    $('pQty').value = 0;
    $('pCost').value = 0;
    await refreshProducts();
  } catch (err) {
    setNotice('productMsg', err.message, 'bad');
  } finally {
    setLoading(btn, false);
  }
}

async function importFile() {
  const file = $('fileInput').files[0];
  if (!file) return setNotice('importMsg', 'აირჩიე Excel ან CSV ფაილი', 'bad');
  const btn = $('importFile');
  setLoading(btn, true);
  try {
    const rows = await readRowsFromFile(file);
    if (!rows.length) throw new Error('ფაილში მონაცემები ვერ მოიძებნა');
    let total = 0;
    const chunkSize = 15;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const res = await api('importRows', { rows: chunk });
      total += Number(res.importedCount || 0);
      setNotice('importMsg', `იტვირთება... ${Math.min(i + chunk.length, rows.length)} / ${rows.length}`, 'ok');
    }
    setNotice('importMsg', `ატვირთულია ${total} პროდუქტის ჩანაწერი`, 'ok');
    await refreshProducts();
  } catch (err) {
    setNotice('importMsg', err.message, 'bad');
  } finally {
    setLoading(btn, false);
  }
}

function readRowsFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ფაილის წაკითხვა ვერ მოხერხდა'));
    reader.onload = (e) => {
      try {
        let table = [];
        if (file.name.toLowerCase().endsWith('.csv')) {
          table = parseCsv(e.target.result);
        } else {
          if (typeof XLSX === 'undefined') throw new Error('Excel ბიბლიოთეკა ვერ ჩაიტვირთა. გამოიყენე CSV.');
          const workbook = XLSX.read(e.target.result, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          table = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        }
        resolve(mapImportRows(table));
      } catch (err) {
        reject(err);
      }
    };
    if (file.name.toLowerCase().endsWith('.csv')) reader.readAsText(file, 'UTF-8');
    else reader.readAsArrayBuffer(file);
  });
}

function mapImportRows(table) {
  if (!table || table.length < 2) return [];
  const headers = table[0].map((h) => String(h).trim().toLowerCase());
  const idx = {
    name: findHeader(headers, ['დასახელება', 'name']),
    code: findHeader(headers, ['კოდი', 'code', 'barcode']),
    qty: findHeader(headers, ['რაოდენობა', 'qty', 'quantity']),
    cost: findHeader(headers, ['თვითღირებულება', 'მისი ფასი', 'cost', 'cost price']),
    salePrice: findHeader(headers, ['გასაყიდი ფასი', 'price', 'sale price'])
  };
  return table.slice(1).map((r) => ({
    name: r[idx.name] || '',
    code: r[idx.code] || '',
    qty: r[idx.qty] || 0,
    cost: r[idx.cost] || 0,
    salePrice: idx.salePrice >= 0 ? (r[idx.salePrice] || 0) : 0
  })).filter((r) => String(r.code).trim());
}

function findHeader(headers, names) {
  for (const name of names) {
    const i = headers.indexOf(String(name).toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"' && quote && next === '"') { cell += '"'; i++; }
    else if (ch === '"') quote = !quote;
    else if (ch === ',' && !quote) { row.push(cell); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quote) {
      if (cell || row.length) { row.push(cell); rows.push(row); row = []; cell = ''; }
      if (ch === '\r' && next === '\n') i++;
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function downloadStock() {
  const headers = ['კოდი', 'დასახელება', 'სისტემური ნაშთი', 'რეალური ნაშთი', 'სხვაობა', 'საშ. თვითღირებულება', 'გასაყიდი ფასი'];
  const rows = products.map((p) => [p.code, p.name, p.stock, '', '', p.avgCost, p.salePrice]);
  const csv = [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `nashti_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function csvCell(v) {
  const s = String(v ?? '');
  return `"${s.replaceAll('"', '""')}"`;
}

async function adjustStock() {
  try {
    const res = await api('adjustStock', {
      code: $('adjCode').value.trim(),
      newQty: $('adjQty').value,
      comment: $('adjComment').value.trim(),
      operator: $('cashierName').value.trim()
    });
    setNotice('adjustMsg', `შესწორდა. სხვაობა: ${res.diff}`, 'ok');
    await refreshProducts();
  } catch (err) {
    setNotice('adjustMsg', err.message, 'bad');
  }
}

async function loadReport() {
  try {
    const date = $('reportDate').value || new Date().toISOString().slice(0, 10);
    const res = await api('getDailyReport', { date });
    $('rTotal').textContent = money(res.total);
    $('rTerminal').textContent = money(res.byPayment['ტერმინალი'] || 0);
    $('rRoom').textContent = money(res.byPayment['ოთახზე დაწერა'] || 0);
    $('rCash').textContent = money(res.byPayment['ნაღდი'] || 0);
    renderReportTables(res);
    setNotice('reportMsg', `ნაჩვენებია ${date} დღის ანგარიში`, 'ok');
  } catch (err) {
    setNotice('reportMsg', err.message, 'bad');
  }
}

function renderReportTables(res) {
  const pb = $('reportProducts');
  pb.innerHTML = '';
  (res.products || []).forEach((p) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(p.code)}</td><td>${escapeHtml(p.name)}</td><td>${p.qty}</td><td>${money(p.total)}</td>`;
    pb.appendChild(tr);
  });

  const rb = $('reportRooms');
  rb.innerHTML = '';
  (res.rooms || []).forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(r.room)}</td><td>${money(r.total)}</td>`;
    rb.appendChild(tr);
  });
}

async function closeDay() {
  try {
    const res = await api('closeDay', {
      date: $('reportDate').value,
      cashier: $('cashierName').value.trim()
    });
    setNotice('reportMsg', `დღე დაიხურა. ჯამი: ${money(res.report.total)}`, 'ok');
    await loadReport();
  } catch (err) {
    setNotice('reportMsg', err.message, 'bad');
  }
}

async function resetTestData() {
  try {
    const res = await api('resetTestData', {
      mode: $('resetMode').value,
      confirmText: $('resetConfirm').value.trim()
    });
    setNotice('settingsMsg', res.message, 'ok');
    await refreshProducts();
  } catch (err) {
    setNotice('settingsMsg', err.message, 'bad');
  }
}

async function setupDb() {
  try {
    const res = await api('setupDatabase');
    setNotice('settingsMsg', res.message || 'Sheet მზად არის', 'ok');
    await refreshProducts();
  } catch (err) {
    setNotice('settingsMsg', err.message, 'bad');
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[c]));
}

function bindEvents() {
  $('scanBtn').addEventListener('click', scanProduct);
  $('scanCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') scanProduct(); });
  $('finishSale').addEventListener('click', finishSale);
  $('saveProduct').addEventListener('click', saveProduct);
  $('importFile').addEventListener('click', importFile);
  $('downloadStock').addEventListener('click', downloadStock);
  $('refreshProducts').addEventListener('click', refreshProducts);
  $('adjustStock').addEventListener('click', adjustStock);
  $('loadReport').addEventListener('click', loadReport);
  $('closeDay').addEventListener('click', closeDay);
  $('resetBtn').addEventListener('click', resetTestData);
  $('setupBtn').addEventListener('click', setupDb);
  $('paymentType').addEventListener('change', () => {
    const show = $('paymentType').value === 'ოთახზე დაწერა';
    $('roomLabel').classList.toggle('hidden', !show);
    $('roomNumber').classList.toggle('hidden', !show);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  bindEvents();
  $('reportDate').value = new Date().toISOString().slice(0, 10);
  await checkApi();
  await refreshProducts();
  renderCart();
});
