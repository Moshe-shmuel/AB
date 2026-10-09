import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  BellRing,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Edit2,
  Flame,
  HeartHandshake,
  LayoutDashboard,
  Monitor,
  PieChart,
  PiggyBank,
  Plus,
  Repeat,
  Search,
  Target,
  Trash2,
} from 'lucide-react';
import {
  ActiveTab,
  AppBackupPayload,
  CategoryItem,
  MaaserDonation,
  MaaserSettings,
  PaymentMethod,
  RecurringTemplate,
  SavingsFund,
  Transaction,
  TransactionType,
} from './types';
import {
  BADGE_THRESHOLDS,
  DEFAULT_EXPENSE_CATS,
  DEFAULT_INCOME_CATS,
  DEFAULT_MAASER_SETTINGS,
  HE_DAYS,
  HE_MONTHS,
  PAYMENT_METHODS,
  QUICK_EXPENSE_PRESETS,
  getSeedData,
} from './constants';
import {
  exportTransactionsCSV,
  formatILS,
  getPaymentMethodLabel,
} from './utils/portableExporter';
import { MaaserotView } from './components/MaaserotView';
import { DesktopExportModal } from './components/DesktopExportModal';
import { ForecastAndAnalyticsView } from './components/ForecastAndAnalyticsView';
import { RecurringManagerView } from './components/RecurringManagerView';
import {
  MotivationalPopupData,
  SavingsMotivatorPopup,
} from './components/SavingsMotivatorPopup';

