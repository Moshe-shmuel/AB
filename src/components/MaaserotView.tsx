import React, { useMemo, useState } from 'react';
import {
  Calculator,
  Check,
  Download,
  Edit2,
  HeartHandshake,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  MaaserCategoryId,
  MaaserDonation,
  MaaserSettings,
  PaymentMethod,
  Transaction,
} from '../types';
import { HE_MONTHS, MAASER_CATEGORIES, PAYMENT_METHODS } from '../constants';
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

  // Modals / Drawers state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCalcOpen, setIsCalcOpen] = useState(false);

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRecipient, setEditRecipient] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');

  const scopedData = useMemo(() => {
    const isMonthly = settings.calculationScope === 'monthly';
    const txList = transactions.filter((t) =>
      isMonthly ? t.date.slice(0, 7) === monthPrefix : t.date.slice(0, 7) <= monthPrefix
    );
    const donList = donations.filter((d) =>
      isMonthly ? d.date.slice(0, 7) === monthPrefix : d.date.slice(0, 7) <= monthPrefix
    );

    let obligatedIncome = 0;
    let deductibleExpenses = 0;
    let directMaaserExpenses = 0;

    for (const t of txList) {
      if (t.type === 'income') {
        if (t.isMaaserEligible !== false) obligatedIncome += t.amount;
      } else {
        if (t.isDeductibleFromIncome) deductibleExpenses += t.amount;
        if (t.isMaaserPayment) directMaaserExpenses += t.amount;
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
        if (d.hasTaxCredit46) section46Total += d.amount;
      } else {
        pledgedDonations += d.amount;
      }
    }

    const remainingToPay = requiredMaaser - paidDonations;
    const estimatedTaxCredit35 = section46Total >= 207 ? section46Total * 0.35 : 0;

    return {
      obligatedIncome,
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
      setFormError('נא להזין שם מוטב או עמותה');
      return;
    }
    if (!numAmount || numAmount <= 0) {
      setFormError('נא להזין סכום תקין');
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
    setIsAddModalOpen(false);
  };

  const filteredDonations = useMemo(() => {
    return scopedData.donList
      .filter((d) => {
        if (statusFilter !== 'all' && d.status !== statusFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            d.recipient.toLowerCase().includes(q) ||
            (d.note || '').toLowerCase().includes(q) ||
            d.categoryLabel.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [scopedData.donList, statusFilter, searchQuery]);

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
    })).filter((x) => x.amount > 0);
  }, [scopedData.donList]);

  const calcNetBase = Math.max(0, (parseFloat(calcIncome) || 0) - (parseFloat(calcDeduct) || 0));

  return (
    <div className="space-y-8">
      {/* Clean Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Rate: 10% vs 20% */}
          <div className="inline-flex bg-slate-200/70 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, ratePercent: 10 })}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
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
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                settings.ratePercent === 20
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              חומש (20%)
            </button>
          </div>

          {/* Scope: Cumulative vs Monthly */}
          <div className="inline-flex bg-slate-200/70 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, calculationScope: 'cumulative' })}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                settings.calculationScope === 'cumulative'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              חישוב מצטבר
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, calculationScope: 'monthly' })}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                settings.calculationScope === 'monthly'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {HE_MONTHS[viewMonth]} בלבד
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsCalcOpen((v) => !v)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200/90 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-1.5"
          >
            <Calculator className="w-4 h-4 text-slate-500" />
            <span>מחשבון מהיר</span>
          </button>

          <button
            type="button"
            onClick={() => exportMaaserCSV(donations)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200/90 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-1.5"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>ייצוא CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (scopedData.remainingToPay > 0 && !amount) {
                setAmount(String(Math.round(scopedData.remainingToPay)));
              }
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>תרומה / נדר חדש</span>
          </button>
        </div>
      </div>

      {/* Collapsible Quick Calculator (Only shown when clicked) */}
      {isCalcOpen && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">סכום הכנסה נטו (₪)</label>
              <input
                type="number"
                value={calcIncome}
                onChange={(e) => setCalcIncome(e.target.value)}
                placeholder="למשל 10,000"
                className="w-40 px-3 py-2 text-sm border border-slate-200 rounded-xl font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">ניכוי הוצאות עסקה (₪)</label>
              <input
                type="number"
                value={calcDeduct}
                onChange={(e) => setCalcDeduct(e.target.value)}
                placeholder="0"
                className="w-40 px-3 py-2 text-sm border border-slate-200 rounded-xl font-mono-num"
              />
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div>
              <div className="text-xs text-slate-500">מעשר (10%)</div>
              <div className="text-lg font-bold text-blue-600 font-mono-num">
                {formatILS(calcNetBase * 0.1)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">חומש (20%)</div>
              <div className="text-lg font-bold text-indigo-600 font-mono-num">
                {formatILS(calcNetBase * 0.2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">נותר לאחר מעשר</div>
              <div className="text-lg font-bold text-emerald-600 font-mono-num">
                {formatILS(calcNetBase * 0.9)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4 Clean KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6">
          <div className="text-xs font-medium text-slate-500">בסיס הכנסה חייבת</div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono-num tabular-nums">
            {formatILS(scopedData.netObligatedBase)}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            {scopedData.deductibleExpenses > 0
              ? `לאחר קיזוז ${formatILS(scopedData.deductibleExpenses)} הוצאות עסק`
              : 'סה״כ הכנסות החייבות במעשר'}
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-6">
          <div className="text-xs font-medium text-slate-500">
            חובת הפרשה ({settings.ratePercent}%)
          </div>
          <div className="text-2xl font-bold text-blue-600 mt-2 font-mono-num tabular-nums">
            {formatILS(scopedData.requiredMaaser)}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.deductEarningExpenses}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, deductEarningExpenses: e.target.checked })
                }
                className="rounded border-slate-300 text-blue-600"
              />
              <span>קזז הוצאות ייצור הכנסה</span>
            </label>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-6">
          <div className="text-xs font-medium text-slate-500">שולם בפועל לצדקה</div>
          <div className="text-2xl font-bold text-emerald-600 mt-2 font-mono-num tabular-nums">
            {formatILS(scopedData.paidDonations)}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            החזר מס צפוי (סעיף 46):{' '}
            <span className="text-emerald-600 font-semibold font-mono-num">
              {formatILS(scopedData.estimatedTaxCredit35)}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-6">
          <div className="text-xs font-medium text-slate-500">
            {scopedData.remainingToPay >= 0 ? 'יתרה להפרשה' : 'יתרת זכות לעתיד'}
          </div>
          <div
            className={`text-2xl font-bold mt-2 font-mono-num tabular-nums ${
              scopedData.remainingToPay > 0 ? 'text-amber-600' : 'text-emerald-600'
            }`}
          >
            {formatILS(Math.abs(scopedData.remainingToPay))}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            {scopedData.pledgedDonations > 0
              ? `מתוכם ${formatILS(scopedData.pledgedDonations)} נדרים ממתינים`
              : 'אין נדרים פתוחים'}
          </div>
        </div>
      </div>

      {/* Main Content Split: Donations Table (8 cols) + Clean Mitzvah Breakdown (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-base font-bold text-slate-900">
              פנקס תרומות ונדרים ({filteredDonations.length})
            </h3>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="חיפוש מוטב או הערה..."
                  className="pr-9 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-blue-600 w-48"
                />
              </div>

              <div className="inline-flex bg-slate-100 p-1 rounded-xl text-xs">
                {(['all', 'paid', 'pledged'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      statusFilter === st
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {st === 'all' ? 'הכל' : st === 'paid' ? 'שולם' : 'נדרים'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredDonations.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-400">
              לא נמצאו תרומות או נדרים לתצוגה.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-400">
                    <th className="py-3.5 px-6 text-right font-medium">תאריך</th>
                    <th className="py-3.5 px-4 text-right font-medium">מוטב / עמותה</th>
                    <th className="py-3.5 px-4 text-right font-medium">פרטים</th>
                    <th className="py-3.5 px-4 text-right font-medium">סטטוס</th>
                    <th className="py-3.5 px-6 text-left font-medium">סכום</th>
                    <th className="py-3.5 px-4 text-left font-medium w-24"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDonations.map((d) => {
                    const isEditing = editingId === d.id;
                    return (
                      <tr key={d.id} className="group hover:bg-slate-50/70 transition-colors">
                        <td className="py-4 px-6 text-xs text-slate-500 font-mono-num whitespace-nowrap">
                          {d.date}
                        </td>
                        <td className="py-4 px-4 font-semibold text-slate-900">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editRecipient}
                              onChange={(e) => setEditRecipient(e.target.value)}
                              className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg w-full"
                            />
                          ) : (
                            d.recipient
                          )}
                        </td>
                        <td className="py-4 px-4 text-xs text-slate-500">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              placeholder="הערה..."
                              className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg w-full"
                            />
                          ) : (
                            <span>
                              {d.categoryLabel}
                              {d.hasTaxCredit46 ? ' · סעיף 46' : ''}
                              {d.note ? ` · ${d.note}` : ''}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-xs">
                          {d.status === 'paid' ? (
                            <span className="text-emerald-600 font-medium">שולם</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onUpdateDonation(d.id, { status: 'paid' })}
                              className="text-amber-600 hover:text-emerald-600 font-semibold underline underline-offset-4"
                            >
                              נדר — סמן כשולם
                            </button>
                          )}
                        </td>
                        <td className="py-4 px-6 text-left font-bold text-slate-900 font-mono-num tabular-nums whitespace-nowrap">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              className="px-2 py-1 text-xs border border-slate-300 rounded-lg w-24 text-left font-mono-num"
                            />
                          ) : (
                            formatILS(d.amount)
                          )}
                        </td>
                        <td className="py-4 px-4 text-left whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                            {isEditing ? (
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
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                              >
                                <Check className="w-4 h-4" />
                              </button>
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
                                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                                  aria-label="ערוך"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteDonation(d.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                  aria-label="מחק"
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

        {/* Mitzvah Breakdown Card (4 cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-6 space-y-5">
          <h3 className="text-base font-bold text-slate-900">התפלגות יעדי המצווה</h3>
          {categoryBreakdown.length === 0 ? (
            <p className="text-xs text-slate-400 py-4">טרם נרשמו תרומות ששולמו בתקופה זו.</p>
          ) : (
            <div className="space-y-4">
              {categoryBreakdown.map((item) => (
                <div key={item.id}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-700">{item.label}</span>
                    <span className="text-slate-500 font-mono-num">
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
          )}
        </div>
      </div>

      {/* Clean Modal for Adding a New Donation / Pledge */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <HeartHandshake className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">רישום תרומת מעשר או נדר</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setStatus('paid')}
                  className={`py-2 font-semibold rounded-lg transition-all ${
                    status === 'paid' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  שולם בפועל
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('pledged')}
                  className={`py-2 font-semibold rounded-lg transition-all ${
                    status === 'pledged' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  נדר / התחייבות לתשלום
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  שם המוטב / עמותה / ישיבה
                </label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="לדוגמה: קופת צדקה / ישיבה / הכנסת כלה"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    סכום (₪)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 font-mono-num"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    קטגוריית מצווה
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as MaaserCategoryId)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-blue-600"
                  >
                    {MAASER_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">תאריך</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    אמצעי תשלום
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white"
                  >
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm.id} value={pm.id}>
                        {pm.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  placeholder="מספר קבלה (אופציונלי)"
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl"
                />
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="הערה / הקדשה (אופציונלי)"
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center gap-5 pt-1 text-xs text-slate-600">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasTaxCredit46}
                    onChange={(e) => setHasTaxCredit46(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>מוכר לסעיף 46 (35% זיכוי מס)</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>הוראת קבע חודשית</span>
                </label>
              </div>

              {formError && <p className="text-xs font-medium text-red-600">{formError}</p>}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
                >
                  שמור תרומה
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
