function hmResetPaymentAfterSale() {
  const paymentType = document.getElementById('paymentType');
  const roomNumber = document.getElementById('roomNumber');
  const roomLabel = document.getElementById('roomLabel');
  if (paymentType) paymentType.value = '';
  if (roomNumber) {
    roomNumber.value = '';
    roomNumber.classList.add('hidden');
  }
  if (roomLabel) roomLabel.classList.add('hidden');
}

finishSale = async function () {
  if (!cart.length) return setNotice('scanResult', 'კალათა ცარიელია', 'bad');
  const paymentType = $('paymentType').value;
  const room = $('roomNumber').value.trim();
  if (!paymentType) return setNotice('scanResult', 'გადახდის ტიპი აირჩიე', 'bad');
  if (paymentType === 'ოთახზე დაწერა' && !room) return setNotice('scanResult', 'ოთახის ნომერი აირჩიე', 'bad');

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
    hmResetPaymentAfterSale();
    await refreshProducts();
    await loadRoomBalances();
    if (typeof loadSalesHistory === 'function') await loadSalesHistory();
    setNotice('scanResult', `გაყიდვა დასრულდა. ჯამი: ${money(res.total)} · გადახდის ტიპი განულდა`, 'ok');
    const search = $('productSearch');
    if (search) search.focus();
  } catch (err) {
    setNotice('scanResult', err.message, 'bad');
  } finally {
    setLoading(btn, false);
  }
};

