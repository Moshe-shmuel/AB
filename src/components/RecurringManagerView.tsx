import React, { useMemo, useState } from 'react';
import {
  BellRing,
  CalendarCheck2,
  Check,
  Edit2,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import {
  CategoryItem,
  MaaserSettings,
  PaymentMethod,
  RecurringTemplate,
  Transaction,
  TransactionType,
} from '../types';
import { HE_MONTHS, PAYMENT_METHODS } from '../constants';
import { formatILS, getPaymentMethodLabel } from '../utils/portableExporter';

interface RecurringManagerViewProps {
  viewYear: number;
  viewMonth: number;
  templates: RecurringTemplate[];
  monthTransactions: Transaction[];
  allTransactions: Transaction[];
  expenseCategories: CategoryItem[];
  incomeCategories: CategoryItem[];
  maaserSettings: MaaserSettings;
  onAddTemplate: (tpl: Omit<RecurringTemplate, 'id'>) => void;
  onUpdateTemplate: (id: string, patch: Partial<RecurringTemplate>) => void;
  onDeleteTemplate: (id: string) => void;
  onGenerateTransactionFromTemplate: (
    tpl: RecurringTemplate,
    customAmount?: number
  ) => void;
  onGenerateAllPendingForMonth: (list: RecurringTemplate[]) => void;
  onSkipTemplateForMonth: (id: string, monthPrefix: string) => void;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export const RecurringManagerView: React.FC<RecurringManagerViewProps> = ({
  viewYear,
  viewMonth,
  templates,
  monthTransactions,
  allTransactions,
  expenseCategories,
  incomeCategories,
  maaserSettings,
  onAddTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onGenerateTransactionFromTemplate,
  onGenerateAllPendingForMonth,
  onSkipTemplateForMonth,
}) => {
  const monthPrefix = `${viewYear}-${pad(viewMonth + 1)}`;
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form state for new recurring template
  const [title, setTitle] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [category, setCategory] = useState('home');
  const [amount, setAmount] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credit');
  const [autoGenerate, setAutoGenerate] = useState<boolean>(true);
  const [isMaaserEligible, setIsMaaserEligible] = useState<boolean>(true);
  const [isDeductibleFromIncome, setIsDeductibleFromIncome] = useState<boolean>(false);
  const [isMaaserPayment, setIsMaaserPayment] = useState<boolean>(false);
  const [formError, setFormError] = useState('');

  // Custom override amounts when confirming a monthly reminder
  const [overrideAmounts, setOverrideAmounts] = useState<Record<string, string>>({});

  // Inline edit state for existing templates
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDay, setEditDay] = useState('1');

  const activeCategories = type === 'expense' ? expenseCategories : incomeCategories;

  React.useEffect(() => {
    if (!activeCategories.some((c) => c.id === category)) {
      setCategory(activeCategories[0]?.id || 'other');
    }
  }, [type, activeCategories, category]);

  const templateStatusMap = useMemo(() => {
    const map: Record<
      string,
      { isGenerated: boolean; isSkipped: boolean; matchedTx?: Transaction }
    > = {};

    for (const tpl of templates) {
      const isSkipped = (tpl.skippedMonths || []).includes(monthPrefix);
      const matchedTx = monthTransactions.find(
        (t) =>
          t.type === tpl.type &&
          t.category === tpl.category &&
          (t.note === tpl.title ||
            t.note.includes(tpl.title) ||
            (t.isRecurring && Math.abs(t.amount - tpl.amount) <= Math.max(25, tpl.amount * 0.15)))
      );
      map[tpl.id] = {
        isGenerated: Boolean(matchedTx) || tpl.lastGeneratedMonth === monthPrefix,
        isSkipped,
        matchedTx,
      };
    }
    return map;
  }, [templates, monthTransactions, monthPrefix]);

  const pendingTemplates = useMemo(
    () =>
      templates.filter(
        (t) =>
          t.active &&
          !templateStatusMap[t.id]?.isGenerated &&
          !templateStatusMap[t.id]?.isSkipped
      ),
    [templates, templateStatusMap]
  );

  const kpis = useMemo(() => {
    let fixedIncome = 0;
    let fixedExpense = 0;
    let autoCount = 0;
    let reminderCount = 0;

    for (const t of templates) {
      if (!t.active) continue;
      if (t.type === 'income') fixedIncome += t.amount;
      else fixedExpense += t.amount;
      if (t.autoGenerate) autoCount++;
      else reminderCount++;
    }

    const freeCashflow = fixedIncome - fixedExpense;
    const rigidityRatio =
      fixedIncome > 0 ? Math.round((fixedExpense / fixedIncome) * 100) : 0;

    return {
      fixedIncome,
      fixedExpense,
      freeCashflow,
      rigidityRatio,
      autoCount,
      reminderCount,
    };
  }, [templates]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = parseFloat(amount);
    const numDay = Math.min(28, Math.max(1, parseInt(dayOfMonth, 10) || 1));
    if (!title.trim()) {
      setFormError('נא להזין שם עבור ההוצאה או ההכנסה הקבועה');
      return;
    }
    if (!numAmt || numAmt <= 0) {
      setFormError('נא להזין סכום קבוע תקין הגדול מ-0');
      return;
    }
    setFormError('');
    const catObj = activeCategories.find((c) => c.id === category);

    onAddTemplate({
      title: title.trim(),
      type,
      category,
      categoryLabel: catObj ? catObj.label : category,
      amount: numAmt,
      dayOfMonth: numDay,
      paymentMethod,
      autoGenerate,
      active: true,
      isMaaserEligible: type === 'income' ? isMaaserEligible : undefined,
      isDeductibleFromIncome: type === 'expense' ? isDeductibleFromIncome : undefined,
      isMaaserPayment: type === 'expense' ? isMaaserPayment : undefined,
    });

    setTitle('');
    setAmount('');
    setIsAddModalOpen(false);
  };

  const handleImportFromExistingLedger = () => {
    const recurringInLedger = allTransactions.filter((t) => t.isRecurring);
    for (const tx of recurringInLedger) {
      const exists = templates.some(
        (tpl) =>
          tpl.type === tx.type &&
          tpl.category === tx.category &&
          (tpl.title === tx.note || Math.abs(tpl.amount - tx.amount) < 10)
      );
      if (!exists) {
        const day = Math.min(28, Math.max(1, parseInt(tx.date.slice(8, 10), 10) || 1));
        onAddTemplate({
          title: tx.note || tx.categoryLabel,
          type: tx.type,
          category: tx.category,
          categoryLabel: tx.categoryLabel,
          amount: tx.amount,
          dayOfMonth: day,
          paymentMethod: tx.paymentMethod,
          autoGenerate: true,
          active: true,
          isMaaserEligible: tx.isMaaserEligible,
          isDeductibleFromIncome: tx.isDeductibleFromIncome,
          isMaaserPayment: tx.isMaaserPayment,
          lastGeneratedMonth: tx.date.slice(0, 7),
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            הוראות קבע ותנועות חוזרות — {HE_MONTHS[viewMonth]} {viewYear}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ניהול תנועות שנוצרות אוטומטית בתחילת כל חודש ותזכורות לחשבונות תקופתיים
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleImportFromExistingLedger}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>סנכרן מיומן התנועות</span>
          </button>

          {pendingTemplates.length > 0 && (
            <button
              type="button"
              onClick={() => onGenerateAllPendingForMonth(pendingTemplates)}
              className="px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              <span>אשר והפק ממתינות ({pendingTemplates.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>הוראת קבע חדשה</span>
          </button>
        </div>
      </div>

      {/* Clean 3-Card Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-500">הכנסות קבועות בחודש</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1.5 font-mono-num tabular-nums">
            {formatILS(kpis.fixedIncome)}
          </div>
          <div className="text-xs text-slate-400 mt-1.5">
            סה״כ בסיס הכנסה קבוע
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-500">התחייבויות והוצאות קבועות</div>
          <div className="text-2xl font-bold text-rose-600 mt-1.5 font-mono-num tabular-nums">
            {formatILS(kpis.fixedExpense)}
          </div>
          <div className="text-xs text-slate-400 mt-1.5">
            {kpis.rigidityRatio}% מסך ההכנסה הקבועה
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-500">יתרה פנויה לאחר קבועות</div>
          <div
            className={`text-2xl font-bold mt-1.5 font-mono-num tabular-nums ${
              kpis.freeCashflow >= 0 ? 'text-slate-900' : 'text-rose-600'
            }`}
          >
            {formatILS(kpis.freeCashflow)}
          </div>
          <div className="text-xs text-slate-400 mt-1.5">
            {kpis.autoCount} אוטומטיות · {kpis.reminderCount} בתזכורת
          </div>
        </div>
      </div>

      {/* Pending Monthly Reminders (Clean & Compact) */}
      {pendingTemplates.length > 0 && (
        <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">
                ממתינות לאישור בחודש {HE_MONTHS[viewMonth]} ({pendingTemplates.length})
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              ניתן לעדכן את הסכום לחודש זה לפני האישור
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingTemplates.map((tpl) => {
              const currentOverride =
                overrideAmounts[tpl.id] !== undefined
                  ? overrideAmounts[tpl.id]
                  : String(tpl.amount);

              return (
                <div
                  key={tpl.id}
                  className="bg-white border border-slate-200/90 rounded-xl p-4 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-slate-900">{tpl.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {tpl.categoryLabel} · יום {tpl.dayOfMonth} בחודש
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <input
                      type="number"
                      value={currentOverride}
                      onChange={(e) =>
                        setOverrideAmounts((prev) => ({
                          ...prev,
                          [tpl.id]: e.target.value,
                        }))
                      }
                      className="w-24 px-2.5 py-1.5 text-xs font-bold font-mono-num bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        onGenerateTransactionFromTemplate(
                          tpl,
                          parseFloat(currentOverride) || tpl.amount
                        )
                      }
                      className="flex-1 py-1.5 px-3 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center justify-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>אשר</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSkipTemplateForMonth(tpl.id, monthPrefix)}
                      title="דלג החודש"
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full-Width Clean Table of Recurring Templates */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            רשימת הוראות קבע ותבניות ({templates.length})
          </h3>
        </div>

        {templates.length === 0 ? (
          <div className="text-center py-14 text-slate-400 text-sm">
            אין תבניות קבועות מוגדרות. לחצו על "הוראת קבע חדשה" כדי להוסיף.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-400 bg-slate-50/50">
                  <th className="py-3 px-6 text-right font-medium">יום בחודש</th>
                  <th className="py-3 px-4 text-right font-medium">סעיף וקטגוריה</th>
                  <th className="py-3 px-4 text-right font-medium">אופן הפקה</th>
                  <th className="py-3 px-4 text-right font-medium">סטטוס ב-{HE_MONTHS[viewMonth]}</th>
                  <th className="py-3 px-4 text-left font-medium">סכום</th>
                  <th className="py-3 px-6 text-left font-medium">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...templates]
                  .sort((a, b) => a.dayOfMonth - b.dayOfMonth)
                  .map((tpl) => {
                    const status = templateStatusMap[tpl.id];
                    const isEditing = editingId === tpl.id;

                    return (
                      <tr
                        key={tpl.id}
                        className={`hover:bg-slate-50/70 transition-colors ${
                          !tpl.active ? 'opacity-50' : ''
                        }`}
                      >
                        <td className="py-3.5 px-6 text-xs font-mono-num font-semibold text-slate-600 whitespace-nowrap">
                          {isEditing ? (
                            <input
                              type="number"
                              min="1"
                              max="28"
                              value={editDay}
                              onChange={(e) => setEditDay(e.target.value)}
                              className="w-14 px-2 py-1 border border-slate-300 rounded-lg font-mono-num"
                            />
                          ) : (
                            `ב-${tpl.dayOfMonth} לחודש`
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg w-full"
                            />
                          ) : (
                            <div>
                              <div className="font-semibold text-slate-900">{tpl.title}</div>
                              <div className="text-xs text-slate-400">
                                {tpl.categoryLabel} · {getPaymentMethodLabel(tpl.paymentMethod)}
                              </div>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-xs">
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateTemplate(tpl.id, { autoGenerate: !tpl.autoGenerate })
                            }
                            className="text-slate-600 hover:text-blue-600 font-medium underline decoration-dotted underline-offset-4"
                          >
                            {tpl.autoGenerate ? 'אוטומטי בתחילת חודש' : 'תזכורת לאישור'}
                          </button>
                        </td>

                        <td className="py-3.5 px-4 text-xs">
                          {status?.isGenerated ? (
                            <span className="text-emerald-600 font-semibold flex items-center gap-1">
                              <CalendarCheck2 className="w-3.5 h-3.5" />
                              <span>רשום ביומן</span>
                            </span>
                          ) : status?.isSkipped ? (
                            <span className="text-slate-400">דולג החודש</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onGenerateTransactionFromTemplate(tpl)}
                              className="text-amber-600 hover:underline font-semibold"
                            >
                              ממתין — הפק כעת
                            </button>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-left font-bold font-mono-num tabular-nums whitespace-nowrap">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              className="w-24 px-2 py-1 text-xs border border-slate-300 rounded-lg font-mono-num text-left"
                            />
                          ) : (
                            <span
                              className={
                                tpl.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                              }
                            >
                              {tpl.type === 'income' ? '+' : '−'}
                              {formatILS(tpl.amount)}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-6 text-left whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const numAmt = parseFloat(editAmount);
                                    const numDay = Math.min(
                                      28,
                                      Math.max(1, parseInt(editDay, 10) || 1)
                                    );
                                    if (numAmt > 0 && editTitle.trim()) {
                                      onUpdateTemplate(tpl.id, {
                                        title: editTitle.trim(),
                                        amount: numAmt,
                                        dayOfMonth: numDay,
                                      });
                                    }
                                    setEditingId(null);
                                  }}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded-lg"
                                >
                                  ביטול
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingId(tpl.id);
                                    setEditTitle(tpl.title);
                                    setEditAmount(String(tpl.amount));
                                    setEditDay(String(tpl.dayOfMonth));
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                                  aria-label="ערוך"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteTemplate(tpl.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
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

      {/* Add Recurring Template Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                הוספת הוצאה / הכנסה קבועה
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setType('expense')}
                  className={`py-2 text-xs font-bold rounded-lg transition-colors ${
                    type === 'expense'
                      ? 'bg-white text-rose-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  הוצאה קבועה (−)
                </button>
                <button
                  type="button"
                  onClick={() => setType('income')}
                  className={`py-2 text-xs font-bold rounded-lg transition-colors ${
                    type === 'income'
                      ? 'bg-white text-emerald-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  הכנסה קבועה (+)
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  תיאור הסעיף הקבוע
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="לדוגמה: משכנתא / גן ילדים / חשבון חשמל"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">קטגוריה</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-blue-600"
                  >
                    {activeCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    סכום חודשי (₪)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl font-mono-num focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    יום בחודש (1–28)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl font-mono-num focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    אמצעי תשלום
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-blue-600"
                  >
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm.id} value={pm.id}>
                        {pm.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="font-semibold text-slate-800">אופן הפקה בתחילת החודש:</div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="autoGenMode"
                    checked={autoGenerate}
                    onChange={() => setAutoGenerate(true)}
                    className="text-blue-600"
                  />
                  <span>יצירה אוטומטית בתחילת החודש</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="autoGenMode"
                    checked={!autoGenerate}
                    onChange={() => setAutoGenerate(false)}
                    className="text-blue-600"
                  />
                  <span>תזכורת לאישור ידני (מתאים לחשבונות משתנים)</span>
                </label>

                <div className="pt-2 border-t border-slate-200/70 space-y-1.5">
                  {type === 'income' ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isMaaserEligible}
                        onChange={(e) => setIsMaaserEligible(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600"
                      />
                      <span>חייב במעשר ({maaserSettings.ratePercent}%)</span>
                    </label>
                  ) : (
                    <>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isDeductibleFromIncome}
                          onChange={(e) => setIsDeductibleFromIncome(e.target.checked)}
                          className="rounded border-slate-300 text-blue-600"
                        />
                        <span>הוצאה מוכרת לניכוי לפני מעשר</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isMaaserPayment}
                          onChange={(e) => setIsMaaserPayment(e.target.checked)}
                          className="rounded border-slate-300 text-blue-600"
                        />
                        <span>נחשב כהוראת קבע למעשר / צדקה</span>
                      </label>
                    </>
                  )}
                </div>
              </div>

              {formError && <p className="text-xs font-medium text-rose-600">{formError}</p>}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
                >
                  שמור הוראת קבע
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
