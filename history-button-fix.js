function hmDateKeyBrowser(value) {
  return String(value || '').trim().replace(/\./g, '-').replace(/\//g, '-').slice(0, 10);
}

function hmCsvCell(value) {
  const s = String(value ?? '');
  return `"${s.replaceAll('"', '""')}"`;
}

function hmDownloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows].map((r) => r.map(hmCsvCell).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function hmFilterSalesByPeriod(allSales, dateFrom, dateTo) {
  return (allSales || []).filter((row) => {
    const d = hmDateKeyBrowser(row.date || row.rawDate);
    return d >= dateFrom && d <= dateTo;
  });
}

function hmRenderSalesHistoryRows(history, dateFrom, dateTo, scannedRows) {
  const body = document.getElementById('salesHistoryBody');
  const msg = document.getElementById('salesHistoryMsg');
  if (!body) return;
  body.innerHTML = '';

  if (!history.length) {
    body.innerHTML = '<tr><td colspan="11">ამ პერიოდში გატარებები არ არის</td></tr>';
  } else {
    history.forEach((row) => {
      const tr = document.createElement('tr');
      const shortId = row.saleId ? String(row.saleId).slice(0, 8) : '';
      tr.innerHTML = `
        <td>${escapeHtml(row.date || row.rawDate || '')}</td>
        <td>${escapeHtml(row.time || '')}</td>
        <td>${escapeHtml(shortId)}</td>
        <td>${escapeHtml(row.code || '')}</td>
        <td>${escapeHtml(row.name || '')}</td>
        <td>${row.qty || 0}</td>
        <td>${money(row.cost || 0)}</td>
        <td>${money(row.salePrice || 0)}</td>
        <td><strong>${money(row.revenue || 0)}</strong></td>
        <td>${escapeHtml(row.paymentType || '')}</td>
        <td>${escapeHtml(row.room || '')}</td>`;
      body.appendChild(tr);
    });
  }

  if (msg) {
    msg.textContent = `ნაჩვენებია ${dateFrom} - ${dateTo} პერიოდი · ჩანაწერი: ${history.length} · შემოწმდა: ${scannedRows || 0}`;
    msg.className = 'notice ok';
  }
}

function hmGetSalesPeriod() {
  const today = new Date().toISOString().slice(0, 10);
  const dateFrom = document.getElementById('salesHistoryDateFrom')?.value || document.getElementById('reportDate')?.value || today;
  const dateTo = document.getElementById('salesHistoryDateTo')?.value || dateFrom;
  return { dateFrom, dateTo };
}

async function hmFetchSalesRowsForPeriod() {
  const { dateFrom, dateTo } = hmGetSalesPeriod();
  const res = await api('getSalesRows', { limit: 5000 });
  const allSales = res.sales || [];
  const history = hmFilterSalesByPeriod(allSales, dateFrom, dateTo);
  return { dateFrom, dateTo, history, scannedRows: res.scannedRows || allSales.length };
}

async function hmLoadSalesHistoryDirect() {
  const body = document.getElementById('salesHistoryBody');
  const msg = document.getElementById('salesHistoryMsg');
  const btn = document.getElementById('loadSalesHistory') || document.getElementById('salesHistoryFetchBtn');

  try {
    if (btn) btn.disabled = true;
    if (msg) {
      msg.textContent = 'იტვირთება...';
      msg.className = 'notice';
    }

    const result = await hmFetchSalesRowsForPeriod();
    hmRenderSalesHistoryRows(result.history, result.dateFrom, result.dateTo, result.scannedRows);
  } catch (err) {
    if (body) body.innerHTML = `<tr><td colspan="11">შეცდომა: ${escapeHtml(err.message || err)}</td></tr>`;
    if (msg) {
      msg.textContent = err.message || String(err);
      msg.className = 'notice bad';
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function hmDownloadSalesCsv() {
  const msg = document.getElementById('salesHistoryMsg');
  const btn = document.getElementById('downloadSalesCsv');

  try {
    if (btn) btn.disabled = true;
    if (msg) {
      msg.textContent = 'CSV ფაილი მზადდება...';
      msg.className = 'notice';
    }

    const result = await hmFetchSalesRowsForPeriod();
    const headers = [
      'თარიღი',
      'დრო',
      'გატარების ID',
      'კოდი',
      'დასახელება',
      'რაოდენობა',
      'თვითღირებულება',
      'თვითღირებულება ჯამი',
      'გასაყიდი ფასი',
      'რეალიზაცია',
      'გადახდის ტიპი',
      'ოთახი',
      'მოლარე'
    ];
    const rows = result.history.map((row) => [
      row.date || row.rawDate || '',
      row.time || '',
      row.saleId || '',
      row.code || '',
      row.name || '',
      row.qty || 0,
      Number(row.cost || 0).toFixed(2),
      Number(row.costTotal || 0).toFixed(2),
      Number(row.salePrice || 0).toFixed(2),
      Number(row.revenue || 0).toFixed(2),
      row.paymentType || '',
      row.room || '',
      row.cashier || ''
    ]);

    hmDownloadCsv(`realizacia_${result.dateFrom}_${result.dateTo}.csv`, headers, rows);
    hmRenderSalesHistoryRows(result.history, result.dateFrom, result.dateTo, result.scannedRows);

    if (msg) {
      msg.textContent = `CSV ჩამოიტვირთა · პერიოდი: ${result.dateFrom} - ${result.dateTo} · ჩანაწერი: ${result.history.length}`;
      msg.className = 'notice ok';
    }
  } catch (err) {
    if (msg) {
      msg.textContent = err.message || String(err);
      msg.className = 'notice bad';
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

window.loadSalesHistory = hmLoadSalesHistoryDirect;
window.downloadSalesCsv = hmDownloadSalesCsv;

function hmEnsureSalesCsvButton() {
  if (document.getElementById('downloadSalesCsv')) return;
  const loadBtn = document.getElementById('loadSalesHistory') || document.getElementById('salesHistoryFetchBtn');
  if (!loadBtn) return;

  const btn = document.createElement('button');
  btn.id = 'downloadSalesCsv';
  btn.type = 'button';
  btn.className = 'ghost';
  btn.textContent = 'რეალიზაციის CSV ჩამოტვირთვა';
  btn.addEventListener('click', function (e) {
    e.preventDefault();
    hmDownloadSalesCsv();
  });

  loadBtn.insertAdjacentElement('afterend', btn);
}

function hmBindHistoryButtonFix() {
  const btn = document.getElementById('loadSalesHistory') || document.getElementById('salesHistoryFetchBtn');
  if (btn && !btn.dataset.hmHistoryFixed) {
    btn.dataset.hmHistoryFixed = '1';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      hmLoadSalesHistoryDirect();
    });
  }
  hmEnsureSalesCsvButton();
}

document.addEventListener('click', function (e) {
  const target = e.target && e.target.closest ? e.target.closest('#loadSalesHistory, #salesHistoryFetchBtn') : null;
  if (target) {
    e.preventDefault();
    hmLoadSalesHistoryDirect();
  }
}, true);

document.addEventListener('DOMContentLoaded', function () {
  hmBindHistoryButtonFix();
  setTimeout(hmBindHistoryButtonFix, 300);
  setTimeout(hmBindHistoryButtonFix, 1000);
});
