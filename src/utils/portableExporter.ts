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
    [
      'תאריך',
      'סוג',
      'קטגוריה',
      'סכום (₪)',
      'אמצעי תשלום',
      'חוזר/הוראת קבע',
      'חייב במעשר / מוכר למעשר',
      'הערה',
    ],
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
    [
      'תאריך',
      'מוטב / עמותה',
      'קטגוריית מצווה',
      'סכום (₪)',
      'סטטוס',
      'אמצעי תשלום',
      'מספר קבלה',
      'סעיף 46',
      'הוראת קבע',
      'הערה',
    ],
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
 * Bundles the actual running application (all active CSS + JS bundles + current user data)
 * into a single self-contained HTML file (`Budget-Maaser-Pro-SingleFile.html`).
 */
export async function exportStandaloneSingleFileHTML(
  payload: AppBackupPayload
): Promise<boolean> {
  try {
    const closeScriptTag = '</scr' + 'ipt>';
    const openScriptModuleTag = '<scr' + 'ipt type="module">';
    const openScriptTag = '<scr' + 'ipt>';
    const closeStyleTag = '</st' + 'yle>';
    const closeBodyTag = '</bo' + 'dy>';
    const closeHtmlTag = '</ht' + 'ml>';

    // 1. Collect all active CSS rules / stylesheets from the live document
    const cssChunks: string[] = [];

    const styleElements = Array.from(document.querySelectorAll('style'));
    for (const styleEl of styleElements) {
      if (styleEl.textContent) {
        cssChunks.push(styleEl.textContent);
      }
    }

    const linkElements = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
    );
    for (const linkEl of linkElements) {
      if (linkEl.href) {
        try {
          const res = await fetch(linkEl.href);
          if (res.ok) {
            cssChunks.push(await res.text());
          }
        } catch {
          // Ignore external stylesheet fetch failure
        }
      }
    }

    // 2. Collect the application's JS bundle
    const jsChunks: string[] = [];
    const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script'));
    for (const scriptEl of scripts) {
      if (scriptEl.src) {
        if (scriptEl.src.includes('@vite/client') || scriptEl.src.includes('@react-refresh')) {
          continue;
        }
        try {
          const res = await fetch(scriptEl.src);
          if (res.ok) {
            const text = await res.text();
            if (!scriptEl.src.endsWith('/src/main.tsx')) {
              jsChunks.push(text.split(closeScriptTag).join('<\\/scr' + 'ipt>'));
            }
          }
        } catch {
          // Ignore fetch failure
        }
      } else if (
        scriptEl.type === 'module' &&
        scriptEl.textContent &&
        !scriptEl.textContent.includes('injectIntoGlobalHook')
      ) {
        jsChunks.push(scriptEl.textContent.split(closeScriptTag).join('<\\/scr' + 'ipt>'));
      }
    }

    if (jsChunks.length === 0) {
      return false;
    }

    const safePayloadJson = JSON.stringify(payload).split(closeScriptTag).join('<\\/scr' + 'ipt>');

    const bootstrapStorageScript = [
      openScriptTag,
      '(function() {',
      '  try {',
      '    var SNAPSHOT = ' + safePayloadJson + ';',
      '    if (!localStorage.getItem("budget_pro:initialized_v4")) {',
      '      localStorage.setItem("budget_pro:initialized_v4", "true");',
      '      localStorage.setItem("budget_pro:transactions", JSON.stringify(SNAPSHOT.transactions || []));',
      '      localStorage.setItem("budget_pro:maaser_donations", JSON.stringify(SNAPSHOT.maaserDonations || []));',
      '      if (SNAPSHOT.maaserSettings) {',
      '        localStorage.setItem("budget_pro:maaser_settings", JSON.stringify(SNAPSHOT.maaserSettings));',
      '      }',
      '      localStorage.setItem("budget_pro:goals", JSON.stringify(SNAPSHOT.goals || {}));',
      '      localStorage.setItem("budget_pro:custom_categories", JSON.stringify(SNAPSHOT.customCategories || []));',
      '      localStorage.setItem("budget_pro:savings_funds", JSON.stringify(SNAPSHOT.savingsFunds || []));',
      '      localStorage.setItem("budget_pro:recurring_templates", JSON.stringify(SNAPSHOT.recurringTemplates || []));',
      '    }',
      '  } catch (e) {}',
      '})();',
      closeScriptTag,
    ].join('\n');

    const htmlDocument = [
      '<!doctype html>',
      '<html lang="he" dir="rtl">',
      '  <head>',
      '    <meta charset="UTF-8" />',
      '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
      '    <title>כלכלת הבית ומעשרות Pro</title>',
      '    <style>',
      cssChunks.join('\n\n'),
      '    ' + closeStyleTag,
      '  </head>',
      '  <body class="bg-slate-50 text-slate-900 antialiased selection:bg-blue-600 selection:text-white">',
      '    <div id="root"></div>',
      '    ' + bootstrapStorageScript,
      '    ' + jsChunks.map((code) => openScriptModuleTag + '\n' + code + '\n' + closeScriptTag).join('\n'),
      '  ' + closeBodyTag,
      closeHtmlTag,
    ].join('\n');

    const blob = new Blob(['\ufeff' + htmlDocument], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Budget-Maaser-Pro-SingleFile-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch {
    return false;
  }
}