renderProducts = function () {
  const body = $('productsBody');
  if (!body) return;
  body.innerHTML = '';
  const sorted = [...products].sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0));
  sorted.forEach((p) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(p.code)}</td><td>${escapeHtml(p.name)}</td><td>${p.stock}</td><td>${money(p.avgCost)}</td><td>${money(p.salePrice)}</td><td>${escapeHtml(p.status)}</td>`;
    body.appendChild(tr);
  });
};

renderSuggestions = function () {
  const box = $('productSuggestions');
  if (!box) return;
  box.innerHTML = '';

  if (!currentSuggestions.length) {
    box.classList.add('hidden');
    return;
  }

  currentSuggestions.forEach((p, index) => {
    const stock = Number(p.stock || 0);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `suggestion-item ${index === activeSuggestionIndex ? 'active' : ''} ${stock <= 0 ? 'out-of-stock' : ''}`;
    btn.dataset.code = p.code;
    btn.innerHTML = `
      <span>
        <span class="suggestion-title">${escapeHtml(p.name)}</span>
        <span class="suggestion-meta">კოდი: ${escapeHtml(p.code)}</span>
      </span>
      <span class="suggestion-side">
        <span class="suggestion-price">${money(p.salePrice)}</span>
        <span class="stock-badge">ნაშთი: ${stock} ცალი</span>
      </span>`;
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectSuggestion(index);
    });
    box.appendChild(btn);
  });

  box.classList.remove('hidden');
};

renderRoomBalances = function (balances, total) {
  const body = $('roomBalancesBody');
  if (!body) return;
  body.innerHTML = '';
  $('roomDebtTotal').textContent = money(total || 0);

  const roomCardTitle = body.closest('.card')?.querySelector('h2');
  if (roomCardTitle) roomCardTitle.textContent = 'ოთახების დავალიანება';

  const onlyDebts = [...balances]
    .filter((item) => Number(item.balance) > 0)
    .sort((a, b) => {
      if (Number(b.balance) !== Number(a.balance)) return Number(b.balance) - Number(a.balance);
      return Number(a.room) - Number(b.room);
    });

  if (!onlyDebts.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="5">ამ ეტაპზე ოთახების დავალიანება არ არის</td>';
    body.appendChild(tr);
    return;
  }

  onlyDebts.forEach((item) => {
    const tr = document.createElement('tr');
    tr.className = 'debt-row';
    tr.innerHTML = `
      <td>${escapeHtml(item.room)} · დავალიანება!</td>
      <td><strong>${money(item.balance)}</strong></td>
      <td>${item.itemsCount || 0}</td>
      <td>
        <select data-room-payment="${escapeHtml(item.room)}">
          <option value="">აირჩიე</option>
          <option value="ქეში">ქეში</option>
          <option value="ბარათი">ბარათი</option>
        </select>
      </td>
      <td><button class="success" data-settle-room="${escapeHtml(item.room)}">განულება</button></td>`;
    body.appendChild(tr);
  });

  document.querySelectorAll('[data-settle-room]').forEach((btn) => {
    btn.addEventListener('click', () => settleRoomDebt(btn.dataset.settleRoom));
  });
};

function hmInsertSalesHistoryUI() {
  if ($('salesHistoryCard')) return;
  const reportSection = $('reports');
  if (!reportSection) return;

  const card = document.createElement('div');
  card.className = 'card';
  card.id = 'salesHistoryCard';
  card.innerHTML = `
    <div class="between">
      <h2>გატარების ისტორია</h2>
      <button id="loadSalesHistory" class="primary">ჩამოქაჩვა</button>
    </div>
    <label>თარიღი</label>
    <input id="salesHistoryDate" type="date">
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>დრო</th>
            <th>გატარება</th>
            <th>კოდი</th>
            <th>დასახელება</th>
            <th>რაოდ.</th>
            <th>თვითღირებულება</th>
            <th>გასაყიდი ფასი</th>
            <th>რეალიზაცია</th>
            <th>გადახდა</th>
            <th>ოთახი</th>
          </tr>
        </thead>
        <tbody id="salesHistoryBody"></tbody>
      </table>
    </div>
    <div id="salesHistoryMsg" class="notice"></div>`;

  const roomCard = $('roomBalancesBody')?.closest('.card');
  if (roomCard) roomCard.insertAdjacentElement('afterend', card);
  else reportSection.appendChild(card);

  const today = new Date().toISOString().slice(0, 10);
  $('salesHistoryDate').value = ($('reportDate') && $('reportDate').value) || today;
  $('loadSalesHistory').addEventListener('click', loadSalesHistory);
}

async function loadSalesHistory() {
  try {
    const date = $('salesHistoryDate')?.value || $('reportDate')?.value || new Date().toISOString().slice(0, 10);
    const res = await api('getSalesHistory', { date });
    renderSalesHistory(res.history || []);
    setNotice('salesHistoryMsg', `ნაჩვენებია ${date} დღის გატარებები`, 'ok');
  } catch (err) {
    setNotice('salesHistoryMsg', err.message, 'bad');
  }
}

function renderSalesHistory(history) {
  const body = $('salesHistoryBody');
  if (!body) return;
  body.innerHTML = '';
  if (!history.length) {
    body.innerHTML = '<tr><td colspan="10">ამ თარიღზე გატარებები არ არის</td></tr>';
    return;
  }

  history.forEach((row) => {
    const tr = document.createElement('tr');
    const shortId = row.saleId ? row.saleId.slice(0, 8) : '';
    tr.innerHTML = `
      <td>${escapeHtml(row.time)}</td>
      <td>${escapeHtml(shortId)}</td>
      <td>${escapeHtml(row.code)}</td>
      <td>${escapeHtml(row.name)}</td>
      <td>${row.qty}</td>
      <td>${money(row.cost)}</td>
      <td>${money(row.salePrice)}</td>
      <td><strong>${money(row.revenue)}</strong></td>
      <td>${escapeHtml(row.paymentType)}</td>
      <td>${escapeHtml(row.room || '')}</td>`;
    body.appendChild(tr);
  });
}

const hmOldLoadReport = loadReport;
loadReport = async function () {
  await hmOldLoadReport();
  if ($('salesHistoryDate') && $('reportDate')) $('salesHistoryDate').value = $('reportDate').value;
  if (typeof loadSalesHistory === 'function') await loadSalesHistory();
};

document.addEventListener('DOMContentLoaded', () => {
  hmResetPaymentAfterSale();
  hmInsertSalesHistoryUI();
  if (typeof loadSalesHistory === 'function') loadSalesHistory();
});
