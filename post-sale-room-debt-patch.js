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
    setNotice('scanResult', `გაყიდვა დასრულდა. ჯამი: ${money(res.total)} · გადახდის ტიპი განულდა`, 'ok');
    const search = $('productSearch');
    if (search) search.focus();
  } catch (err) {
    setNotice('scanResult', err.message, 'bad');
  } finally {
    setLoading(btn, false);
  }
};

renderRoomBalances = function (balances, total) {
  const body = $('roomBalancesBody');
  if (!body) return;
  body.innerHTML = '';
  $('roomDebtTotal').textContent = money(total || 0);

  const sortedBalances = [...balances].sort((a, b) => {
    const aDebt = Number(a.balance) > 0;
    const bDebt = Number(b.balance) > 0;
    if (aDebt !== bDebt) return aDebt ? -1 : 1;
    if (aDebt && bDebt && Number(b.balance) !== Number(a.balance)) return Number(b.balance) - Number(a.balance);
    return Number(a.room) - Number(b.room);
  });

  sortedBalances.forEach((item) => {
    const hasDebt = Number(item.balance) > 0;
    const tr = document.createElement('tr');
    tr.className = hasDebt ? 'debt-row' : 'zero-row';
    tr.innerHTML = `
      <td>${escapeHtml(item.room)}${hasDebt ? ' · დავალიანება!' : ''}</td>
      <td><strong>${money(item.balance)}</strong></td>
      <td>${item.itemsCount || 0}</td>
      <td>
        <select data-room-payment="${escapeHtml(item.room)}" ${hasDebt ? '' : 'disabled'}>
          <option value="">აირჩიე</option>
          <option value="ქეში">ქეში</option>
          <option value="ბარათი">ბარათი</option>
        </select>
      </td>
      <td><button class="success" data-settle-room="${escapeHtml(item.room)}" ${hasDebt ? '' : 'disabled'}>განულება</button></td>`;
    body.appendChild(tr);
  });

  document.querySelectorAll('[data-settle-room]').forEach((btn) => {
    btn.addEventListener('click', () => settleRoomDebt(btn.dataset.settleRoom));
  });
};

document.addEventListener('DOMContentLoaded', hmResetPaymentAfterSale);
