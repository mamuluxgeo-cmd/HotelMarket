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

    const today = new Date().toISOString().slice(0, 10);
    const dateFrom = document.getElementById('salesHistoryDateFrom')?.value || document.getElementById('reportDate')?.value || today;
    const dateTo = document.getElementById('salesHistoryDateTo')?.value || dateFrom;

    const res = await api('getSalesHistory', { dateFrom, dateTo });
    const history = res.history || [];

    if (!body) return;
    body.innerHTML = '';

    if (!history.length) {
      body.innerHTML = '<tr><td colspan="11">ამ პერიოდში გატარებები არ არის</td></tr>';
    } else {
      history.forEach((row) => {
        const tr = document.createElement('tr');
        const shortId = row.saleId ? String(row.saleId).slice(0, 8) : '';
        tr.innerHTML = `
          <td>${escapeHtml(row.date || '')}</td>
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
      msg.textContent = `ნაჩვენებია ${dateFrom} - ${dateTo} პერიოდის გატარებები · ჩანაწერი: ${history.length}`;
      msg.className = 'notice ok';
    }
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

window.loadSalesHistory = hmLoadSalesHistoryDirect;

function hmBindHistoryButtonFix() {
  const btn = document.getElementById('loadSalesHistory') || document.getElementById('salesHistoryFetchBtn');
  if (btn && !btn.dataset.hmHistoryFixed) {
    btn.dataset.hmHistoryFixed = '1';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      hmLoadSalesHistoryDirect();
    });
  }
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
