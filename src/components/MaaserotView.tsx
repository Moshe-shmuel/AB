import React, { useState, useMemo } from 'react';
import {
  Check,
  Download,
  Edit2,
  HeartHandshake,
  Plus,
  Receipt,
  Scale,
  Search,
  Trash2,
  Calculator,
} from 'lucide-react';
import {
  MaaserCategoryId,
  MaaserDonation,
  MaaserSettings,
  PaymentMethod,
  Transaction,
} from '../types';
import { MAASER_CATEGORIES, PAYMENT_METHODS, HE_MONTHS } from '../constants';
import { exportMaaserCSV, formatILS, getPaymentMethodLabel } from '../utils/portableExporter';

interface MaaserotViewProps {
  viewYear: number;
  viewMonth: number;
  transactions: Transaction[];
  donations: MaaserDonation[];
  settings: MaaserSettings;
  onUpdateSettings: (next: MaaserSettings) => void;
  onAddDonation: (donation: Omit<MaaserDonation, 'id'>) => void;
  onUpdateDonation: (id: string, patch: Partial<MaaserDonation>) => void;
  onDeleteDonation: (id: string) => void;
}

export const MaaserotView: React.FC<MaaserotViewProps> = ({
  viewYear,
  viewMonth,
  transactions,
  donations,
  settings,
  onUpdateSettings,
  onAddDonation,
  onUpdateDonation,
  onDeleteDonation,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;

  // Donation form state
  const [recipient, setRecipient] = useState('');
  const [category, setCategory] = useState<MaaserCategoryId>('torah');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credit');
  const [status, setStatus] = useState<'paid' | 'pledged'>('paid');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [hasTaxCredit46, setHasTaxCredit46] = useState(true);
  const [isRecurring, setIsRecurring] = useState(false);
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');

  // Quick calculator state
  const [calcIncome, setCalcIncome] = useState('');
  const [calcDeduct, setCalcDeduct] = useState('');

  // Filter & editing state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pledged'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRecipient, setEditRecipient] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');

  // Filter transactions and donations based on scope (monthly vs cumulative up to selected month)
  const scopedData = useMemo(() => {
    const isMonthly = settings.calculationScope === 'monthly';
    const txList = transactions.filter((t) =>
      isMonthly ? t.date.slice(0, 7) === monthPrefix : t.date.slice(0, 7) <= monthPrefix
    );
    const donList = donations.filter((d) =>
      isMonthly ? d.date.slice(0, 7) === monthPrefix : d.date.slice(0, 7) <= monthPrefix
    );

    let obligatedIncome = 0;
    let exemptIncome = 0;
    let deductibleExpenses = 0;
    let directMaaserExpenses = 0;

    for (const t of txList) {
      if (t.type === 'income') {
        if (t.isMaaserEligible !== false) {
          obligatedIncome += t.amount;
        } else {
          exemptIncome += t.amount;
        }
      } else {
        if (t.isDeductibleFromIncome) {
          deductibleExpenses += t.amount;
        }
        if (t.isMaaserPayment) {
          directMaaserExpenses += t.amount;
        }
      }
    }

    const netObligatedBase = Math.max(
      0,
      obligatedIncome - (settings.deductEarningExpenses ? deductibleExpenses : 0)
    );
    const requiredMaaser =
      (netObligatedBase * settings.ratePercent) / 100 +
      (settings.calculationScope === 'cumulative' ? settings.openingBalance : 0);

    let paidDonations = directMaaserExpenses;
    let pledgedDonations = 0;
    let section46Total = 0;

    for (const d of donList) {
      if (d.status === 'paid') {
        paidDonations += d.amount;
        if (d.hasTaxCredit46) {
          section46Total += d.amount;
        }
      } else {
        pledgedDonations += d.amount;
      }
    }

    const remainingToPay = requiredMaaser - paidDonations;
    // Tax credit under Israeli Section 46 is 35% for donations above 207 ILS total per year
    const estimatedTaxCredit35 = section46Total >= 207 ? section46Total * 0.35 : 0;

    return {
      obligatedIncome,
      exemptIncome,
      deductibleExpenses,
      netObligatedBase,
      requiredMaaser,
      paidDonations,
      pledgedDonations,
      remainingToPay,
      section46Total,
      estimatedTaxCredit35,
      donList,
    };
  }, [transactions, donations, settings, monthPrefix]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!recipient.trim()) {
      setFormError('נא להזין שם מוטב / עמותה / יעד הצדקה');
      return;
    }
    if (!numAmount || numAmount <= 0) {
      setFormError('נא להזין סכום תרומה תקין הגדול מ-0');
      return;
    }
    setFormError('');
    const catObj = MAASER_CATEGORIES.find((c) => c.id === category);
    onAddDonation({
      recipient: recipient.trim(),
      category,
      categoryLabel: catObj ? catObj.label : 'צדקה כללית',
      amount: numAmount,
      date: date || todayStr,
      paymentMethod,
      status,
      receiptNumber: receiptNumber.trim() || undefined,
      hasTaxCredit46,
      isRecurring,
      note: note.trim() || undefined,
    });
    setRecipient('');
    setAmount('');
    setReceiptNumber('');
    setNote('');
  };

  const filteredDonations = useMemo(() => {
    return scopedData.donList
      .filter((d) => {
        if (statusFilter !== 'all' && d.status !== statusFilter) return false;
        if (categoryFilter !== 'all' && d.category !== categoryFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchRecipient = d.recipient.toLowerCase().includes(q);
          const matchNote = (d.note || '').toLowerCase().includes(q);
          const matchReceipt = (d.receiptNumber || '').toLowerCase().includes(q);
          if (!matchRecipient && !matchNote && !matchReceipt) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [scopedData.donList, statusFilter, categoryFilter, searchQuery]);

  // Mitzvah category breakdown
  const categoryBreakdown = useMemo(() => {
    const totals: Record<string, number> = {};
    let sum = 0;
    for (const d of scopedData.donList) {
      if (d.status === 'paid') {
        totals[d.category] = (totals[d.category] || 0) + d.amount;
        sum += d.amount;
      }
    }
    return MAASER_CATEGORIES.map((c) => ({
      ...c,
      amount: totals[c.id] || 0,
      pct: sum > 0 ? Math.round(((totals[c.id] || 0) / sum) * 100) : 0,
    })).sort((a, b) => b.amount - a.amount);
  }, [scopedData.donList]);

  const calcNetBase = Math.max(0, (parseFloat(calcIncome) || 0) - (parseFloat(calcDeduct) || 0));
  const calcMaaser10 = calcNetBase * 0.1;
  const calcChumash20 = calcNetBase * 0.2;

  return (
    <div className="space-y-6">
      {/* Top Configuration & Policy Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Scale className="w-5 h-5 text-blue-700" />
            <span>מערכת ניהול מעשרות, חומש וצדקה</span>
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            חישוב אוטומטי מהכנסות חייבות, מעקב נדרים והתחייבויות, וחישוב החזר מס משוער לפי סעיף 46
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Rate Selector: Maaser 10% vs Chumash 20% */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, ratePercent: 10 })}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                settings.ratePercent === 10
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              מעשר כספים (10%)
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, ratePercent: 20 })}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                settings.ratePercent === 20
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              חומש מהודר (20%)
            </button>
          </div>

          {/* Scope Selector: Cumulative vs Monthly */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, calculationScope: 'cumulative' })}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                settings.calculationScope === 'cumulative'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              מאזן מצטבר (רב-חודשי)
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, calculationScope: 'monthly' })}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                settings.calculationScope === 'monthly'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              חודש {HE_MONTHS[viewMonth]} בלבד
            </button>
          </div>

          <button
            type="button"
            onClick={() => exportMaaserCSV(donations)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ייצוא פנקס מעשרות (CSV)</span>
          </button>
        </div>
      </div>

      {/* 4-Column KPI Ledger Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">
            בסיס הכנסה חייבת במעשר ({settings.calculationScope === 'monthly' ? HE_MONTHS[viewMonth] : 'מצטבר'})
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1.5 font-mono-num tabular-nums">
            {formatILS(scopedData.netObligatedBase)}
          </div>
          <div className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
            <span>הכנסות: {formatILS(scopedData.obligatedIncome)}</span>
            {settings.deductEarningExpenses && scopedData.deductibleExpenses > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>ניכוי הוצאות עסק: −{formatILS(scopedData.deductibleExpenses)}</span>
              </>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">
            סה״כ חובת הפרשה ({settings.ratePercent}%)
          </div>
          <div className="text-2xl font-bold text-blue-700 mt-1.5 font-mono-num tabular-nums">
            {formatILS(scopedData.requiredMaaser)}
          </div>
          <div className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.deductEarningExpenses}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, deductEarningExpenses: e.target.checked })
                }
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>קזז הוצאות ייצור הכנסה</span>
            </label>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">שולם בפועל לצדקה ומעשרות</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1.5 font-mono-num tabular-nums">
            {formatILS(scopedData.paidDonations)}
          </div>
          <div className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
            <span>מוכר סעיף 46: {formatILS(scopedData.section46Total)}</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-700 font-medium">
              החזר מס (35%): {formatILS(scopedData.estimatedTaxCredit35)}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">
            {scopedData.remainingToPay >= 0
              ? 'יתרת מעשרות להפרשה'
              : 'יתרת זכות במעשרות (עודף תרומה)'}
          </div>
          <div
            className={`text-2xl font-bold mt-1.5 font-mono-num tabular-nums ${
              scopedData.remainingToPay > 0 ? 'text-amber-700' : 'text-emerald-700'
            }`}
          >
            {formatILS(Math.abs(scopedData.remainingToPay))}
          </div>
          <div className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
            {scopedData.pledgedDonations > 0 ? (
              <span className="text-amber-700 font-medium">
                ממתין לתשלום (נדרים): {formatILS(scopedData.pledgedDonations)}
              </span>
            ) : (
              <span>אין נדרים פתוחים הממתינים לתשלום</span>
            )}
          </div>
        </div>
      </div>

      {/* Main 2-Column Split: Left/Right Form + Breakdown & Quick Calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form to Add Donation / Pledge (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <HeartHandshake className="w-4 h-4 text-blue-700" />
              <span>תיעוד תרומת מעשר או התחייבות חדשה</span>
            </h3>
            {scopedData.remainingToPay > 0 && (
              <button
                type="button"
                onClick={() => setAmount(String(Math.round(scopedData.remainingToPay)))}
                className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0"
              >
                מלא יתרה לתשלום ({formatILS(scopedData.remainingToPay)})
              </button>
            )}
          </div>

          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  שם המוטב / עמותה / כולל
                </label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="לדוגמה: קופת העיר / ישיבה / הכנסת כלה"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  קטגוריית מצווה
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as MaaserCategoryId)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                >
                  {MAASER_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  סכום התרומה (₪)
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 font-mono-num"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">תאריך</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 font-mono-num"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  אמצעי תשלום
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                >
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  מספר קבלה / אסמכתא (אופציונלי)
                </label>
                <input
                  type="text"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  placeholder="מס׳ קבלה לצורכי מעקב ומס"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  הערה או הקדשה
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="לרפואה / להצלחה / הוראת קבע..."
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700">
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setStatus('paid')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      status === 'paid' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    שולם בפועל
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('pledged')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      status === 'pledged' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    נדר / התחייבות לתשלום
                  </button>
                </div>

                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasTaxCredit46}
                    onChange={(e) => setHasTaxCredit46(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>קבלה מוכרת לסעיף 46 (35% החזר מס)</span>
                </label>

                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>הוראת קבע חודשית</span>
                </label>
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>{status === 'paid' ? 'שמור תרומת מעשר' : 'שמור נדר / התחייבות'}</span>
              </button>
            </div>

            {formError && <p className="text-xs font-medium text-red-600">{formError}</p>}
          </form>
        </div>

        {/* Right Side: Mitzvah Breakdown + Instant Maaser Calculator (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Quick Maaser & Chumash Calculator */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
              <Calculator className="w-4 h-4 text-blue-700" />
              <span>מחשבון מעשר וחומש מהיר לעסקה / משכורת</span>
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">סכום הכנסה נטו (₪)</label>
                <input
                  type="number"
                  value={calcIncome}
                  onChange={(e) => setCalcIncome(e.target.value)}
                  placeholder="למשל 12,000"
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">ניכוי הוצאות עסקה (₪)</label>
                <input
                  type="number"
                  value={calcDeduct}
                  onChange={(e) => setCalcDeduct(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg font-mono-num"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center">
              <div className="p-2 bg-slate-50 rounded-lg">
                <div className="text-[11px] text-slate-500">מעשר (10%)</div>
                <div className="text-sm font-bold text-blue-700 font-mono-num tabular-nums">
                  {formatILS(calcMaaser10)}
                </div>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg">
                <div className="text-[11px] text-slate-500">חומש (20%)</div>
                <div className="text-sm font-bold text-indigo-700 font-mono-num tabular-nums">
                  {formatILS(calcChumash20)}
                </div>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg">
                <div className="text-[11px] text-slate-500">נותר לאחר מעשר</div>
                <div className="text-sm font-bold text-emerald-700 font-mono-num tabular-nums">
                  {formatILS(Math.max(0, calcNetBase - calcMaaser10))}
                </div>
              </div>
            </div>
          </div>

          {/* Mitzvah Distribution Breakdown */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              פילוח כספי המעשר לפי יעדי מצווה
            </h3>
            <div className="space-y-3">
              {categoryBreakdown.map((item) => (
                <div key={item.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-800">{item.label}</span>
                    <span className="text-slate-500 font-mono-num tabular-nums">
                      {formatILS(item.amount)} · {item.pct}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Donations & Pledges Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-slate-700" />
            <h3 className="text-base font-bold text-slate-900">
              פנקס תרומות, קבלות ונדרים ({filteredDonations.length})
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="חיפוש לפי עמותה, קבלה או הערה..."
                className="pr-9 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600 w-56"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
            >
              <option value="all">כל מטרות המצווה</option>
              {MAASER_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>

            <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs">
              {(['all', 'paid', 'pledged'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
                    statusFilter === st
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st === 'all' ? 'הכל' : st === 'paid' ? 'שולם' : 'נדרים לתשלום'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredDonations.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-sm">
            לא נמצאו תרומות או נדרים התואמים לסינון הנבחר.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 bg-slate-50/70">
                  <th className="py-2.5 px-3 text-right font-semibold">תאריך</th>
                  <th className="py-2.5 px-3 text-right font-semibold">מוטב / עמותה</th>
                  <th className="py-2.5 px-3 text-right font-semibold">קטגוריית מצווה ופרטים</th>
                  <th className="py-2.5 px-3 text-right font-semibold">אמצעי וקבלה</th>
                  <th className="py-2.5 px-3 text-right font-semibold">סטטוס</th>
                  <th className="py-2.5 px-3 text-left font-semibold">סכום</th>
                  <th className="py-2.5 px-3 text-left font-semibold">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDonations.map((d) => {
                  const isEditing = editingId === d.id;
                  return (
                    <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 text-xs text-slate-600 font-mono-num tabular-nums whitespace-nowrap">
                        {d.date}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-900">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editRecipient}
                            onChange={(e) => setEditRecipient(e.target.value)}
                            className="px-2 py-1 text-xs border border-slate-300 rounded w-full"
                          />
                        ) : (
                          d.recipient
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            placeholder="הערה..."
                            className="px-2 py-1 text-xs border border-slate-300 rounded w-full"
                          />
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-slate-800">{d.categoryLabel}</span>
                            {d.isRecurring && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-blue-700 font-medium">הוראת קבע</span>
                              </>
                            )}
                            {d.note && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-slate-500">{d.note}</span>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{getPaymentMethodLabel(d.paymentMethod)}</span>
                          {d.receiptNumber && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-num">קבלה #{d.receiptNumber}</span>
                            </>
                          )}
                          {d.hasTaxCredit46 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-emerald-700 font-medium">סעיף 46</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs">
                        {d.status === 'paid' ? (
                          <span className="text-emerald-700 font-semibold">שולם</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-amber-700 font-semibold">נדר / ממתין</span>
                            <button
                              type="button"
                              onClick={() => onUpdateDonation(d.id, { status: 'paid' })}
                              className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
                            >
                              סמן כשולם
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-left font-bold text-slate-900 font-mono-num tabular-nums whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="px-2 py-1 text-xs border border-slate-300 rounded w-24 text-left font-mono-num"
                          />
                        ) : (
                          formatILS(d.amount)
                        )}
                      </td>
                      <td className="py-3 px-3 text-left whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  const num = parseFloat(editAmount);
                                  if (num > 0 && editRecipient.trim()) {
                                    onUpdateDonation(d.id, {
                                      recipient: editRecipient.trim(),
                                      amount: num,
                                      note: editNote.trim() || undefined,
                                    });
                                  }
                                  setEditingId(null);
                                }}
                                className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded"
                                title="שמור"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded"
                              >
                                ביטול
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(d.id);
                                  setEditRecipient(d.recipient);
                                  setEditAmount(String(d.amount));
                                  setEditNote(d.note || '');
                                }}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                                aria-label="ערוך תרומה"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteDonation(d.id)}
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                                aria-label="מחק תרומה"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