const STORAGE_KEYS = {
  INITIALIZED: 'budget_pro:initialized_v4',
  TRANSACTIONS: 'budget_pro:transactions',
  MAASER_DONATIONS: 'budget_pro:maaser_donations',
  MAASER_SETTINGS: 'budget_pro:maaser_settings',
  GOALS: 'budget_pro:goals',
  CUSTOM_CATS: 'budget_pro:custom_categories',
  SAVINGS_FUNDS: 'budget_pro:savings_funds',
  RECURRING_TEMPLATES: 'budget_pro:recurring_templates',
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthKey(y: number, m: number): string {
  return `${y}-${pad(m + 1)}`;
}

function getWeekStart(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function App() {
  const today = useMemo(() => new Date(), []);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [viewYear, setViewYear] = useState<number>(today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(today.getMonth());
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Core Persistent State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [maaserDonations, setMaaserDonations] = useState<MaaserDonation[]>([]);
  const [maaserSettings, setMaaserSettings] = useState<MaaserSettings>(DEFAULT_MAASER_SETTINGS);
  const [goals, setGoals] = useState<Record<string, number>>({});
  const [customCategories, setCustomCategories] = useState<CategoryItem[]>([]);
  const [savingsFunds, setSavingsFunds] = useState<SavingsFund[]>([]);
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringTemplate[]>([]);
  const [motivationalPopup, setMotivationalPopup] = useState<MotivationalPopupData | null>(null);

  // Transaction Form State
  const [currentType, setCurrentType] = useState<TransactionType>('expense');
  const [selectedCategory, setSelectedCategory] = useState<string>('food');
  const [amountInput, setAmountInput] = useState<string>('');
  const [noteInput, setNoteInput] = useState<string>('');
  const [dateInput, setDateInput] = useState<string>(() => dateKey(new Date()));
  const [paymentMethodInput, setPaymentMethodInput] = useState<PaymentMethod>('credit');
  const [isRecurringInput, setIsRecurringInput] = useState<boolean>(false);
  const [isMaaserEligibleInput, setIsMaaserEligibleInput] = useState<boolean>(true);
  const [isDeductibleInput, setIsDeductibleInput] = useState<boolean>(false);
  const [isMaaserPaymentInput, setIsMaaserPaymentInput] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');

  // Overview Filtering & Inline Edit State
  const [filterText, setFilterText] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense' | 'recurring'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');

  // Calendar State
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Custom Category Creator State
  const [newCatLabel, setNewCatLabel] = useState<string>('');
  const [newCatType, setNewCatType] = useState<TransactionType>('expense');
  const [newCatColor, setNewCatColor] = useState<string>('#2563EB');

  // Savings Fund Form State
  const [newFundName, setNewFundName] = useState<string>('');
  const [newFundTarget, setNewFundTarget] = useState<string>('');
  const [newFundCurrent, setNewFundCurrent] = useState<string>('');

  // Load initial data from localStorage (or seed on first visit)
  useEffect(() => {
    try {
      const initialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
      const legacyTx = localStorage.getItem('budget:transactions');
      const legacyGoals = localStorage.getItem('budget:goals');

      if (!initialized) {
        const seed = getSeedData();
        if (legacyTx) {
          const parsedTx = JSON.parse(legacyTx);
          const parsedGoals = legacyGoals ? JSON.parse(legacyGoals) : seed.goals;
          setTransactions(parsedTx);
          setGoals(parsedGoals);
          setRecurringTemplates(seed.recurringTemplates);
        } else {
          setTransactions(seed.transactions);
          setMaaserDonations(seed.maaserDonations);
          setGoals(seed.goals);
          setSavingsFunds(seed.savingsFunds);
          setRecurringTemplates(seed.recurringTemplates);
          localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(seed.transactions));
          localStorage.setItem(STORAGE_KEYS.MAASER_DONATIONS, JSON.stringify(seed.maaserDonations));
          localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(seed.goals));
          localStorage.setItem(STORAGE_KEYS.SAVINGS_FUNDS, JSON.stringify(seed.savingsFunds));
          localStorage.setItem(STORAGE_KEYS.RECURRING_TEMPLATES, JSON.stringify(seed.recurringTemplates));
        }
        localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
      } else {
        const txRaw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
        const donRaw = localStorage.getItem(STORAGE_KEYS.MAASER_DONATIONS);
        const setRaw = localStorage.getItem(STORAGE_KEYS.MAASER_SETTINGS);
        const goalsRaw = localStorage.getItem(STORAGE_KEYS.GOALS);
        const catsRaw = localStorage.getItem(STORAGE_KEYS.CUSTOM_CATS);
        const fundsRaw = localStorage.getItem(STORAGE_KEYS.SAVINGS_FUNDS);
        const recRaw = localStorage.getItem(STORAGE_KEYS.RECURRING_TEMPLATES);

        if (txRaw) setTransactions(JSON.parse(txRaw));
        if (donRaw) setMaaserDonations(JSON.parse(donRaw));
        if (setRaw) setMaaserSettings(JSON.parse(setRaw));
        if (goalsRaw) setGoals(JSON.parse(goalsRaw));
        if (catsRaw) setCustomCategories(JSON.parse(catsRaw));
        if (fundsRaw) setSavingsFunds(JSON.parse(fundsRaw));
        if (recRaw) setRecurringTemplates(JSON.parse(recRaw));
      }
    } catch (e) {
      console.error('Failed loading state from localStorage:', e);
    }
  }, []);

  // Sync changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
      localStorage.setItem('budget:transactions', JSON.stringify(transactions));
    } catch {}
  }, [transactions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MAASER_DONATIONS, JSON.stringify(maaserDonations));
    } catch {}
  }, [maaserDonations]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MAASER_SETTINGS, JSON.stringify(maaserSettings));
    } catch {}
  }, [maaserSettings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));
      localStorage.setItem('budget:goals', JSON.stringify(goals));
    } catch {}
  }, [goals]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_CATS, JSON.stringify(customCategories));
    } catch {}
  }, [customCategories]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SAVINGS_FUNDS, JSON.stringify(savingsFunds));
    } catch {}
  }, [savingsFunds]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.RECURRING_TEMPLATES, JSON.stringify(recurringTemplates));
    } catch {}
  }, [recurringTemplates]);

  const expenseCategories = useMemo(
    () => [
      ...DEFAULT_EXPENSE_CATS,
      ...customCategories.filter((c) => c.type === 'expense'),
    ],
    [customCategories]
  );

  const incomeCategories = useMemo(
    () => [
      ...DEFAULT_INCOME_CATS,
      ...customCategories.filter((c) => c.type === 'income'),
    ],
    [customCategories]
  );

  const activeCategories = currentType === 'expense' ? expenseCategories : incomeCategories;

  // Keep selectedCategory valid when switching expense/income type
  useEffect(() => {
    if (!activeCategories.some((c) => c.id === selectedCategory)) {
      setSelectedCategory(activeCategories[0]?.id || 'other');
    }
  }, [currentType, activeCategories, selectedCategory]);

  // Month Navigation
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
    setSelectedDay(null);
  };

  const handleJumpToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelectedDay(dateKey(now));
  };

  // Current month transactions
  const currentMonthKey = monthKey(viewYear, viewMonth);
  const monthTransactions = useMemo(
    () => transactions.filter((t) => t.date.slice(0, 7) === currentMonthKey),
    [transactions, currentMonthKey]
  );

  // Monthly & Maaser Summary Metrics
  const summaryMetrics = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of monthTransactions) {
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
    }
    const balance = income - expense;
    const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;

    // Maaser calculation according to settings
    const isMonthlyScope = maaserSettings.calculationScope === 'monthly';
    const relevantTx = transactions.filter((t) =>
      isMonthlyScope ? t.date.slice(0, 7) === currentMonthKey : t.date.slice(0, 7) <= currentMonthKey
    );
    const relevantDon = maaserDonations.filter((d) =>
      isMonthlyScope ? d.date.slice(0, 7) === currentMonthKey : d.date.slice(0, 7) <= currentMonthKey
    );

    let maaserBase = 0;
    let maaserPaid = 0;
    for (const t of relevantTx) {
      if (t.type === 'income' && t.isMaaserEligible !== false) {
        maaserBase += t.amount;
      } else if (t.type === 'expense') {
        if (maaserSettings.deductEarningExpenses && t.isDeductibleFromIncome) {
          maaserBase -= t.amount;
        }
        if (t.isMaaserPayment) {
          maaserPaid += t.amount;
        }
      }
    }
    for (const d of relevantDon) {
      if (d.status === 'paid') maaserPaid += d.amount;
    }

    const maaserObligation =
      (Math.max(0, maaserBase) * maaserSettings.ratePercent) / 100 +
      (isMonthlyScope ? 0 : maaserSettings.openingBalance);
    const maaserRemaining = maaserObligation - maaserPaid;

    // End-of-month Run-Rate quick projection for Overview banner
    const daysInViewMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const isCurrentMonth =
      viewYear === today.getFullYear() && viewMonth === today.getMonth();
    const elapsedDays = isCurrentMonth ? Math.max(1, today.getDate()) : daysInViewMonth;
    const remainingDays = Math.max(0, daysInViewMonth - elapsedDays);

    let fixedSpent = 0;
    let variableSpent = 0;
    for (const t of monthTransactions) {
      if (t.type === 'expense') {
        if (t.isRecurring) fixedSpent += t.amount;
        else variableSpent += t.amount;
      }
    }
    const dailyVariableRunRate = variableSpent / elapsedDays;
    const projectedEndMonthExpense =
      fixedSpent + variableSpent + dailyVariableRunRate * remainingDays;
    const projectedEndMonthBalance = income - projectedEndMonthExpense;

    const totalGoals = Object.values(goals).reduce(
      (sum: number, val) => sum + (Number(val) || 0),
      0
    );
    const expectedMonthlyExpenseCap = totalGoals > 0 ? totalGoals : income * 0.8;
    const expectedSpendPaceToDate =
      fixedSpent +
      (Math.max(0, expectedMonthlyExpenseCap - fixedSpent) / daysInViewMonth) *
        elapsedDays;
    const savedVsPaceToDate = expectedSpendPaceToDate - expense;

    return {
      income,
      expense,
      balance,
      savingsRate,
      maaserObligation,
      maaserPaid,
      maaserRemaining,
      elapsedDays,
      remainingDays,
      dailyVariableRunRate,
      projectedEndMonthExpense,
      projectedEndMonthBalance,
      expectedSpendPaceToDate,
      savedVsPaceToDate,
    };
  }, [monthTransactions, transactions, maaserDonations, maaserSettings, currentMonthKey, viewYear, viewMonth, today, goals]);

  // Total Budget Goal Bar
  const totalGoalAmount = useMemo(
    () => Object.values(goals).reduce((sum: number, val) => sum + (Number(val) || 0), 0),
    [goals]
  );

  // Trigger motivational savings popup comparing actual savings vs expected monthly savings
  const triggerSavingsPopup = (customHeadline?: string, customMessage?: string) => {
    const actualSaved = summaryMetrics.balance;
    const projectedSavings = summaryMetrics.projectedEndMonthBalance;
    const vsPace = summaryMetrics.savedVsPaceToDate;

    const defaultHeadline =
      vsPace >= 0
        ? 'כל הכבוד! קצב החיסכון שלך מנצח את התחזית החודשית'
        : 'תמונת מצב חיסכון חודשי לעומת הצפי';

    const defaultMsg =
      vsPace >= 0
        ? `עד היום חסכתם ${formatILS(vsPace)} מעבר לקצב ההוצאה הצפוי לימים שחלפו בחודש ${HE_MONTHS[viewMonth]}. בקצב הנוכחי תסיימו את החודש עם יתרת חיסכון של ${formatILS(projectedSavings)}!`
        : `החיסכון נטו עד כה עומד על ${formatILS(actualSaved)} מתוך צפי סיום חודש של ${formatILS(projectedSavings)}. שמירה על תקציב יומי מתון ב-${summaryMetrics.remainingDays} הימים הנותרים תגדיל את החיסכון!`;

    setMotivationalPopup({
      id: `pop-${Date.now()}`,
      headline: customHeadline || defaultHeadline,
      message: customMessage || defaultMsg,
      actualSavedThisMonth: actualSaved,
      projectedEndMonthSavings: projectedSavings,
      savedVsPaceToDate: vsPace,
      savingsGoalTarget: Math.max(2500, summaryMetrics.income * 0.2),
    });
  };

  // Pending Recurring Templates for current viewed month
  const pendingMonthlyRecurring = useMemo(() => {
    return recurringTemplates.filter((tpl) => {
      if (!tpl.active) return false;
      if ((tpl.skippedMonths || []).includes(currentMonthKey)) return false;
      if (tpl.lastGeneratedMonth === currentMonthKey) return false;
      const alreadyInMonth = monthTransactions.some(
        (t) =>
          t.type === tpl.type &&
          t.category === tpl.category &&
          (t.note === tpl.title ||
            t.note.includes(tpl.title) ||
            (t.isRecurring && Math.abs(t.amount - tpl.amount) <= Math.max(25, tpl.amount * 0.15)))
      );
      return !alreadyInMonth;
    });
  }, [recurringTemplates, currentMonthKey, monthTransactions]);

  // Auto-generate recurring templates marked with `autoGenerate: true` when entering a new month
  useEffect(() => {
    const autoPending = pendingMonthlyRecurring.filter((tpl) => tpl.autoGenerate);
    if (autoPending.length === 0) return;

    const daysInViewMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const newTxs: Transaction[] = autoPending.map((tpl) => ({
      id: `auto-${currentMonthKey}-${tpl.id}-${Math.random().toString(36).slice(2, 6)}`,
      type: tpl.type,
      category: tpl.category,
      categoryLabel: tpl.categoryLabel,
      amount: tpl.amount,
      note: tpl.title,
      date: `${currentMonthKey}-${pad(Math.min(daysInViewMonth, tpl.dayOfMonth))}`,
      paymentMethod: tpl.paymentMethod,
      isRecurring: true,
      isMaaserEligible: tpl.isMaaserEligible,
      isDeductibleFromIncome: tpl.isDeductibleFromIncome,
      isMaaserPayment: tpl.isMaaserPayment,
    }));

    setTransactions((prev) => [...newTxs, ...prev]);
    setRecurringTemplates((prev) =>
      prev.map((item) =>
        autoPending.some((ap) => ap.id === item.id)
          ? { ...item, lastGeneratedMonth: currentMonthKey }
          : item
      )
    );
  }, [currentMonthKey, viewYear, viewMonth, pendingMonthlyRecurring]);

  const handleGenerateFromTemplate = (tpl: RecurringTemplate, customAmount?: number) => {
    const daysInViewMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const finalAmt = customAmount !== undefined ? customAmount : tpl.amount;
    const newTx: Transaction = {
      id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: tpl.type,
      category: tpl.category,
      categoryLabel: tpl.categoryLabel,
      amount: finalAmt,
      note: tpl.title,
      date: `${currentMonthKey}-${pad(Math.min(daysInViewMonth, tpl.dayOfMonth))}`,
      paymentMethod: tpl.paymentMethod,
      isRecurring: true,
      isMaaserEligible: tpl.isMaaserEligible,
      isDeductibleFromIncome: tpl.isDeductibleFromIncome,
      isMaaserPayment: tpl.isMaaserPayment,
    };

    setTransactions((prev) => [newTx, ...prev]);
    setRecurringTemplates((prev) =>
      prev.map((item) =>
        item.id === tpl.id ? { ...item, lastGeneratedMonth: currentMonthKey } : item
      )
    );
    triggerSavingsPopup(
      `תנועה קבועה נרשמה: ${tpl.title}`,
      `התנועה בסך ${formatILS(finalAmt)} נוספה ליומן ${HE_MONTHS[viewMonth]} והתחזית החודשית עודכנה.`
    );
  };

  const handleGenerateAllPendingForMonth = (list: RecurringTemplate[]) => {
    if (list.length === 0) return;
    const daysInViewMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const newTxs: Transaction[] = list.map((tpl) => ({
      id: `rec-batch-${Date.now()}-${tpl.id}`,
      type: tpl.type,
      category: tpl.category,
      categoryLabel: tpl.categoryLabel,
      amount: tpl.amount,
      note: tpl.title,
      date: `${currentMonthKey}-${pad(Math.min(daysInViewMonth, tpl.dayOfMonth))}`,
      paymentMethod: tpl.paymentMethod,
      isRecurring: true,
      isMaaserEligible: tpl.isMaaserEligible,
      isDeductibleFromIncome: tpl.isDeductibleFromIncome,
      isMaaserPayment: tpl.isMaaserPayment,
    }));

    setTransactions((prev) => [...newTxs, ...prev]);
    setRecurringTemplates((prev) =>
      prev.map((item) =>
        list.some((l) => l.id === item.id)
          ? { ...item, lastGeneratedMonth: currentMonthKey }
          : item
      )
    );
    triggerSavingsPopup(
      `${list.length} תנועות קבועות הופקו לחודש ${HE_MONTHS[viewMonth]}`,
      'כל ההוצאות וההכנסות הקבועות שוקללו בתזרים החודשי ובתחזית סוף החודש.'
    );
  };

  const handleSkipTemplateForMonth = (id: string, mPrefix: string) => {
    setRecurringTemplates((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, skippedMonths: [...(t.skippedMonths || []), mPrefix] }
          : t
      )
    );
  };

  // Add Transaction Handler
  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amountInput);
    if (!num || num <= 0) {
      setFormError('נא להזין סכום תקין הגדול מ-0');
      return;
    }
    setFormError('');
    const catObj = activeCategories.find((c) => c.id === selectedCategory);
    const newTx: Transaction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: currentType,
      category: selectedCategory,
      categoryLabel: catObj ? catObj.label : selectedCategory,
      amount: num,
      note: noteInput.trim(),
      date: dateInput || dateKey(new Date()),
      paymentMethod: paymentMethodInput,
      isRecurring: isRecurringInput,
      isMaaserEligible: currentType === 'income' ? isMaaserEligibleInput : undefined,
      isDeductibleFromIncome:
        currentType === 'expense'
          ? isDeductibleInput || selectedCategory === 'business_exp'
          : undefined,
      isMaaserPayment: currentType === 'expense' ? isMaaserPaymentInput : undefined,
    };

    setTransactions((prev) => [newTx, ...prev]);
    setAmountInput('');
    setNoteInput('');
    setIsDeductibleInput(false);
    setIsMaaserPaymentInput(false);

    // If user marked this new transaction as recurring, also add it to structured recurringTemplates if not existing
    if (isRecurringInput) {
      const dayNum = Math.min(28, Math.max(1, parseInt((dateInput || today.toISOString().slice(0, 10)).slice(8, 10), 10) || 1));
      setRecurringTemplates((prev) => {
        const exists = prev.some(
          (tpl) => tpl.type === newTx.type && tpl.category === newTx.category && tpl.title === (newTx.note || newTx.categoryLabel)
        );
        if (exists) return prev;
        return [
          ...prev,
          {
            id: `rec-tpl-${Date.now()}`,
            title: newTx.note || newTx.categoryLabel,
            type: newTx.type,
            category: newTx.category,
            categoryLabel: newTx.categoryLabel,
            amount: newTx.amount,
            dayOfMonth: dayNum,
            paymentMethod: newTx.paymentMethod,
            autoGenerate: true,
            active: true,
            isMaaserEligible: newTx.isMaaserEligible,
            isDeductibleFromIncome: newTx.isDeductibleFromIncome,
            isMaaserPayment: newTx.isMaaserPayment,
            lastGeneratedMonth: newTx.date.slice(0, 7),
          },
        ];
      });
    }

    // Trigger motivational savings popup after adding transaction
    setTimeout(() => {
      if (newTx.type === 'income') {
        triggerSavingsPopup(
          `הכנסה חדשה נוספה (+${formatILS(newTx.amount)})!`,
          `יתרת החיסכון בחודש ${HE_MONTHS[viewMonth]} עלתה ל-${formatILS(summaryMetrics.balance + newTx.amount)}. כדאי להקצות חלק ממנה לקרן חיסכון!`
        );
      } else {
        triggerSavingsPopup();
      }
    }, 60);
  };

  const handleDuplicateTx = (t: Transaction) => {
    const cloned: Transaction = {
      ...t,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: dateKey(new Date()),
    };
    setTransactions((prev) => [cloned, ...prev]);
    triggerSavingsPopup(
      `תנועה שוכפלה: ${t.categoryLabel}`,
      `התנועה בסך ${formatILS(t.amount)} שוכפלה לתאריך היום.`
    );
  };

  const handleSaveEditTx = (id: string) => {
    const num = parseFloat(editAmount);
    if (!num || num <= 0) return;
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, amount: num, note: editNote.trim(), date: editDate || t.date }
          : t
      )
    );
    setEditingId(null);
  };

  const handleDeleteTx = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  // Filtered Transactions for Overview
  const filteredTransactions = useMemo(() => {
    return monthTransactions
      .filter((t) => {
        if (filterType === 'income' && t.type !== 'income') return false;
        if (filterType === 'expense' && t.type !== 'expense') return false;
        if (filterType === 'recurring' && !t.isRecurring) return false;
        if (filterCategory !== 'all' && t.category !== filterCategory) return false;
        if (filterText.trim()) {
          const q = filterText.toLowerCase();
          const matchNote = (t.note || '').toLowerCase().includes(q);
          const matchCat = t.categoryLabel.toLowerCase().includes(q);
          if (!matchNote && !matchCat) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [monthTransactions, filterType, filterCategory, filterText]);

  // Savings Streak Computation (for Rewards Tab)
  const savingsStats = useMemo(() => {
    const byWeek: Record<string, { income: number; expense: number }> = {};
    for (const t of transactions) {
      const d = new Date(t.date + 'T00:00:00');
      const ws = getWeekStart(d);
      const key = dateKey(ws);
      if (!byWeek[key]) byWeek[key] = { income: 0, expense: 0 };
      if (t.type === 'income') byWeek[key].income += t.amount;
      else byWeek[key].expense += t.amount;
    }
    const currentWeekStart = dateKey(getWeekStart(today));
    const weekKeys = Object.keys(byWeek)
      .filter((k) => k <= currentWeekStart)
      .sort();

    let totalSavingsWeeks = 0;
    for (const k of weekKeys) {
      if (byWeek[k].income - byWeek[k].expense >= 0) totalSavingsWeeks++;
    }
    let streak = 0;
    for (let i = weekKeys.length - 1; i >= 0; i--) {
      const k = weekKeys[i];
      if (byWeek[k].income - byWeek[k].expense >= 0) streak++;
      else break;
    }
    return { total: totalSavingsWeeks, streak };
  }, [transactions, today]);

  // Backup Payload for Export Modal
  const backupPayload: AppBackupPayload = useMemo(
    () => ({
      version: '2.0',
      exportedAt: new Date().toISOString(),
      transactions,
      maaserDonations,
      maaserSettings,
      goals,
      customCategories,
      savingsFunds,
      recurringTemplates,
    }),
    [transactions, maaserDonations, maaserSettings, goals, customCategories, savingsFunds, recurringTemplates]
  );

  const handleImportBackup = (data: AppBackupPayload) => {
    if (Array.isArray(data.transactions)) setTransactions(data.transactions);
    if (Array.isArray(data.maaserDonations)) setMaaserDonations(data.maaserDonations);
    if (data.maaserSettings) setMaaserSettings(data.maaserSettings);
    if (data.goals) setGoals(data.goals);
    if (Array.isArray(data.customCategories)) setCustomCategories(data.customCategories);
    if (Array.isArray(data.savingsFunds)) setSavingsFunds(data.savingsFunds);
    if (Array.isArray(data.recurringTemplates)) setRecurringTemplates(data.recurringTemplates);
  };

  const handleResetEmpty = () => {
    setTransactions([]);
    setMaaserDonations([]);
    setGoals({});
    setCustomCategories([]);
    setSavingsFunds([]);
    setRecurringTemplates([]);
  };

  const handleLoadDemo = () => {
    const seed = getSeedData();
    setTransactions(seed.transactions);
    setMaaserDonations(seed.maaserDonations);
    setGoals(seed.goals);
    setSavingsFunds(seed.savingsFunds);
    setRecurringTemplates(seed.recurringTemplates);
  };

  const navItems: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'סקירה ותנועות', icon: LayoutDashboard },
    { id: 'recurring', label: `קבועות והוראות קבע (${pendingMonthlyRecurring.length})`, icon: Repeat },
    { id: 'forecast', label: 'חיזוי סוף חודש וניתוח', icon: Activity },
    { id: 'maaserot', label: 'מערכת מעשרות', icon: HeartHandshake },
    { id: 'calendar', label: 'לוח שנה', icon: CalendarIcon },
    { id: 'categories', label: 'קטגוריות', icon: PieChart },
    { id: 'goals', label: 'יעדי תקציב', icon: Target },
    { id: 'compare', label: 'השוואות', icon: BarChart3 },
    { id: 'rewards', label: 'תגמולים וחיסכון', icon: Award },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col" dir="rtl">
      {/* 3-Zone Top Bar Contract */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark (single text element) */}
          <a
            href="#overview"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('overview');
            }}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 font-display"
          >
            כלכלת הבית ומעשרות Pro
          </a>

          {/* Zone 2: Concise single-line navigation links */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#overview"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('overview');
              }}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'overview' ? 'text-blue-700 font-semibold underline underline-offset-8' : ''
              }`}
            >
              סקירה ותנועות
            </a>
            <a
              href="#forecast"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('forecast');
              }}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'forecast' ? 'text-blue-700 font-semibold underline underline-offset-8' : ''
              }`}
            >
              חיזוי סוף חודש
            </a>
            <a
              href="#maaserot"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('maaserot');
              }}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'maaserot' ? 'text-blue-700 font-semibold underline underline-offset-8' : ''
              }`}
            >
              מערכת מעשרות
            </a>
            <a
              href="#calendar"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('calendar');
              }}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'calendar' ? 'text-blue-700 font-semibold underline underline-offset-8' : ''
              }`}
            >
              לוח שנה
            </a>
            <a
              href="#goals"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('goals');
              }}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'goals' ? 'text-blue-700 font-semibold underline underline-offset-8' : ''
              }`}
            >
              יעדי תקציב
            </a>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-2"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>הורדת תוכנה שולחנית / גיבוי</span>
            </button>
          </div>
        </div>
      </header>

      {/* Workspace Sub-Toolbar: Full 7-Tab Bar & Month Navigator */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Interactive Segmented Tab Controls */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto max-w-full">
            {navItems.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setEditingId(null);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Month & Year Navigator + Quick CSV Export */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="חודש קודם"
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="min-w-[125px] text-center text-sm font-bold text-slate-900">
              {HE_MONTHS[viewMonth]} {viewYear}
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="חודש הבא"
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleJumpToday}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              החודש הנוכחי
            </button>

            <button
              type="button"
              onClick={() => triggerSavingsPopup()}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Award className="w-3.5 h-3.5" />
              <span>מדד חיסכון מול צפי</span>
            </button>

            <button
              type="button"
              onClick={() => exportTransactionsCSV(transactions)}
              title="ייצוא תנועות לקובץ CSV"
              className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ייצוא CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-6">
        {/* TAB 1: OVERVIEW & TRANSACTIONS */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 4-Column KPI Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-xs font-medium text-slate-500">
                  הכנסות ({HE_MONTHS[viewMonth]} {viewYear})
                </div>
                <div className="text-2xl font-bold text-emerald-700 mt-1.5 font-mono-num tabular-nums">
                  {formatILS(summaryMetrics.income)}
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  {monthTransactions.filter((t) => t.type === 'income').length} תנועות הכנסה החודש
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-xs font-medium text-slate-500">
                  הוצאות ({HE_MONTHS[viewMonth]} {viewYear})
                </div>
                <div className="text-2xl font-bold text-red-700 mt-1.5 font-mono-num tabular-nums">
                  {formatILS(summaryMetrics.expense)}
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  {monthTransactions.filter((t) => t.type === 'expense').length} תנועות הוצאה החודש
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-xs font-medium text-slate-500">יתרה חודשית נטו</div>
                <div
                  className={`text-2xl font-bold mt-1.5 font-mono-num tabular-nums ${
                    summaryMetrics.balance >= 0 ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {formatILS(summaryMetrics.balance)}
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  שיעור חיסכון חודשי: <span className="font-mono-num">{summaryMetrics.savingsRate}%</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">
                      קופת מעשרות ({maaserSettings.ratePercent}%)
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('maaserot')}
                      className="text-xs font-semibold text-blue-700 hover:underline"
                    >
                      לניהול מעשרות ←
                    </button>
                  </div>
                  <div
                    className={`text-2xl font-bold mt-1.5 font-mono-num tabular-nums ${
                      summaryMetrics.maaserRemaining > 0 ? 'text-amber-700' : 'text-emerald-700'
                    }`}
                  >
                    {formatILS(Math.abs(summaryMetrics.maaserRemaining))}
                  </div>
                </div>
                <div className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                  <span>
                    {summaryMetrics.maaserRemaining >= 0 ? 'נותר להפרשה' : 'יתרת זכות'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>שולם: {formatILS(summaryMetrics.maaserPaid)}</span>
                </div>
              </div>
            </div>

            {/* Total Monthly Budget Progress Bar & Live End-of-Month Run-Rate Strip */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {totalGoalAmount > 0 && (
                <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-semibold text-slate-700">
                      ניצול תקציב חודשי כולל (מול יעדי הקטגוריות)
                    </span>
                    <span className="font-mono-num tabular-nums text-slate-900 font-semibold">
                      {formatILS(summaryMetrics.expense)} מתוך {formatILS(totalGoalAmount)} (
                      {Math.round((summaryMetrics.expense / totalGoalAmount) * 100)}%)
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all rounded-full ${
                        summaryMetrics.expense / totalGoalAmount < 0.8
                          ? 'bg-emerald-600'
                          : summaryMetrics.expense / totalGoalAmount <= 1
                            ? 'bg-amber-500'
                            : 'bg-red-600'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.round((summaryMetrics.expense / totalGoalAmount) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <div
                className={`${
                  totalGoalAmount > 0 ? 'lg:col-span-6' : 'lg:col-span-12'
                } bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4`}
              >
                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-blue-700" />
                    <span>
                      תחזית סוף חודש לפי קצב ריצה יומי ({summaryMetrics.remainingDays} ימים נותרו)
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2 font-mono-num tabular-nums">
                    <span>
                      צפי הוצאות: <strong>{formatILS(summaryMetrics.projectedEndMonthExpense)}</strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      צפי יתרה בסוף החודש:{' '}
                      <strong
                        className={
                          summaryMetrics.projectedEndMonthBalance >= 0
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        }
                      >
                        {formatILS(summaryMetrics.projectedEndMonthBalance)}
                      </strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      קצב משתנות: {formatILS(summaryMetrics.dailyVariableRunRate)}/יום
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('forecast')}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  לניתוח חיזוי מלא וסימולטור ←
                </button>
              </div>
            </div>

            {/* Monthly Recurring Reminders Banner (if any recurring templates await user confirmation) */}
            {pendingMonthlyRecurring.length > 0 && (
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <BellRing className="w-5 h-5 text-amber-700 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      תזכורת תחילת חודש: {pendingMonthlyRecurring.length} הוצאות/הכנסות קבועות ממתינות לאישור בחודש {HE_MONTHS[viewMonth]}
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5 flex flex-wrap items-center gap-1.5">
                      {pendingMonthlyRecurring.slice(0, 4).map((tpl, i) => (
                        <React.Fragment key={tpl.id}>
                          {i > 0 && <span aria-hidden="true">·</span>}
                          <span>
                            {tpl.title} ({formatILS(tpl.amount)})
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleGenerateAllPendingForMonth(pendingMonthlyRecurring)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap"
                  >
                    אשר והפק את כולן ({pendingMonthlyRecurring.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('recurring')}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
                  >
                    נהל קבועות ותזכורות ←
                  </button>
                </div>
              </div>
            )}

            {/* Main 12-Col Split: Transaction Entry Form (4 cols) + Ledger Table (8 cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left/Right Column: New Transaction Form */}
              <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-slate-900">הוספת תנועה חדשה</h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('recurring')}
                    className="text-xs font-medium text-blue-700 hover:underline"
                  >
                    ניהול קבועות ←
                  </button>
                </div>

                {/* Quick Presets Bar */}
                <div className="mb-4">
                  <div className="text-[11px] text-slate-500 mb-1.5">מילוי מהיר בלחיצה:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_EXPENSE_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setCurrentType('expense');
                          setSelectedCategory(preset.category);
                          setAmountInput(String(preset.amount));
                          setNoteInput(preset.label);
                          setPaymentMethodInput(preset.paymentMethod);
                        }}
                        className="px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap"
                      >
                        {preset.label} ({preset.amount} ₪)
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleAddTransaction} className="space-y-4">
                  {/* Type Toggle */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setCurrentType('expense')}
                      className={`py-2 text-xs font-bold rounded-md transition-colors ${
                        currentType === 'expense'
                          ? 'bg-white text-red-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      הוצאה (−)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentType('income')}
                      className={`py-2 text-xs font-bold rounded-md transition-colors ${
                        currentType === 'income'
                          ? 'bg-white text-emerald-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      הכנסה (+)
                    </button>
                  </div>

                  {/* Category & Amount */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        קטגוריה
                      </label>
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
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
                        סכום בש״ח
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={amountInput}
                        onChange={(e) => setAmountInput(e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 font-mono-num"
                      />
                    </div>
                  </div>

                  {/* Date & Payment Method */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        תאריך תנועה
                      </label>
                      <input
                        type="date"
                        value={dateInput}
                        onChange={(e) => setDateInput(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 font-mono-num"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        אמצעי תשלום
                      </label>
                      <select
                        value={paymentMethodInput}
                        onChange={(e) => setPaymentMethodInput(e.target.value as PaymentMethod)}
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

                  {/* Note */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      הערה / פירוט (לא חובה)
                    </label>
                    <input
                      type="text"
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder="תיאור קצר של ההוצאה או ההכנסה"
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  {/* Maaser & Recurring Options */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-xs text-slate-700">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isRecurringInput}
                        onChange={(e) => setIsRecurringInput(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600"
                      />
                      <span>תנועה קבועה / הוראת קבע חודשית</span>
                    </label>

                    {currentType === 'income' ? (
                      <label className="flex items-center justify-between gap-2 cursor-pointer select-none pt-1 border-t border-slate-200/70">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isMaaserEligibleInput}
                            onChange={(e) => setIsMaaserEligibleInput(e.target.checked)}
                            className="rounded border-slate-300 text-blue-600"
                          />
                          <span className="font-medium text-slate-900">
                            חייב במעשר ({maaserSettings.ratePercent}%)
                          </span>
                        </div>
                        {isMaaserEligibleInput && parseFloat(amountInput) > 0 && (
                          <span className="text-blue-700 font-bold font-mono-num">
                            +{formatILS((parseFloat(amountInput) * maaserSettings.ratePercent) / 100)} למעשר
                          </span>
                        )}
                      </label>
                    ) : (
                      <>
                        <label className="flex items-center gap-2 cursor-pointer select-none pt-1 border-t border-slate-200/70">
                          <input
                            type="checkbox"
                            checked={isDeductibleInput || selectedCategory === 'business_exp'}
                            onChange={(e) => setIsDeductibleInput(e.target.checked)}
                            className="rounded border-slate-300 text-blue-600"
                          />
                          <span>הוצאת ייצור הכנסה (מנוכה מחישוב מעשר)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isMaaserPaymentInput}
                            onChange={(e) => setIsMaaserPaymentInput(e.target.checked)}
                            className="rounded border-slate-300 text-blue-600"
                          />
                          <span>נחשב כתשלום צדקה / מעשר כספים</span>
                        </label>
                      </>
                    )}
                  </div>

                  {formError && <div className="text-xs font-medium text-red-600">{formError}</div>}

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>הוסף תנועה ליומן</span>
                  </button>
                </form>
              </div>

              {/* Right/Left Column: Transactions List & Filters (8 cols) */}
              <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h2 className="text-base font-bold text-slate-900">
                    יומן תנועות — {HE_MONTHS[viewMonth]} {viewYear} ({filteredTransactions.length})
                  </h2>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                      <input
                        type="text"
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        placeholder="חיפוש בהערות או קטגוריה..."
                        className="pr-8 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600 w-48"
                      />
                    </div>

                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                    >
                      <option value="all">כל הקטגוריות</option>
                      {expenseCategories.concat(incomeCategories).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs">
                      {(
                        [
                          { id: 'all', label: 'הכל' },
                          { id: 'income', label: 'הכנסות' },
                          { id: 'expense', label: 'הוצאות' },
                          { id: 'recurring', label: 'קבועות' },
                        ] as const
                      ).map((ft) => (
                        <button
                          key={ft.id}
                          type="button"
                          onClick={() => setFilterType(ft.id)}
                          className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
                            filterType === ft.id
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {ft.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {filteredTransactions.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-sm">
                    אין תנועות תואמות לחודש או לסינון הנבחר.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs text-slate-500 bg-slate-50/70">
                          <th className="py-2.5 px-3 text-right font-semibold">תאריך</th>
                          <th className="py-2.5 px-3 text-right font-semibold">קטגוריה ופירוט</th>
                          <th className="py-2.5 px-3 text-right font-semibold">אמצעי ושיוך מעשר</th>
                          <th className="py-2.5 px-3 text-left font-semibold">סכום</th>
                          <th className="py-2.5 px-3 text-left font-semibold">פעולות</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredTransactions.map((t) => {
                          const isEditing = editingId === t.id;
                          return (
                            <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-3 text-xs text-slate-600 font-mono-num tabular-nums whitespace-nowrap">
                                {isEditing ? (
                                  <input
                                    type="date"
                                    value={editDate}
                                    onChange={(e) => setEditDate(e.target.value)}
                                    className="px-2 py-1 text-xs border border-slate-300 rounded font-mono-num"
                                  />
                                ) : (
                                  t.date
                                )}
                              </td>
                              <td className="py-3 px-3">
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
                                    <span className="font-semibold text-slate-900">
                                      {t.categoryLabel}
                                    </span>
                                    {t.note && (
                                      <>
                                        <span aria-hidden="true" className="text-slate-400">
                                          ·
                                        </span>
                                        <span className="text-slate-600 text-xs">{t.note}</span>
                                      </>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3 text-xs text-slate-500">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span>{getPaymentMethodLabel(t.paymentMethod)}</span>
                                  {t.isRecurring && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-blue-700 font-medium">קבוע</span>
                                    </>
                                  )}
                                  {t.type === 'income' && t.isMaaserEligible !== false && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-emerald-700 font-medium">
                                        מעשר:{' '}
                                        {formatILS((t.amount * maaserSettings.ratePercent) / 100)}
                                      </span>
                                    </>
                                  )}
                                  {t.type === 'expense' && t.isDeductibleFromIncome && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-amber-700 font-medium">
                                        מוכר לניכוי מעשר
                                      </span>
                                    </>
                                  )}
                                  {t.type === 'expense' && t.isMaaserPayment && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-blue-700 font-medium">נחשב כמעשר</span>
                                    </>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-left font-bold font-mono-num tabular-nums whitespace-nowrap">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    value={editAmount}
                                    onChange={(e) => setEditAmount(e.target.value)}
                                    className="px-2 py-1 text-xs border border-slate-300 rounded w-24 text-left font-mono-num"
                                  />
                                ) : (
                                  <span
                                    className={
                                      t.type === 'income' ? 'text-emerald-700' : 'text-red-700'
                                    }
                                  >
                                    {t.type === 'income' ? '+' : '−'}
                                    {formatILS(t.amount)}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-left whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1">
                                  {isEditing ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleSaveEditTx(t.id)}
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
                                        onClick={() => handleDuplicateTx(t)}
                                        className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded"
                                        title="שכפל תנועה זו להיום"
                                        aria-label="שכפל תנועה"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingId(t.id);
                                          setEditAmount(String(t.amount));
                                          setEditNote(t.note || '');
                                          setEditDate(t.date);
                                        }}
                                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                                        aria-label="ערוך תנועה"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteTx(t.id)}
                                        className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                                        aria-label="מחק תנועה"
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
          </div>
        )}

        {/* TAB 1.2: RECURRING TRANSACTIONS & STANDING ORDERS MANAGER */}
        {activeTab === 'recurring' && (
          <RecurringManagerView
            viewYear={viewYear}
            viewMonth={viewMonth}
            templates={recurringTemplates}
            monthTransactions={monthTransactions}
            allTransactions={transactions}
            expenseCategories={expenseCategories}
            incomeCategories={incomeCategories}
            maaserSettings={maaserSettings}
            onAddTemplate={(tpl) =>
              setRecurringTemplates((prev) => [
                ...prev,
                { ...tpl, id: `rec-tpl-${Date.now()}-${Math.random().toString(36).slice(2, 5)}` },
              ])
            }
            onUpdateTemplate={(id, patch) =>
              setRecurringTemplates((prev) =>
                prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
              )
            }
            onDeleteTemplate={(id) =>
              setRecurringTemplates((prev) => prev.filter((t) => t.id !== id))
            }
            onGenerateTransactionFromTemplate={handleGenerateFromTemplate}
            onGenerateAllPendingForMonth={handleGenerateAllPendingForMonth}
            onSkipTemplateForMonth={handleSkipTemplateForMonth}
          />
        )}

        {/* TAB 1.5: END-OF-MONTH FORECAST & SMART RUN-RATE ANALYTICS */}
        {activeTab === 'forecast' && (
          <ForecastAndAnalyticsView
            viewYear={viewYear}
            viewMonth={viewMonth}
            transactions={transactions}
            expenseCategories={expenseCategories}
            goals={goals}
            maaserSettings={maaserSettings}
            savingsFunds={savingsFunds}
            onQuickAddTransaction={(tx) =>
              setTransactions((prev) => [
                { ...tx, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
                ...prev,
              ])
            }
          />
        )}

        {/* TAB 2: MAASEROT & CHUMASH SYSTEM */}
        {activeTab === 'maaserot' && (
          <MaaserotView
            viewYear={viewYear}
            viewMonth={viewMonth}
            transactions={transactions}
            donations={maaserDonations}
            settings={maaserSettings}
            onUpdateSettings={setMaaserSettings}
            onAddDonation={(don) =>
              setMaaserDonations((prev) => [
                { ...don, id: `ms-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` },
                ...prev,
              ])
            }
            onUpdateDonation={(id, patch) =>
              setMaaserDonations((prev) =>
                prev.map((d) => (d.id === id ? { ...d, ...patch } : d))
              )
            }
            onDeleteDonation={(id) =>
              setMaaserDonations((prev) => prev.filter((d) => d.id !== id))
            }
          />
        )}

        {/* TAB 3: INTERACTIVE CALENDAR & HEATMAP */}
        {activeTab === 'calendar' && (
          <CalendarSection
            viewYear={viewYear}
            viewMonth={viewMonth}
            transactions={monthTransactions}
            maaserDonations={maaserDonations.filter(
              (d) => d.date.slice(0, 7) === currentMonthKey
            )}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            onDeleteTx={handleDeleteTx}
          />
        )}

        {/* TAB 4: CATEGORIES & CUSTOM CATEGORY CREATOR */}
        {activeTab === 'categories' && (
          <CategoriesSection
            viewYear={viewYear}
            viewMonth={viewMonth}
            monthTransactions={monthTransactions}
            expenseCategories={expenseCategories}
            incomeCategories={incomeCategories}
            newCatLabel={newCatLabel}
            setNewCatLabel={setNewCatLabel}
            newCatType={newCatType}
            setNewCatType={setNewCatType}
            newCatColor={newCatColor}
            setNewCatColor={setNewCatColor}
            onAddCustomCategory={(cat) => setCustomCategories((prev) => [...prev, cat])}
          />
        )}

        {/* TAB 5: BUDGET GOALS */}
        {activeTab === 'goals' && (
          <GoalsSection
            viewYear={viewYear}
            viewMonth={viewMonth}
            monthTransactions={monthTransactions}
            expenseCategories={expenseCategories}
            goals={goals}
            onUpdateGoal={(catId, val) => setGoals((prev) => ({ ...prev, [catId]: val }))}
          />
        )}

        {/* TAB 6: MULTI-PERIOD COMPARISONS */}
        {activeTab === 'compare' && (
          <CompareSection
            today={today}
            transactions={transactions}
            maaserDonations={maaserDonations}
          />
        )}

        {/* TAB 7: REWARDS, STREAKS & DEDICATED SAVINGS FUNDS */}
        {activeTab === 'rewards' && (
          <RewardsAndSavingsSection
            savingsStats={savingsStats}
            savingsFunds={savingsFunds}
            newFundName={newFundName}
            setNewFundName={setNewFundName}
            newFundTarget={newFundTarget}
            setNewFundTarget={setNewFundTarget}
            newFundCurrent={newFundCurrent}
            setNewFundCurrent={setNewFundCurrent}
            onAddFund={(fund) => setSavingsFunds((prev) => [...prev, fund])}
            onUpdateFundAmount={(id, delta) =>
              setSavingsFunds((prev) =>
                prev.map((f) =>
                  f.id === id
                    ? { ...f, currentAmount: Math.max(0, f.currentAmount + delta) }
                    : f
                )
              )
            }
            onDeleteFund={(id) => setSavingsFunds((prev) => prev.filter((f) => f.id !== id))}
          />
        )}
      </main>

      {/* Motivational Savings Popup (Actual vs Expected Monthly Savings) */}
      <SavingsMotivatorPopup
        popup={motivationalPopup}
        onDismiss={() => setMotivationalPopup(null)}
        primaryFund={savingsFunds[0]}
        onQuickDepositToFund={(fundId, amount) => {
          setSavingsFunds((prev) =>
            prev.map((f) =>
              f.id === fundId ? { ...f, currentAmount: f.currentAmount + amount } : f
            )
          );
          setTimeout(() => {
            triggerSavingsPopup(
              `הופקדו +${formatILS(amount)} לקרן החיסכון!`,
              `החיסכון ננעל בהצלחה בקרן הייעודית ומקדם אתכם ליעד הרב-שנתי.`
            );
          }, 80);
        }}
        onNavigateToForecast={() => setActiveTab('forecast')}
      />

      {/* Desktop App (.HTA / .HTML) & Backup Modal */}
      <DesktopExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        backupPayload={backupPayload}
        onImportBackup={handleImportBackup}
        onResetEmpty={handleResetEmpty}
        onLoadDemo={handleLoadDemo}
      />
    </div>
  );
}

/* ============================================================================
 * SUB-COMPONENTS FOR CALENDAR, CATEGORIES, GOALS, COMPARE, REWARDS
 * ============================================================================ */

function CalendarSection({
  viewYear,
  viewMonth,
  transactions,
  maaserDonations,
  selectedDay,
  onSelectDay,
  onDeleteTx,
}: {
  viewYear: number;
  viewMonth: number;
  transactions: Transaction[];
  maaserDonations: MaaserDonation[];
  selectedDay: string | null;
  onSelectDay: (day: string) => void;
  onDeleteTx: (id: string) => void;
}) {
  const { byDay, maxExpense } = useMemo(() => {
    const map: Record<string, { income: number; expense: number; maaser: number; count: number }> =
      {};
    let maxExp = 0;
    for (const t of transactions) {
      if (!map[t.date]) map[t.date] = { income: 0, expense: 0, maaser: 0, count: 0 };
      if (t.type === 'income') map[t.date].income += t.amount;
      else map[t.date].expense += t.amount;
      map[t.date].count++;
      if (map[t.date].expense > maxExp) maxExp = map[t.date].expense;
    }
    for (const d of maaserDonations) {
      if (!map[d.date]) map[d.date] = { income: 0, expense: 0, maaser: 0, count: 0 };
      map[d.date].maaser += d.amount;
      map[d.date].count++;
    }
    return { byDay: map, maxExpense: maxExp };
  }, [transactions, maaserDonations]);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const mk = monthKey(viewYear, viewMonth);

  const selectedDayTx = useMemo(
    () => (selectedDay ? transactions.filter((t) => t.date === selectedDay) : []),
    [transactions, selectedDay]
  );
  const selectedDayMaaser = useMemo(
    () => (selectedDay ? maaserDonations.filter((d) => d.date === selectedDay) : []),
    [maaserDonations, selectedDay]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">
            מפת חום ותזרים יומי — {HE_MONTHS[viewMonth]} {viewYear}
          </h2>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>הכנסה (+)</span>
            <span>·</span>
            <span>הוצאה יומית (עוצמת צבע)</span>
            <span>·</span>
            <span>תרומת מעשר</span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-2">
          {HE_DAYS.map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-slate-500 py-1">
              יום {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: firstDay }).map((_, idx) => (
            <div key={`empty-${idx}`} className="h-24 bg-slate-50/50 rounded-lg" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const dk = `${mk}-${pad(dayNum)}`;
            const info = byDay[dk];
            const intensity =
              info && info.expense > 0 && maxExpense > 0
                ? Math.max(0.08, Math.min(0.35, (info.expense / maxExpense) * 0.35))
                : 0;
            const isSelected = selectedDay === dk;

            return (
              <button
                key={dk}
                type="button"
                onClick={() => onSelectDay(dk)}
                style={{
                  backgroundColor:
                    intensity > 0 ? `rgba(216, 90, 48, ${intensity.toFixed(2)})` : undefined,
                }}
                className={`h-24 p-2 rounded-lg border text-right flex flex-col justify-between transition-all ${
                  isSelected
                    ? 'border-blue-600 ring-2 ring-blue-600/20 bg-white'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold text-slate-800 font-mono-num">{dayNum}</span>
                  {info && info.count > 0 && (
                    <span className="text-[10px] text-slate-500">{info.count} פע׳</span>
                  )}
                </div>

                <div className="space-y-0.5 w-full overflow-hidden">
                  {info?.income ? (
                    <div className="text-[11px] font-bold text-emerald-700 font-mono-num truncate">
                      +{Math.round(info.income).toLocaleString('he-IL')} ₪
                    </div>
                  ) : null}
                  {info?.expense ? (
                    <div className="text-[11px] font-bold text-red-700 font-mono-num truncate">
                      −{Math.round(info.expense).toLocaleString('he-IL')} ₪
                    </div>
                  ) : null}
                  {info?.maaser ? (
                    <div className="text-[10px] font-semibold text-blue-700 font-mono-num truncate">
                      מעשר: {Math.round(info.maaser).toLocaleString('he-IL')} ₪
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Inspector (4 cols) */}
      <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="text-base font-bold text-slate-900 mb-3">
          {selectedDay ? `פירוט תנועות לתאריך ${selectedDay}` : 'בחרו יום בלוח השנה'}
        </h3>

        {!selectedDay ? (
          <p className="text-xs text-slate-500 py-8 text-center">
            לחצו על כל משבצת יום בלוח השנה כדי לצפות בתנועות ההכנסה, ההוצאה והמעשרות של אותו יום.
          </p>
        ) : selectedDayTx.length === 0 && selectedDayMaaser.length === 0 ? (
          <p className="text-xs text-slate-500 py-8 text-center">אין תנועות מתועדות ביום זה.</p>
        ) : (
          <div className="space-y-2.5">
            {selectedDayTx.map((t) => (
              <div
                key={t.id}
                className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-900">{t.categoryLabel}</div>
                  {t.note && <div className="text-slate-500 mt-0.5">{t.note}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-bold font-mono-num ${
                      t.type === 'income' ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {t.type === 'income' ? '+' : '−'}
                    {formatILS(t.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeleteTx(t.id)}
                    className="p-1 text-slate-400 hover:text-red-600"
                    aria-label="מחק תנועה"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {selectedDayMaaser.map((d) => (
              <div
                key={d.id}
                className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-blue-900">מעשר: {d.recipient}</div>
                  <div className="text-blue-700 mt-0.5">{d.categoryLabel}</div>
                </div>
                <span className="font-bold text-blue-800 font-mono-num">{formatILS(d.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CategoriesSection({
  viewYear,
  viewMonth,
  monthTransactions,
  expenseCategories,
  incomeCategories,
  newCatLabel,
  setNewCatLabel,
  newCatType,
  setNewCatType,
  newCatColor,
  setNewCatColor,
  onAddCustomCategory,
}: {
  viewYear: number;
  viewMonth: number;
  monthTransactions: Transaction[];
  expenseCategories: CategoryItem[];
  incomeCategories: CategoryItem[];
  newCatLabel: string;
  setNewCatLabel: (v: string) => void;
  newCatType: TransactionType;
  setNewCatType: (t: TransactionType) => void;
  newCatColor: string;
  setNewCatColor: (c: string) => void;
  onAddCustomCategory: (cat: CategoryItem) => void;
}) {
  const expenseTx = monthTransactions.filter((t) => t.type === 'expense');
  const totalExpense = expenseTx.reduce((s, t) => s + t.amount, 0);

  const byCat = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of expenseTx) {
      map[t.category] = (map[t.category] || 0) + t.amount;
    }
    return expenseCategories
      .map((c) => ({
        ...c,
        amount: map[c.id] || 0,
        pct: totalExpense > 0 ? Math.round(((map[c.id] || 0) / totalExpense) * 100) : 0,
      }))
      .filter((x) => x.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [expenseTx, expenseCategories, totalExpense]);

  const circumference = 2 * Math.PI * 52;
  let strokeOffset = 0;

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatLabel.trim()) return;
    onAddCustomCategory({
      id: `custom-${Date.now()}`,
      label: newCatLabel.trim(),
      color: newCatColor,
      type: newCatType,
      defaultMaaserEligible: newCatType === 'income',
    });
    setNewCatLabel('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-bold text-slate-900 mb-6">
          פילוח הוצאות לפי קטגוריה — {HE_MONTHS[viewMonth]} {viewYear}
        </h2>

        <div className="flex flex-col md:flex-row items-center gap-8">
          <svg
            viewBox="0 0 140 140"
            width="180"
            height="180"
            className="shrink-0"
            role="img"
            aria-label="תרשים עוגה לפילוח הוצאות"
          >
            <circle cx="70" cy="70" r="52" fill="none" stroke="#f1f5f9" strokeWidth="18" />
            {totalExpense > 0 && (
              <g transform="rotate(-90 70 70)">
                {byCat.map((item) => {
                  const dash = (item.amount / totalExpense) * circumference;
                  const currentOffset = strokeOffset;
                  strokeOffset += dash;
                  return (
                    <circle
                      key={item.id}
                      cx="70"
                      cy="70"
                      r="52"
                      fill="none"
                      stroke={item.color}
                      strokeWidth="18"
                      strokeDasharray={`${dash} ${circumference - dash}`}
                      strokeDashoffset={-currentOffset}
                    />
                  );
                })}
              </g>
            )}
            <text
              x="70"
              y="68"
              textAnchor="middle"
              className="text-xs font-bold fill-slate-900 font-mono-num"
            >
              {totalExpense > 0 ? formatILS(totalExpense) : '—'}
            </text>
            <text x="70" y="84" textAnchor="middle" className="text-[10px] fill-slate-500">
              סה״כ הוצאות
            </text>
          </svg>

          <div className="flex-1 w-full space-y-3.5">
            {byCat.length === 0 ? (
              <div className="text-sm text-slate-500">אין הוצאות מתועדות בחודש זה.</div>
            ) : (
              byCat.map((item) => (
                <div key={item.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-800">{item.label}</span>
                    <span className="text-slate-600 font-mono-num tabular-nums">
                      {formatILS(item.amount)} · {item.pct}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round((item.amount / byCat[0].amount) * 100)}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Custom Category Builder (4 cols) */}
      <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h3 className="text-base font-bold text-slate-900">הוספת קטגוריה מותאמת אישית</h3>
        <p className="text-xs text-slate-500">
          התאימו את התוכנה למשק הבית או לעסק שלכם עם קטגוריות הכנסה והוצאה משלכם.
        </p>

        <form onSubmit={handleCreateCategory} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">שם הקטגוריה</label>
            <input
              type="text"
              value={newCatLabel}
              onChange={(e) => setNewCatLabel(e.target.value)}
              placeholder="לדוגמה: חוגי ילדים / שכר דירה"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">סוג</label>
              <select
                value={newCatType}
                onChange={(e) => setNewCatType(e.target.value as TransactionType)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="expense">הוצאה</option>
                <option value="income">הכנסה</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">צבע זיהוי</label>
              <input
                type="color"
                value={newCatColor}
                onChange={(e) => setNewCatColor(e.target.value)}
                className="w-full h-9 p-1 border border-slate-300 rounded-lg cursor-pointer bg-white"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 px-4 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors"
          >
            + שמור קטגוריה חדשה
          </button>
        </form>

        <div className="pt-3 border-t border-slate-100">
          <div className="text-xs font-semibold text-slate-700 mb-2">
            סה״כ קטגוריות פעילות: {expenseCategories.length} הוצאה · {incomeCategories.length} הכנסה
          </div>
        </div>
      </div>
    </div>
  );
}

function GoalsSection({
  viewYear,
  viewMonth,
  monthTransactions,
  expenseCategories,
  goals,
  onUpdateGoal,
}: {
  viewYear: number;
  viewMonth: number;
  monthTransactions: Transaction[];
  expenseCategories: CategoryItem[];
  goals: Record<string, number>;
  onUpdateGoal: (catId: string, val: number) => void;
}) {
  const spentByCat = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of monthTransactions) {
      if (t.type === 'expense') {
        map[t.category] = (map[t.category] || 0) + t.amount;
      }
    }
    return map;
  }, [monthTransactions]);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            יעדי תקציב חודשיים לפי קטגוריה — {HE_MONTHS[viewMonth]} {viewYear}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            קבעו תקרת הוצאה לכל סעיף ועקבו בזמן אמת אחר קצב הניצול או חריגות
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {expenseCategories.map((c) => {
          const goal = Number(goals[c.id]) || 0;
          const spent = spentByCat[c.id] || 0;
          const pct = goal > 0 ? Math.min(100, Math.round((spent / goal) * 100)) : 0;
          const isOver = goal > 0 && spent > goal;

          return (
            <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-900">{c.label}</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={goal || ''}
                    placeholder="הגדר יעד"
                    onChange={(e) => onUpdateGoal(c.id, parseFloat(e.target.value) || 0)}
                    className="w-24 px-2.5 py-1 text-xs border border-slate-300 rounded-lg font-mono-num text-left"
                  />
                  <span className="text-xs text-slate-500">₪</span>
                </div>
              </div>

              {goal > 0 ? (
                <>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct < 80 ? 'bg-emerald-600' : !isOver ? 'bg-amber-500' : 'bg-red-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-mono-num tabular-nums">
                      {formatILS(spent)} מתוך {formatILS(goal)} ({pct}%)
                    </span>
                    {isOver ? (
                      <span className="text-red-600 font-semibold font-mono-num">
                        חריגה: {formatILS(spent - goal)}
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-medium font-mono-num">
                        נותר: {formatILS(goal - spent)}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-500 flex items-center justify-between pt-1">
                  <span>הוצאה בפועל החודש: {formatILS(spent)}</span>
                  {spent > 0 && (
                    <button
                      type="button"
                      onClick={() => onUpdateGoal(c.id, Math.ceil(spent / 100) * 100)}
                      className="text-blue-700 hover:underline font-medium"
                    >
                      קבע {formatILS(Math.ceil(spent / 100) * 100)} כיעד
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompareSection({
  today,
  transactions,
  maaserDonations,
}: {
  today: Date;
  transactions: Transaction[];
  maaserDonations: MaaserDonation[];
}) {
  const weeks = useMemo(() => {
    const arr = [];
    const cursor = getWeekStart(today);
    for (let i = 7; i >= 0; i--) {
      const ws = new Date(cursor);
      ws.setDate(ws.getDate() - 7 * i);
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      const wkTx = transactions.filter((t) => {
        const d = new Date(t.date + 'T00:00:00');
        return d >= ws && d <= we;
      });
      let income = 0;
      let expense = 0;
      for (const t of wkTx) {
        if (t.type === 'income') income += t.amount;
        else expense += t.amount;
      }
      arr.push({
        label: `${ws.getDate()}/${ws.getMonth() + 1}`,
        income,
        expense,
      });
    }
    return arr;
  }, [today, transactions]);

  const months = useMemo(() => {
    const arr = [];
    for (let m = 5; m >= 0; m--) {
      const d = new Date(today.getFullYear(), today.getMonth() - m, 1);
      const mk = monthKey(d.getFullYear(), d.getMonth());
      const mtx = transactions.filter((t) => t.date.slice(0, 7) === mk);
      const mdon = maaserDonations.filter(
        (don) => don.date.slice(0, 7) === mk && don.status === 'paid'
      );
      let income = 0;
      let expense = 0;
      let maaser = 0;
      for (const t of mtx) {
        if (t.type === 'income') income += t.amount;
        else expense += t.amount;
      }
      for (const don of mdon) {
        maaser += don.amount;
      }
      arr.push({
        label: HE_MONTHS[d.getMonth()],
        income,
        expense,
        maaser,
      });
    }
    return arr;
  }, [today, transactions, maaserDonations]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900">השוואת 8 שבועות אחרונים</h3>
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="text-emerald-700 font-semibold">■ הכנסות</span>
              <span className="text-red-600 font-semibold">■ הוצאות</span>
            </div>
          </div>
          <SvgBarChart periods={weeks} height={200} />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900">השוואת 6 חודשים אחרונים</h3>
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="text-emerald-700 font-semibold">■ הכנסות</span>
              <span className="text-red-600 font-semibold">■ הוצאות</span>
            </div>
          </div>
          <SvgBarChart periods={months} height={200} />
        </div>
      </div>

      {/* 6-Month Numeric Comparison Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="text-base font-bold text-slate-900 mb-4">
          טבלת השוואה רב-חודשית (הכנסות, הוצאות, מעשרות וחיסכון נטו)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500 bg-slate-50">
                <th className="py-2.5 px-3 text-right font-semibold">חודש</th>
                <th className="py-2.5 px-3 text-left font-semibold">הכנסות</th>
                <th className="py-2.5 px-3 text-left font-semibold">הוצאות</th>
                <th className="py-2.5 px-3 text-left font-semibold">מעשרות ששולמו</th>
                <th className="py-2.5 px-3 text-left font-semibold">יתרה נטו</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {months.map((m) => {
                const net = m.income - m.expense;
                return (
                  <tr key={m.label} className="hover:bg-slate-50/70">
                    <td className="py-3 px-3 font-semibold text-slate-900">{m.label}</td>
                    <td className="py-3 px-3 text-left text-emerald-700 font-mono-num tabular-nums">
                      {formatILS(m.income)}
                    </td>
                    <td className="py-3 px-3 text-left text-red-700 font-mono-num tabular-nums">
                      {formatILS(m.expense)}
                    </td>
                    <td className="py-3 px-3 text-left text-blue-700 font-mono-num tabular-nums">
                      {formatILS(m.maaser || 0)}
                    </td>
                    <td
                      className={`py-3 px-3 text-left font-bold font-mono-num tabular-nums ${
                        net >= 0 ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {formatILS(net)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SvgBarChart({
  periods,
  height,
}: {
  periods: { label: string; income: number; expense: number }[];
  height: number;
}) {
  const width = 560;
  let maxVal = 1;
  for (const p of periods) {
    maxVal = Math.max(maxVal, p.income, p.expense);
  }
  const n = periods.length;
  const groupW = width / n;
  const barW = Math.min(18, groupW * 0.32);
  const baseline = height - 28;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label="תרשים השוואת תקופות"
    >
      <line x1="0" y1={baseline} x2={width} y2={baseline} stroke="#e2e8f0" strokeWidth="1" />
      {periods.map((p, i) => {
        const cx = groupW * i + groupW / 2;
        const ih = (p.income / maxVal) * (baseline - 16);
        const eh = (p.expense / maxVal) * (baseline - 16);
        return (
          <g key={p.label + i}>
            <rect
              x={cx - barW - 2}
              y={baseline - ih}
              width={barW}
              height={Math.max(2, ih)}
              fill="#15803d"
              rx="3"
            />
            <rect
              x={cx + 2}
              y={baseline - eh}
              width={barW}
              height={Math.max(2, eh)}
              fill="#dc2626"
              rx="3"
            />
            <text
              x={cx}
              y={height - 8}
              textAnchor="middle"
              fontSize="11"
              fill="#64748b"
              className="font-mono-num"
            >
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function RewardsAndSavingsSection({
  savingsStats,
  savingsFunds,
  newFundName,
  setNewFundName,
  newFundTarget,
  setNewFundTarget,
  newFundCurrent,
  setNewFundCurrent,
  onAddFund,
  onUpdateFundAmount,
  onDeleteFund,
}: {
  savingsStats: { total: number; streak: number };
  savingsFunds: SavingsFund[];
  newFundName: string;
  setNewFundName: (v: string) => void;
  newFundTarget: string;
  setNewFundTarget: (v: string) => void;
  newFundCurrent: string;
  setNewFundCurrent: (v: string) => void;
  onAddFund: (f: SavingsFund) => void;
  onUpdateFundAmount: (id: string, delta: number) => void;
  onDeleteFund: (id: string) => void;
}) {
  const handleCreateFund = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(newFundTarget);
    const current = parseFloat(newFundCurrent) || 0;
    if (!newFundName.trim() || !target || target <= 0) return;
    onAddFund({
      id: `fund-${Date.now()}`,
      name: newFundName.trim(),
      targetAmount: target,
      currentAmount: current,
    });
    setNewFundName('');
    setNewFundTarget('');
    setNewFundCurrent('');
  };

  return (
    <div className="space-y-6">
      {/* Top Row: Streak & Total Savings Weeks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">רצף שבועות חיסכון נוכחי</div>
            <div className="text-3xl font-bold text-slate-900 mt-1 font-mono-num tabular-nums">
              {savingsStats.streak} שבועות
            </div>
            <div className="text-xs text-slate-500 mt-1">
              שבוע שבו ההכנסות עולות על ההוצאות נספר ברצף
            </div>
          </div>
          <Flame className="w-10 h-10 text-amber-500 shrink-0" />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">סה״כ שבועות חיסכון שהושגו</div>
            <div className="text-3xl font-bold text-emerald-700 mt-1 font-mono-num tabular-nums">
              {savingsStats.total} שבועות
            </div>
            <div className="text-xs text-slate-500 mt-1">
              צבירת שבועות חיוביים פותחת ציוני דרך והישגים
            </div>
          </div>
          <Award className="w-10 h-10 text-blue-700 shrink-0" />
        </div>
      </div>

      {/* Dedicated Long-Term Savings Funds */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <PiggyBank className="w-5 h-5 text-blue-700" />
            <h3 className="text-base font-bold text-slate-900">קרנות חיסכון ויעדים רב-שנתיים</h3>
          </div>

          {savingsFunds.length === 0 ? (
            <div className="text-sm text-slate-500 py-6 text-center">
              עדיין לא הוגדרו קרנות חיסכון. הוסיפו קרן חדשה בטופס משמאל.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savingsFunds.map((fund) => {
                const pct =
                  fund.targetAmount > 0
                    ? Math.min(100, Math.round((fund.currentAmount / fund.targetAmount) * 100))
                    : 0;
                return (
                  <div
                    key={fund.id}
                    className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-slate-900">{fund.name}</div>
                        {fund.note && <div className="text-xs text-slate-500">{fund.note}</div>}
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeleteFund(fund.id)}
                        className="p-1 text-slate-400 hover:text-red-600"
                        aria-label="מחק קרן"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1 font-mono-num tabular-nums">
                        <span className="font-bold text-blue-700">
                          {formatILS(fund.currentAmount)}
                        </span>
                        <span className="text-slate-500">
                          מתוך {formatILS(fund.targetAmount)} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onUpdateFundAmount(fund.id, 500)}
                        className="flex-1 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg font-mono-num"
                      >
                        +500 ₪ הפקדה
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateFundAmount(fund.id, -500)}
                        className="flex-1 py-1 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg font-mono-num"
                      >
                        −500 ₪ משיכה
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Form to Create a Savings Fund (4 cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900">פתיחת קרן חיסכון חדשה</h3>
          <form onSubmit={handleCreateFund} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">שם הקרן / היעד</label>
              <input
                type="text"
                value={newFundName}
                onChange={(e) => setNewFundName(e.target.value)}
                placeholder="למשל: קרן חירום / חופשה / רכב"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">סכום יעד (₪)</label>
              <input
                type="number"
                min="1"
                value={newFundTarget}
                onChange={(e) => setNewFundTarget(e.target.value)}
                placeholder="20000"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                סכום צבור התחלתי (₪)
              </label>
              <input
                type="number"
                min="0"
                value={newFundCurrent}
                onChange={(e) => setNewFundCurrent(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors"
            >
              + צור קרן חיסכון
            </button>
          </form>
        </div>
      </div>

      {/* Achievement Milestones Grid */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="text-base font-bold text-slate-900 mb-4">ציוני דרך והישגי התמדה</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {BADGE_THRESHOLDS.map((b) => {
            const unlocked = savingsStats.total >= b.n;
            return (
              <div
                key={b.n}
                className={`p-4 rounded-xl border transition-all ${
                  unlocked
                    ? 'bg-amber-50/70 border-amber-300 text-slate-900'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold">{b.label}</span>
                  <span className="text-xs font-mono-num font-semibold">
                    {b.n} שבועות {unlocked ? '✓' : ''}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{b.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
