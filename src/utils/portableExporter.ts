import { AppBackupPayload, MaaserDonation, Transaction } from '../types';
import { PAYMENT_METHODS } from '../constants';

export function formatILS(amount: number): string {
  return Math.round(amount).toLocaleString('he-IL') + ' ₪';
}

export function getPaymentMethodLabel(method: string): string {
  return PAYMENT_METHODS.find((p) => p.id === method)?.label || method;
}

export function exportTransactionsCSV(transactions: Transaction[]): void {
  const rows = [
    ['תאריך', 'סוג', 'קטגוריה', 'סכום (₪)', 'אמצעי תשלום', 'חוזר/הוראת קבע', 'חייב במעשר / מוכר למעשר', 'הערה'],
  ];

  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
  for (const t of sorted) {
    const maaserStatus =
      t.type === 'income'
        ? t.isMaaserEligible !== false
          ? 'הכנסה חייבת במעשר'
          : 'פטור ממעשר'
        : t.isMaaserPayment
          ? 'תשלום מעשר/צדקה'
          : t.isDeductibleFromIncome
            ? 'הוצאה מוכרת לניכוי ממעשר'
            : 'רגיל';

    rows.push([
      t.date,
      t.type === 'income' ? 'הכנסה' : 'הוצאה',
      t.categoryLabel,
      String(t.amount),
      getPaymentMethodLabel(t.paymentMethod),
      t.isRecurring ? 'כן' : 'לא',
      maaserStatus,
      t.note || '',
    ]);
  }

  downloadCSVFile(rows, `budget-transactions-${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportMaaserCSV(donations: MaaserDonation[]): void {
  const rows = [
    ['תאריך', 'מוטב / עמותה', 'קטגוריית מצווה', 'סכום (₪)', 'סטטוס', 'אמצעי תשלום', 'מספר קבלה', 'סעיף 46', 'הוראת קבע', 'הערה'],
  ];

  const sorted = [...donations].sort((a, b) => b.date.localeCompare(a.date));
  for (const d of sorted) {
    rows.push([
      d.date,
      d.recipient,
      d.categoryLabel,
      String(d.amount),
      d.status === 'paid' ? 'שולם' : 'התחייבות / נדר',
      getPaymentMethodLabel(d.paymentMethod),
      d.receiptNumber || '',
      d.hasTaxCredit46 ? 'כן' : 'לא',
      d.isRecurring ? 'כן' : 'לא',
      d.note || '',
    ]);
  }

  downloadCSVFile(rows, `maaser-ledger-${new Date().toISOString().slice(0, 10)}.csv`);
}

function downloadCSVFile(rows: string[][], filename: string): void {
  const csv = rows
    .map((r) => r.map((v) => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(','))
    .join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function exportBackupJSON(payload: AppBackupPayload): void {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `maaser-budget-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Generates a self-contained Windows Desktop Application (.hta) or Offline Portable App (.html)
 * pre-populated with all current user data so it runs as a standalone desktop program on Windows.
 */
export function exportDesktopExecutableApp(payload: AppBackupPayload, format: 'hta' | 'html'): void {
  const embeddedData = JSON.stringify(payload).replace(/<\/script>/gi, '<\\/script>');

  const htaHeader =
    format === 'hta'
      ? `<HTA:APPLICATION
  ID="BudgetMaaserProApp"
  APPLICATIONNAME="כלכלת הבית ומעשרות Pro"
  BORDER="thick"
  BORDERSTYLE="normal"
  CAPTION="yes"
  MAXIMIZEBUTTON="yes"
  MINIMIZEBUTTON="yes"
  SHOWINTASKBAR="yes"
  SINGLEINSTANCE="yes"
  SYSMENU="yes"
  VERSION="2.0"
  WINDOWSTATE="maximize"
/>`
      : '';

  const content = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>כלכלת הבית ומעשרות Pro — מהדורה שולחנית עצמאית</title>
${htaHeader}
<style>
  :root {
    --bg: #f8fafc;
    --surface: #ffffff;
    --border: #e2e8f0;
    --text: #0f172a;
    --muted: #64748b;
    --primary: #1d4ed8;
    --success: #15803d;
    --danger: #b91c1c;
    --amber: #b45309;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    direction: rtl;
  }
  header {
    background: #0f172a;
    color: #fff;
    padding: 14px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .container { max-width: 1200px; margin: 20px auto; padding: 0 20px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 16px; }
  .kpi-title { font-size: 13px; color: var(--muted); margin-bottom: 6px; }
  .kpi-val { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .tabs { display: flex; gap: 8px; margin-bottom: 18px; border-bottom: 1px solid var(--border); padding-bottom: 10px; }
  button {
    cursor: pointer;
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: #fff;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
  }
  button.active { background: var(--primary); color: #fff; border-color: var(--primary); }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { padding: 10px 12px; border-bottom: 1px solid var(--border); text-align: right; }
  th { background: #f1f5f9; color: var(--muted); font-weight: 600; }
  input, select { padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; font-family: inherit; }
  .form-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
</style>
</head>
<body>
<header>
  <div style="font-size:18px;font-weight:700;">כלכלת הבית ומעשרות Pro — תוכנה שולחנית עצמאית</div>
  <div style="font-size:12px;color:#94a3b8;">נתונים שמורים מקומית במחשב זה</div>
</header>
<div class="container">
  <div id="app"></div>
</div>
<script>
  var INITIAL_DATA = ${embeddedData};
  var stateKey = 'budget_maaser_standalone_v2';
  var store = INITIAL_DATA;
  try {
    var saved = localStorage.getItem(stateKey);
    if (saved) store = JSON.parse(saved);
  } catch(e) {}
  function saveStore() {
    try { localStorage.setItem(stateKey, JSON.stringify(store)); } catch(e) {}
  }
  var activeTab = 'overview';
  function fmt(n) { return Math.round(n || 0).toLocaleString('he-IL') + ' ₪'; }
  function render() {
    var inc = 0, exp = 0, maaserObligation = 0, maaserPaid = 0;
    var rate = (store.maaserSettings && store.maaserSettings.ratePercent) || 10;
    (store.transactions || []).forEach(function(t) {
      if (t.type === 'income') {
        inc += t.amount;
        if (t.isMaaserEligible !== false) maaserObligation += (t.amount * rate / 100);
      } else {
        exp += t.amount;
        if (t.isDeductibleFromIncome) maaserObligation -= (t.amount * rate / 100);
        if (t.isMaaserPayment) maaserPaid += t.amount;
      }
    });
    (store.maaserDonations || []).forEach(function(d) {
      if (d.status === 'paid') maaserPaid += d.amount;
    });
    var maaserRemain = Math.max(0, maaserObligation - maaserPaid);
    var html = '<div class="kpi-grid">' +
      '<div class="card"><div class="kpi-title">סה״כ הכנסות</div><div class="kpi-val" style="color:var(--success)">' + fmt(inc) + '</div></div>' +
      '<div class="card"><div class="kpi-title">סה״כ הוצאות</div><div class="kpi-val" style="color:var(--danger)">' + fmt(exp) + '</div></div>' +
      '<div class="card"><div class="kpi-title">יתרה כוללת</div><div class="kpi-val">' + fmt(inc - exp) + '</div></div>' +
      '<div class="card"><div class="kpi-title">יתרת מעשרות לתשלום (' + rate + '%)</div><div class="kpi-val" style="color:var(--amber)">' + fmt(maaserRemain) + '</div></div>' +
      '</div>';
    html += '<div class="tabs">' +
      '<button class="' + (activeTab==='overview'?'active':'') + '" onclick="setTab(\\'overview\\')">תנועות ותקציב</button>' +
      '<button class="' + (activeTab==='maaser'?'active':'') + '" onclick="setTab(\\'maaser\\')">מערכת מעשרות (' + fmt(maaserPaid) + ' שולם)</button>' +
      '</div>';
    if (activeTab === 'overview') {
      html += '<div class="card"><div class="form-row">' +
        '<select id="t-type"><option value="expense">הוצאה</option><option value="income">הכנסה</option></select>' +
        '<input id="t-cat" placeholder="קטגוריה (למשל מזון / משכורת)" />' +
        '<input id="t-amt" type="number" placeholder="סכום בש״ח" />' +
        '<input id="t-note" placeholder="הערה" style="flex:1" />' +
        '<button class="active" onclick="addTx()">+ הוסף תנועה</button>' +
        '</div><table><thead><tr><th>תאריך</th><th>סוג</th><th>קטגוריה</th><th>הערה</th><th>סכום</th><th></th></tr></thead><tbody>';
      (store.transactions || []).slice().reverse().forEach(function(t) {
        html += '<tr><td>' + t.date + '</td><td>' + (t.type==='income'?'הכנסה':'הוצאה') + '</td><td>' + t.categoryLabel + '</td><td>' + (t.note||'') + '</td><td style="font-weight:700;color:' + (t.type==='income'?'var(--success)':'var(--danger)') + '">' + fmt(t.amount) + '</td><td><button onclick="delTx(\\'' + t.id + '\\')">מחק</button></td></tr>';
      });
      html += '</tbody></table></div>';
    } else {
      html += '<div class="card"><div class="form-row">' +
        '<input id="m-rec" placeholder="שם עמותה / מוטב הצדקה" style="flex:1" />' +
        '<input id="m-amt" type="number" placeholder="סכום תרומה בש״ח" />' +
        '<input id="m-note" placeholder="הערה / מס׳ קבלה" style="flex:1" />' +
        '<button class="active" onclick="addMaaser()">+ תעד תרומת מעשר</button>' +
        '</div><table><thead><tr><th>תאריך</th><th>מוטב / עמותה</th><th>קטגוריה</th><th>הערה</th><th>סכום</th><th></th></tr></thead><tbody>';
      (store.maaserDonations || []).slice().reverse().forEach(function(d) {
        html += '<tr><td>' + d.date + '</td><td>' + d.recipient + '</td><td>' + d.categoryLabel + '</td><td>' + (d.note||'') + '</td><td style="font-weight:700;color:var(--primary)">' + fmt(d.amount) + '</td><td><button onclick="delMaaser(\\'' + d.id + '\\')">מחק</button></td></tr>';
      });
      html += '</tbody></table></div>';
    }
    document.getElementById('app').innerHTML = html;
  }
  window.setTab = function(t) { activeTab = t; render(); };
  window.addTx = function() {
    var type = document.getElementById('t-type').value;
    var cat = document.getElementById('t-cat').value || (type==='income'?'משכורת':'מזון');
    var amt = parseFloat(document.getElementById('t-amt').value);
    var note = document.getElementById('t-note').value;
    if (!amt || amt <= 0) return;
    store.transactions.push({ id: 'tx-'+Date.now(), type: type, category: 'custom', categoryLabel: cat, amount: amt, note: note, date: new Date().toISOString().slice(0,10), paymentMethod: 'credit', isMaaserEligible: true });
    saveStore(); render();
  };
  window.delTx = function(id) {
    store.transactions = store.transactions.filter(function(x){ return x.id !== id; });
    saveStore(); render();
  };
  window.addMaaser = function() {
    var rec = document.getElementById('m-rec').value || 'צדקה כללית';
    var amt = parseFloat(document.getElementById('m-amt').value);
    var note = document.getElementById('m-note').value;
    if (!amt || amt <= 0) return;
    store.maaserDonations.push({ id: 'ms-'+Date.now(), recipient: rec, category: 'general', categoryLabel: 'צדקה ומעשרות', amount: amt, date: new Date().toISOString().slice(0,10), paymentMethod: 'credit', status: 'paid', note: note });
    saveStore(); render();
  };
  window.delMaaser = function(id) {
    store.maaserDonations = store.maaserDonations.filter(function(x){ return x.id !== id; });
    saveStore(); render();
  };
  render();
</script>
</body>
</html>`;

  const mime = format === 'hta' ? 'application/hta;charset=utf-8;' : 'text/html;charset=utf-8;';
  const ext = format === 'hta' ? 'hta' : 'html';
  const blob = new Blob(['\ufeff' + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Budget-Maaser-Pro-Desktop.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
