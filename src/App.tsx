import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Accessibility,
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
  Sparkles,
  Target,
  Trash2,
  Volume2,
  X,
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
import {
  AccessibilityModal,
  AccessibilityPreferences,
} from './components/AccessibilityModal';

const STORAGE_KEYS = {
  INITIALIZED: 'budget_pro:initialized_v4',
  TRANSACTIONS: 'budget_pro:transactions',
  MAASER_DONATIONS: 'budget_pro:maaser_donations',
  MAASER_SETTINGS: 'budget_pro:maaser_settings',
  GOALS: 'budget_pro:goals',
  CUSTOM_CATS: 'budget_pro:custom_categories',
  SAVINGS_FUNDS: 'budget_pro:savings_funds',
  RECURRING_TEMPLATES: 'budget_pro:recurring_templates',
  A11Y_PREFS: 'budget_pro:a11y_prefs',
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
  const [isAddTxModalOpen, setIsAddTxModalOpen] = useState(false);
  const [isA11yModalOpen, setIsA11yModalOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Accessibility & Display Preferences
  const [a11yPrefs, setA11yPrefs] = useState<AccessibilityPreferences>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.A11Y_PREFS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      fontScale: 'normal',
      highContrast: false,
      simplifiedMode: false,
    };
  });

  // 1-Line Quick Inline Entry State
  const [quickInlineType, setQuickInlineType] = useState<TransactionType>('expense');
  const [quickInlineCat, setQuickInlineCat] = useState<string>('food');
  const [quickInlineAmount, setQuickInlineAmount] = useState<string>('');
  const [quickInlineNote, setQuickInlineNote] = useState<string>('');

  // Core Persistent State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [maaserDonations, setMaaserDonations] = useState<MaaserDonation[]>([]);
  const [maaserSettings, setMaaserSettings] = useState<MaaserSettings>(DEFAULT_MAASER_SETTINGS);
  const [goals, setGoals] = useState<Record<string, number>>({});
  const [customCategories, setCustomCategories] = useState<CategoryItem[]>([]);
  const [savingsFunds, setSavingsFunds] = useState<SavingsFund[]>([]);
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringTemplate[]>([]);
  const [motivationalPopup, setMotivationalPopup] = useState<MotivationalPopupData | null>(null);

  // Transaction Form State (inside modal)
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

  // Load initial data from localStorage
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

  // Sync Accessibility Preferences to DOM & localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.A11Y_PREFS, JSON.stringify(a11yPrefs));
      document.documentElement.setAttribute('data-font-scale', a11yPrefs.fontScale);
      document.documentElement.setAttribute(
        'data-high-contrast',
        a11yPrefs.highContrast ? 'true' : 'false'
      );
    } catch {}
  }, [a11yPrefs]);

  // Global Keyboard Shortcuts for Effortless Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (e.key === 'Escape') {
        setIsAddTxModalOpen(false);
        setIsExportModalOpen(false);
        setIsA11yModalOpen(false);
        setMotivationalPopup(null);
        setEditingId(null);
        return;
      }

      if (isInput) return;

      if (e.key === 'n' || e.key === 'N' || e.key === '+') {
        e.preventDefault();
        setIsAddTxModalOpen(true);
      } else if (e.key === '/') {
        e.preventDefault();
        setActiveTab('overview');
        setTimeout(() => searchInputRef.current?.focus(), 40);
      } else if (e.key === '?') {
        e.preventDefault();
        setIsA11yModalOpen((prev) => !prev);
      } else if (e.key === '1') {
        setActiveTab('overview');
      } else if (e.key === '2') {
        setActiveTab('recurring');
      } else if (e.key === '3') {
        setActiveTab('maaserot');
      } else if (e.key === '4') {
        setActiveTab('forecast');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  const totalGoalAmount = useMemo(
    () => Object.values(goals).reduce((sum: number, val) => sum + (Number(val) || 0), 0),
    [goals]
  );

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
      `התנועה בסך ${formatILS(finalAmt)} נוספה ליומן ${HE_MONTHS[viewMonth]}.`
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
      'כל ההוצאות וההכנסות הקבועות שוקללו בתזרים החודשי.'
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
    setIsAddTxModalOpen(false);

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

    setTimeout(() => {
      if (newTx.type === 'income') {
        triggerSavingsPopup(
          `הכנסה חדשה נוספה (+${formatILS(newTx.amount)})!`,
          `יתרת החיסכון בחודש ${HE_MONTHS[viewMonth]} עלתה ל-${formatILS(summaryMetrics.balance + newTx.amount)}.`
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

  // Quick 1-Line Inline Transaction Submit
  const handleQuickInlineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(quickInlineAmount);
    if (!num || num <= 0) return;
    const catList = quickInlineType === 'expense' ? expenseCategories : incomeCategories;
    const catObj = catList.find((c) => c.id === quickInlineCat) || catList[0];

    const newTx: Transaction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: quickInlineType,
      category: catObj ? catObj.id : quickInlineCat,
      categoryLabel: catObj ? catObj.label : quickInlineCat,
      amount: num,
      note: quickInlineNote.trim(),
      date: dateKey(new Date()),
      paymentMethod: 'credit',
      isRecurring: false,
      isMaaserEligible: quickInlineType === 'income' ? true : undefined,
    };

    setTransactions((prev) => [newTx, ...prev]);
    setQuickInlineAmount('');
    setQuickInlineNote('');
  };

  // Built-in Offline Voice Readout (Web Speech API)
  const handleSpeakMonthlySummary = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const text = `סיכום חודש ${HE_MONTHS[viewMonth]} ${viewYear}. סך ההכנסות: ${Math.round(
        summaryMetrics.income
      )} שקלים. סך ההוצאות: ${Math.round(summaryMetrics.expense)} שקלים. יתרה נטו: ${Math.round(
        summaryMetrics.balance
      )} שקלים. יתרת מעשרות להפרשה: ${Math.round(
        Math.max(0, summaryMetrics.maaserRemaining)
      )} שקלים.`;
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'he-IL';
      utter.rate = 0.95;
      window.speechSynthesis.speak(utter);
    } catch {}
  };

  const primaryNav: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { id: 'overview', label: 'סקירה ותנועות', icon: LayoutDashboard },
    { id: 'recurring', label: 'הוראות קבע וקבועות', icon: Repeat, count: pendingMonthlyRecurring.length },
    { id: 'maaserot', label: 'מערכת מעשרות', icon: HeartHandshake },
  ];

  const analyticsNav: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'forecast', label: 'תחזית סוף חודש', icon: Activity },
    { id: 'goals', label: 'יעדי תקציב', icon: Target },
    { id: 'categories', label: 'פילוח קטגוריות', icon: PieChart },
    { id: 'calendar', label: 'לוח שנה תזרימי', icon: CalendarIcon },
    { id: 'compare', label: 'השוואת תקופות', icon: BarChart3 },
    { id: 'rewards', label: 'קרנות חיסכון', icon: PiggyBank },
  ];

  const allNavItems = [...primaryNav, ...analyticsNav];
  const currentTabInfo = allNavItems.find((n) => n.id === activeTab) || primaryNav[0];

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col lg:flex-row" dir="rtl">
      {/* Skip to Main Content Link for Keyboard & Screen Reader Users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:right-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-xl focus:font-bold focus:shadow-lg"
      >
        דלג לתוכן הראשי
      </a>

      {/* Clean Modern Right Sidebar (Desktop) */}
      <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-l border-slate-200/80 shrink-0 flex flex-col justify-between lg:sticky lg:top-0 lg:h-screen z-20">
        <div className="p-5 space-y-6">
          {/* Brand Header */}
          <div className="flex items-center justify-between">
            <a
              href="#overview"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('overview');
              }}
              className="flex items-center gap-2.5"
            >
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                כ
              </div>
              <div>
                <div className="text-base font-bold tracking-tight text-slate-900 font-display leading-none">
                  כלכלת הבית Pro
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  ניהול תקציב ומעשרות
                </div>
              </div>
            </a>

            <div className="flex items-center gap-1.5 lg:hidden">
              <button
                type="button"
                onClick={() => setIsA11yModalOpen(true)}
                aria-label="הגדרות נגישות ותצוגה"
                className="p-2 text-slate-600 bg-slate-100 rounded-xl"
              >
                <Accessibility className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsAddTxModalOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-xl flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>תנועה חדשה</span>
              </button>
            </div>
          </div>

          {/* Primary Action Button (Desktop) */}
          <button
            type="button"
            onClick={() => setIsAddTxModalOpen(true)}
            title="קיצור מקלדת: N או +"
            className="hidden lg:flex w-full py-2.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors items-center justify-between shadow-2xs"
          >
            <span className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>תנועה חדשה</span>
            </span>
            <kbd className="px-1.5 py-0.5 text-[10px] bg-blue-700/80 text-blue-100 rounded font-mono-num">
              N
            </kbd>
          </button>

          {/* Navigation Links */}
          <div className="space-y-5">
            <div>
              <div className="px-3 mb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                ניהול שוטף
              </div>
              <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
                {primaryNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        setEditingId(null);
                      }}
                      className={`px-3 py-2 text-xs font-medium rounded-xl transition-all flex items-center justify-between gap-2 whitespace-nowrap shrink-0 ${
                        isActive
                          ? 'bg-blue-50/90 text-blue-700 font-semibold'
                          : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.count && item.count > 0 ? (
                        <span className="text-[11px] font-mono-num font-bold text-amber-600">
                          {item.count}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </nav>
            </div>

            {!a11yPrefs.simplifiedMode && (
              <div>
                <div className="px-3 mb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  ניתוח ותכנון
                </div>
                <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
                  {analyticsNav.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveTab(item.id);
                          setEditingId(null);
                        }}
                        className={`px-3 py-2 text-xs font-medium rounded-xl transition-all flex items-center gap-2.5 whitespace-nowrap shrink-0 ${
                          isActive
                            ? 'bg-blue-50/90 text-blue-700 font-semibold'
                            : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Bottom Utilities */}
        <div className="hidden lg:block p-4 border-t border-slate-100 space-y-1.5">
          <button
            type="button"
            onClick={() => setIsA11yModalOpen(true)}
            className="w-full px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50/80 rounded-xl transition-colors flex items-center justify-between"
          >
            <span className="flex items-center gap-2.5">
              <Accessibility className="w-4 h-4 text-blue-600" />
              <span>נגישות וגודל תצוגה</span>
            </span>
            <span className="text-[10px] font-bold text-slate-400 font-mono-num">A+</span>
          </button>

          <button
            type="button"
            onClick={() => triggerSavingsPopup()}
            className="w-full px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50/80 rounded-xl transition-colors flex items-center gap-2.5"
          >
            <Award className="w-4 h-4 text-emerald-600" />
            <span>מדד חיסכון מול צפי</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="w-full px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 rounded-xl transition-colors flex items-center gap-2.5"
          >
            <Monitor className="w-4 h-4 text-slate-400" />
            <span>גיבוי ותוכנה שולחנית</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Clean Single Top Header Bar */}
        <header className="bg-white/90 backdrop-blur-xs border-b border-slate-200/80 px-6 lg:px-8 py-3.5 sticky top-0 z-10">
          <div className="max-w-[1240px] mx-auto flex flex-wrap items-center justify-between gap-4">
            {/* Active View Title */}
            <div>
              <h1 className="text-base font-bold text-slate-900 font-display">
                {currentTabInfo.label}
              </h1>
            </div>

            {/* Month Switcher & Quick Utilities */}
            <div className="flex items-center gap-2.5">
              <div className="inline-flex items-center bg-slate-100/90 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  aria-label="חודש קודם"
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <div className="min-w-[115px] text-center text-xs font-bold text-slate-800 px-2">
                  {HE_MONTHS[viewMonth]} {viewYear}
                </div>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  aria-label="חודש הבא"
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleJumpToday}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200/90 hover:bg-slate-50 rounded-xl transition-colors whitespace-nowrap"
              >
                היום
              </button>

              {/* Quick Toggle for Simplified Mode */}
              <button
                type="button"
                onClick={() =>
                  setA11yPrefs((prev) => ({
                    ...prev,
                    simplifiedMode: !prev.simplifiedMode,
                  }))
                }
                title="החלפה בין מצב תצוגה פשוט למצב מלא"
                className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  a11yPrefs.simplifiedMode
                    ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold'
                    : 'bg-white text-slate-600 border-slate-200/90 hover:bg-slate-50'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {a11yPrefs.simplifiedMode ? 'מצב פשוט: פעיל' : 'מצב פשוט'}
                </span>
              </button>

              {/* Quick Accessibility & Font Size Button */}
              <button
                type="button"
                onClick={() => setIsA11yModalOpen(true)}
                title="נגישות, גודל טקסט וקיצורי מקלדת (?)"
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200/90 hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <Accessibility className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden md:inline">נגישות (A+)</span>
              </button>

              <button
                type="button"
                onClick={() => exportTransactionsCSV(transactions)}
                title="ייצוא תנועות לקובץ CSV"
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200/90 hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">ייצוא CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                className="lg:hidden px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl"
              >
                גיבוי
              </button>
            </div>
          </div>
        </header>

        {/* Main Viewport Container */}
        <main id="main-content" className="flex-1 max-w-[1240px] w-full mx-auto px-6 lg:px-8 py-7">
          {/* TAB 1: OVERVIEW & TRANSACTIONS */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Plain-Language Accessible Summary Bar + Voice Readout */}
              <div className="bg-blue-50/50 border border-blue-200/70 rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-700 leading-relaxed">
                  <strong className="text-slate-900">סיכום מהיר ({HE_MONTHS[viewMonth]}): </strong>
                  הכנסתם עד כה <strong>{formatILS(summaryMetrics.income)}</strong> והוצאתם{' '}
                  <strong>{formatILS(summaryMetrics.expense)}</strong> (יתרה:{' '}
                  <strong
                    className={
                      summaryMetrics.balance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }
                  >
                    {formatILS(summaryMetrics.balance)}
                  </strong>
                  ).{' '}
                  {summaryMetrics.maaserRemaining > 0
                    ? `נותרו ${formatILS(summaryMetrics.maaserRemaining)} להפרשת מעשרות.`
                    : 'קופת המעשרות מאוזנת לחלוטין!'}
                </div>

                <button
                  type="button"
                  onClick={handleSpeakMonthlySummary}
                  className="px-3 py-1 text-xs font-semibold text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
                  title="הקראה קולית של סיכום החודש"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>הקרא סיכום</span>
                </button>
              </div>
              {/* Clean 4-Card KPI Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5">
                  <div className="text-xs font-medium text-slate-400">
                    הכנסות החודש
                  </div>
                  <div className="text-2xl font-bold text-emerald-600 mt-1.5 font-mono-num tabular-nums">
                    {formatILS(summaryMetrics.income)}
                  </div>
                  <div className="text-xs text-slate-400 mt-2">
                    {monthTransactions.filter((t) => t.type === 'income').length} תנועות הכנסה
                  </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-5">
                  <div className="text-xs font-medium text-slate-400">
                    הוצאות החודש
                  </div>
                  <div className="text-2xl font-bold text-rose-600 mt-1.5 font-mono-num tabular-nums">
                    {formatILS(summaryMetrics.expense)}
                  </div>
                  <div className="text-xs text-slate-400 mt-2">
                    {monthTransactions.filter((t) => t.type === 'expense').length} תנועות הוצאה
                  </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-5">
                  <div className="text-xs font-medium text-slate-400">יתרה נטו</div>
                  <div
                    className={`text-2xl font-bold mt-1.5 font-mono-num tabular-nums ${
                      summaryMetrics.balance >= 0 ? 'text-slate-900' : 'text-rose-600'
                    }`}
                  >
                    {formatILS(summaryMetrics.balance)}
                  </div>
                  <div className="text-xs text-slate-400 mt-2">
                    שיעור חיסכון: <span className="font-mono-num font-semibold text-slate-600">{summaryMetrics.savingsRate}%</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-400">
                        קופת מעשרות ({maaserSettings.ratePercent}%)
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('maaserot')}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        למעשרות ←
                      </button>
                    </div>
                    <div
                      className={`text-2xl font-bold mt-1.5 font-mono-num tabular-nums ${
                        summaryMetrics.maaserRemaining > 0 ? 'text-amber-600' : 'text-emerald-600'
                      }`}
                    >
                      {formatILS(Math.abs(summaryMetrics.maaserRemaining))}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                    <span>
                      {summaryMetrics.maaserRemaining >= 0 ? 'נותר להפרשה' : 'יתרת זכות'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>שולם: {formatILS(summaryMetrics.maaserPaid)}</span>
                  </div>
                </div>
              </div>

              {/* Unified Clean Insights Strip (Budget Utilization + End-of-Month Forecast) */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                {totalGoalAmount > 0 && (
                  <div className="lg:col-span-5 space-y-2 lg:border-l lg:border-slate-100 lg:pl-6">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">ניצול תקציב חודשי</span>
                      <span className="font-mono-num tabular-nums text-slate-500">
                        {formatILS(summaryMetrics.expense)} מתוך {formatILS(totalGoalAmount)} (
                        {Math.round((summaryMetrics.expense / totalGoalAmount) * 100)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all rounded-full ${
                          summaryMetrics.expense / totalGoalAmount < 0.8
                            ? 'bg-emerald-500'
                            : summaryMetrics.expense / totalGoalAmount <= 1
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
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
                    totalGoalAmount > 0 ? 'lg:col-span-7' : 'lg:col-span-12'
                  } flex flex-wrap items-center justify-between gap-4`}
                >
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-blue-600" />
                      <span>
                        תחזית סוף חודש ({summaryMetrics.remainingDays} ימים נותרו)
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 font-mono-num tabular-nums">
                      <span>
                        צפי הוצאות: <strong className="text-slate-800">{formatILS(summaryMetrics.projectedEndMonthExpense)}</strong>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        צפי יתרה:{' '}
                        <strong
                          className={
                            summaryMetrics.projectedEndMonthBalance >= 0
                              ? 'text-emerald-600'
                              : 'text-rose-600'
                          }
                        >
                          {formatILS(summaryMetrics.projectedEndMonthBalance)}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {pendingMonthlyRecurring.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleGenerateAllPendingForMonth(pendingMonthlyRecurring)}
                        className="px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-xl transition-colors flex items-center gap-1.5"
                      >
                        <BellRing className="w-3.5 h-3.5 text-amber-600" />
                        <span>אשר {pendingMonthlyRecurring.length} קבועות ממתינות</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setActiveTab('forecast')}
                      className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50/80 hover:bg-blue-100/80 rounded-xl transition-colors whitespace-nowrap"
                    >
                      ניתוח מלא ←
                    </button>
                  </div>
                </div>
              </div>

              {/* Full-Width Clean Transactions Table */}
              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden">
                {/* 1-Line Quick Inline Entry Bar (Accessible Fast Entry) */}
                <form
                  onSubmit={handleQuickInlineSubmit}
                  aria-label="הזנה מהירה של תנועה חדשה"
                  className="px-6 py-3.5 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center gap-2.5"
                >
                  <span className="text-xs font-bold text-slate-700 ml-1">הזנה מהירה:</span>

                  <div className="inline-flex bg-white border border-slate-200 p-0.5 rounded-xl text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setQuickInlineType('expense');
                        setQuickInlineCat(expenseCategories[0]?.id || 'food');
                      }}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                        quickInlineType === 'expense'
                          ? 'bg-rose-50 text-rose-700'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      הוצאה (−)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickInlineType('income');
                        setQuickInlineCat(incomeCategories[0]?.id || 'salary');
                      }}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                        quickInlineType === 'income'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      הכנסה (+)
                    </button>
                  </div>

                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={quickInlineAmount}
                    onChange={(e) => setQuickInlineAmount(e.target.value)}
                    placeholder="סכום (₪)..."
                    aria-label="סכום בשקלים להזנה מהירה"
                    className="w-28 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl font-mono-num focus:outline-none focus:border-blue-600"
                  />

                  <select
                    value={quickInlineCat}
                    onChange={(e) => setQuickInlineCat(e.target.value)}
                    aria-label="קטגוריה להזנה מהירה"
                    className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-blue-600"
                  >
                    {(quickInlineType === 'expense' ? expenseCategories : incomeCategories).map(
                      (c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      )
                    )}
                  </select>

                  <input
                    type="text"
                    value={quickInlineNote}
                    onChange={(e) => setQuickInlineNote(e.target.value)}
                    placeholder="פירוט קצר (אופציונלי)..."
                    aria-label="הערה לתנועה"
                    className="flex-1 min-w-[140px] px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
                  />

                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>הוסף מיד</span>
                  </button>
                </form>

                {/* Table Toolbar */}
                <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-sm font-bold text-slate-900">
                      יומן תנועות ({filteredTransactions.length})
                    </h2>
                    <button
                      type="button"
                      onClick={() => setIsAddTxModalOpen(true)}
                      className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>טופס מלא ומעשרות</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        placeholder="חיפוש תנועה (/ במקלדת)..."
                        aria-label="חיפוש תנועה ביומן"
                        className="pr-8 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:bg-white focus:border-blue-600 w-48"
                      />
                    </div>

                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none text-slate-700"
                    >
                      <option value="all">כל הקטגוריות</option>
                      {expenseCategories.concat(incomeCategories).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>

                    <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl text-xs">
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
                          className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                            filterType === ft.id
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          {ft.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {filteredTransactions.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 text-sm space-y-2">
                    <div>אין תנועות תואמות לחודש או לסינון הנבחר.</div>
                    <button
                      type="button"
                      onClick={() => setIsAddTxModalOpen(true)}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      + הוספת תנועה ראשונה לחודש זה
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs text-slate-400 bg-slate-50/40">
                          <th className="py-3 px-6 text-right font-medium">תאריך</th>
                          <th className="py-3 px-4 text-right font-medium">קטגוריה ופירוט</th>
                          <th className="py-3 px-4 text-right font-medium">אמצעי תשלום</th>
                          <th className="py-3 px-4 text-left font-medium">סכום</th>
                          <th className="py-3 px-6 text-left font-medium">פעולות</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredTransactions.map((t) => {
                          const isEditing = editingId === t.id;
                          return (
                            <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3.5 px-6 text-xs text-slate-500 font-mono-num tabular-nums whitespace-nowrap">
                                {isEditing ? (
                                  <input
                                    type="date"
                                    value={editDate}
                                    onChange={(e) => setEditDate(e.target.value)}
                                    className="px-2 py-1 text-xs border border-slate-300 rounded-lg font-mono-num"
                                  />
                                ) : (
                                  t.date
                                )}
                              </td>
                              <td className="py-3.5 px-4">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editNote}
                                    onChange={(e) => setEditNote(e.target.value)}
                                    placeholder="הערה..."
                                    className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg w-full"
                                  />
                                ) : (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-slate-900">
                                      {t.categoryLabel}
                                    </span>
                                    {t.note && (
                                      <span className="text-slate-500 text-xs">
                                        — {t.note}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-xs text-slate-400">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span>{getPaymentMethodLabel(t.paymentMethod)}</span>
                                  {t.isRecurring && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-blue-600 font-medium">קבוע</span>
                                    </>
                                  )}
                                  {t.type === 'expense' && t.isMaaserPayment && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-emerald-600 font-medium">מעשר</span>
                                    </>
                                  )}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-left font-bold font-mono-num tabular-nums whitespace-nowrap">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    value={editAmount}
                                    onChange={(e) => setEditAmount(e.target.value)}
                                    className="px-2 py-1 text-xs border border-slate-300 rounded-lg w-24 text-left font-mono-num"
                                  />
                                ) : (
                                  <span
                                    className={
                                      t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                                    }
                                  >
                                    {t.type === 'income' ? '+' : '−'}
                                    {formatILS(t.amount)}
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-6 text-left whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1">
                                  {isEditing ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleSaveEditTx(t.id)}
                                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                                        title="שמור"
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
                                        onClick={() => handleDuplicateTx(t)}
                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                        title="שכפל להיום"
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
                                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                                        aria-label="ערוך"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteTx(t.id)}
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
            </div>
          )}

          {/* TAB 2: RECURRING TRANSACTIONS */}
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

          {/* TAB 3: FORECAST & ANALYTICS */}
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

          {/* TAB 4: MAASEROT & CHUMASH */}
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

          {/* TAB 5: CALENDAR */}
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

          {/* TAB 6: CATEGORIES */}
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

          {/* TAB 7: GOALS */}
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

          {/* TAB 8: COMPARE */}
          {activeTab === 'compare' && (
            <CompareSection
              today={today}
              transactions={transactions}
              maaserDonations={maaserDonations}
            />
          )}

          {/* TAB 9: SAVINGS FUNDS & REWARDS */}
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
      </div>

      {/* Add Transaction Modal */}
      {isAddTxModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">הוספת תנועה חדשה</h2>
              <button
                type="button"
                onClick={() => setIsAddTxModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Presets */}
            <div>
              <div className="text-[11px] text-slate-400 mb-1.5">מילוי מהיר:</div>
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
                    className="px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors whitespace-nowrap"
                  >
                    {preset.label} ({preset.amount} ₪)
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setCurrentType('expense')}
                  className={`py-2 text-xs font-bold rounded-lg transition-colors ${
                    currentType === 'expense'
                      ? 'bg-white text-rose-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  הוצאה (−)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentType('income')}
                  className={`py-2 text-xs font-bold rounded-lg transition-colors ${
                    currentType === 'income'
                      ? 'bg-white text-emerald-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  הכנסה (+)
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    קטגוריה
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
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
                    סכום (₪)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="0"
                    autoFocus
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 font-mono-num"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    תאריך
                  </label>
                  <input
                    type="date"
                    value={dateInput}
                    onChange={(e) => setDateInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 font-mono-num"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    אמצעי תשלום
                  </label>
                  <select
                    value={paymentMethodInput}
                    onChange={(e) => setPaymentMethodInput(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
                  >
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm.id} value={pm.id}>
                        {pm.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  פירוט / הערה
                </label>
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="תיאור קצר (לא חובה)"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2 text-xs text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isRecurringInput}
                    onChange={(e) => setIsRecurringInput(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>הוצאה / הכנסה קבועה חודשית</span>
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
                      <span>חייב במעשר ({maaserSettings.ratePercent}%)</span>
                    </div>
                    {isMaaserEligibleInput && parseFloat(amountInput) > 0 && (
                      <span className="text-blue-600 font-bold font-mono-num">
                        +{formatILS((parseFloat(amountInput) * maaserSettings.ratePercent) / 100)}
                      </span>
                    )}
                  </label>
                ) : (
                  <div className="pt-1 border-t border-slate-200/70 space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
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
                  </div>
                )}
              </div>

              {formError && <div className="text-xs font-medium text-rose-600">{formError}</div>}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddTxModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
                >
                  שמור תנועה
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Motivational Savings Popup */}
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
              `החיסכון ננעל בהצלחה בקרן הייעודית.`
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

      {/* Accessibility, Font Size & Keyboard Shortcuts Modal */}
      <AccessibilityModal
        isOpen={isA11yModalOpen}
        onClose={() => setIsA11yModalOpen(false)}
        prefs={a11yPrefs}
        onUpdatePrefs={setA11yPrefs}
        onSpeakMonthlySummary={handleSpeakMonthlySummary}
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
      <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900">
            לוח שנה תזרימי — {HE_MONTHS[viewMonth]} {viewYear}
          </h2>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>הכנסה (+)</span>
            <span>·</span>
            <span>הוצאה (−)</span>
            <span>·</span>
            <span>מעשר</span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-2">
          {HE_DAYS.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">
              יום {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: firstDay }).map((_, idx) => (
            <div key={`empty-${idx}`} className="h-24 bg-slate-50/40 rounded-xl" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const dk = `${mk}-${pad(dayNum)}`;
            const info = byDay[dk];
            const intensity =
              info && info.expense > 0 && maxExpense > 0
                ? Math.max(0.05, Math.min(0.22, (info.expense / maxExpense) * 0.22))
                : 0;
            const isSelected = selectedDay === dk;

            return (
              <button
                key={dk}
                type="button"
                onClick={() => onSelectDay(dk)}
                style={{
                  backgroundColor:
                    intensity > 0 ? `rgba(244, 63, 94, ${intensity.toFixed(2)})` : undefined,
                }}
                className={`h-24 p-2.5 rounded-xl border text-right flex flex-col justify-between transition-all ${
                  isSelected
                    ? 'border-blue-600 ring-2 ring-blue-600/15 bg-white'
                    : 'border-slate-200/80 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold text-slate-700 font-mono-num">{dayNum}</span>
                  {info && info.count > 0 && (
                    <span className="text-[10px] text-slate-400">{info.count}</span>
                  )}
                </div>

                <div className="space-y-0.5 w-full overflow-hidden">
                  {info?.income ? (
                    <div className="text-[11px] font-bold text-emerald-600 font-mono-num truncate">
                      +{Math.round(info.income).toLocaleString('he-IL')}
                    </div>
                  ) : null}
                  {info?.expense ? (
                    <div className="text-[11px] font-bold text-rose-600 font-mono-num truncate">
                      −{Math.round(info.expense).toLocaleString('he-IL')}
                    </div>
                  ) : null}
                  {info?.maaser ? (
                    <div className="text-[10px] font-semibold text-blue-600 font-mono-num truncate">
                      מעשר: {Math.round(info.maaser).toLocaleString('he-IL')}
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Inspector */}
      <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-slate-900 mb-3">
          {selectedDay ? `תנועות ביום ${selectedDay}` : 'בחרו יום בלוח השנה'}
        </h3>

        {!selectedDay ? (
          <p className="text-xs text-slate-400 py-10 text-center">
            לחצו על יום בלוח השנה כדי לצפות בפירוט התנועות של אותו יום.
          </p>
        ) : selectedDayTx.length === 0 && selectedDayMaaser.length === 0 ? (
          <p className="text-xs text-slate-400 py-10 text-center">אין תנועות ביום זה.</p>
        ) : (
          <div className="space-y-2.5">
            {selectedDayTx.map((t) => (
              <div
                key={t.id}
                className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-900">{t.categoryLabel}</div>
                  {t.note && <div className="text-slate-400 mt-0.5">{t.note}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-bold font-mono-num ${
                      t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {t.type === 'income' ? '+' : '−'}
                    {formatILS(t.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeleteTx(t.id)}
                    className="p-1 text-slate-400 hover:text-rose-600"
                    aria-label="מחק"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {selectedDayMaaser.map((d) => (
              <div
                key={d.id}
                className="p-3 bg-blue-50/50 border border-blue-200/70 rounded-xl flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-blue-900">מעשר: {d.recipient}</div>
                  <div className="text-blue-600 mt-0.5">{d.categoryLabel}</div>
                </div>
                <span className="font-bold text-blue-700 font-mono-num">{formatILS(d.amount)}</span>
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
      <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl p-6">
        <h2 className="text-sm font-bold text-slate-900 mb-6">
          פילוח הוצאות לפי קטגוריה — {HE_MONTHS[viewMonth]} {viewYear}
        </h2>

        <div className="flex flex-col md:flex-row items-center gap-8">
          <svg
            viewBox="0 0 140 140"
            width="175"
            height="175"
            className="shrink-0"
            role="img"
            aria-label="תרשים פילוח הוצאות"
          >
            <circle cx="70" cy="70" r="52" fill="none" stroke="#f1f5f9" strokeWidth="16" />
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
                      strokeWidth="16"
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
            <text x="70" y="84" textAnchor="middle" className="text-[10px] fill-slate-400">
              סה״כ הוצאות
            </text>
          </svg>

          <div className="flex-1 w-full space-y-3.5">
            {byCat.length === 0 ? (
              <div className="text-sm text-slate-400">אין הוצאות מתועדות בחודש זה.</div>
            ) : (
              byCat.map((item) => (
                <div key={item.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-800">{item.label}</span>
                    <span className="text-slate-500 font-mono-num tabular-nums">
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

      <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-900">הוספת קטגוריה חדשה</h3>
        <p className="text-xs text-slate-400">
          התאימו את הקטגוריות למשק הבית או לעסק שלכם.
        </p>

        <form onSubmit={handleCreateCategory} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">שם הקטגוריה</label>
            <input
              type="text"
              value={newCatLabel}
              onChange={(e) => setNewCatLabel(e.target.value)}
              placeholder="לדוגמה: חוגי ילדים"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">סוג</label>
              <select
                value={newCatType}
                onChange={(e) => setNewCatType(e.target.value as TransactionType)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white"
              >
                <option value="expense">הוצאה</option>
                <option value="income">הכנסה</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">צבע</label>
              <input
                type="color"
                value={newCatColor}
                onChange={(e) => setNewCatColor(e.target.value)}
                className="w-full h-9 p-1 border border-slate-200 rounded-xl cursor-pointer bg-white"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
          >
            + שמור קטגוריה
          </button>
        </form>

        <div className="pt-3 border-t border-slate-100 text-xs text-slate-400">
          קטגוריות פעילות: {expenseCategories.length} הוצאה · {incomeCategories.length} הכנסה
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
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-bold text-slate-900">
          יעדי תקציב חודשיים — {HE_MONTHS[viewMonth]} {viewYear}
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          קבעו תקרת הוצאה לכל קטגוריה ועקבו אחר קצב הניצול
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {expenseCategories.map((c) => {
          const goal = Number(goals[c.id]) || 0;
          const spent = spentByCat[c.id] || 0;
          const pct = goal > 0 ? Math.min(100, Math.round((spent / goal) * 100)) : 0;
          const isOver = goal > 0 && spent > goal;

          return (
            <div key={c.id} className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3">
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
                    className="w-24 px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono-num text-left focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                  <span className="text-xs text-slate-400">₪</span>
                </div>
              </div>

              {goal > 0 ? (
                <>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct < 80 ? 'bg-emerald-500' : !isOver ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-mono-num tabular-nums">
                      {formatILS(spent)} מתוך {formatILS(goal)} ({pct}%)
                    </span>
                    {isOver ? (
                      <span className="text-rose-600 font-semibold font-mono-num">
                        חריגה: {formatILS(spent - goal)}
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-medium font-mono-num">
                        נותר: {formatILS(goal - spent)}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-400 flex items-center justify-between pt-1">
                  <span>הוצאה החודש: {formatILS(spent)}</span>
                  {spent > 0 && (
                    <button
                      type="button"
                      onClick={() => onUpdateGoal(c.id, Math.ceil(spent / 100) * 100)}
                      className="text-blue-600 hover:underline font-medium"
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
  const months = useMemo(() => {
    const arr = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const mk = monthKey(y, m);
      let income = 0;
      let expense = 0;
      let maaser = 0;
      for (const t of transactions) {
        if (t.date.slice(0, 7) === mk) {
          if (t.type === 'income') income += t.amount;
          else expense += t.amount;
          if (t.isMaaserPayment) maaser += t.amount;
        }
      }
      for (const don of maaserDonations) {
        if (don.status === 'paid' && don.date.slice(0, 7) === mk) {
          maaser += don.amount;
        }
      }
      arr.push({
        label: `${HE_MONTHS[m]} ${String(y).slice(2)}`,
        income,
        expense,
        maaser,
        net: income - expense,
      });
    }
    return arr;
  }, [today, transactions, maaserDonations]);

  const curM = months[months.length - 1];
  const prevM = months[months.length - 2];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5">
          <div className="text-xs text-slate-400">הכנסות מול חודש קודם</div>
          <div className="text-xl font-bold text-slate-900 mt-1 font-mono-num">
            {formatILS(curM.income)} לעומת {formatILS(prevM.income)}
          </div>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5">
          <div className="text-xs text-slate-400">הוצאות מול חודש קודם</div>
          <div className="text-xl font-bold text-slate-900 mt-1 font-mono-num">
            {formatILS(curM.expense)} לעומת {formatILS(prevM.expense)}
          </div>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5">
          <div className="text-xs text-slate-400">מעשרות מול חודש קודם</div>
          <div className="text-xl font-bold text-blue-600 mt-1 font-mono-num">
            {formatILS(curM.maaser)} לעומת {formatILS(prevM.maaser)}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-900">מגמת 6 חודשים אחרונים</h3>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-emerald-600 font-semibold">● הכנסות</span>
            <span className="text-rose-600 font-semibold">● הוצאות</span>
            <span className="text-blue-600 font-semibold">● מעשרות</span>
          </div>
        </div>
        <BarComparisonSvg data={months} showMaaser />
      </div>
    </div>
  );
}

function BarComparisonSvg({
  data,
  showMaaser,
}: {
  data: { label: string; income: number; expense: number; maaser?: number }[];
  showMaaser?: boolean;
}) {
  const width = 620;
  const height = 220;
  const padLeft = 48;
  const padRight = 16;
  const padTop = 18;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxVal = Math.max(
    100,
    ...data.map((d) => Math.max(d.income, d.expense, d.maaser || 0))
  );

  const n = data.length;
  const groupW = plotW / n;
  const barW = showMaaser ? Math.min(16, groupW * 0.24) : Math.min(20, groupW * 0.32);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="גרף השוואה">
      {[0, 0.5, 1].map((frac) => {
        const y = padTop + plotH * (1 - frac);
        const val = Math.round(maxVal * frac);
        return (
          <g key={frac}>
            <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#f1f5f9" strokeWidth="1" />
            <text x={padLeft - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8" className="font-mono-num">
              {val >= 1000 ? `${Math.round(val / 1000)}k` : val}
            </text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const cx = padLeft + i * groupW + groupW / 2;
        const incH = (d.income / maxVal) * plotH;
        const expH = (d.expense / maxVal) * plotH;
        const masH = ((d.maaser || 0) / maxVal) * plotH;

        return (
          <g key={d.label}>
            <rect
              x={cx - barW - 2}
              y={padTop + plotH - incH}
              width={barW}
              height={Math.max(2, incH)}
              rx="4"
              fill="#10b981"
            />
            <rect
              x={cx + 2}
              y={padTop + plotH - expH}
              width={barW}
              height={Math.max(2, expH)}
              rx="4"
              fill="#f43f5e"
            />
            {showMaaser && (
              <rect
                x={cx + barW + 5}
                y={padTop + plotH - masH}
                width={barW}
                height={Math.max(2, masH)}
                rx="4"
                fill="#2563eb"
              />
            )}
            <text
              x={cx}
              y={height - 10}
              textAnchor="middle"
              fontSize="10"
              fill="#64748b"
            >
              {d.label}
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
  onAddFund: (fund: SavingsFund) => void;
  onUpdateFundAmount: (id: string, delta: number) => void;
  onDeleteFund: (id: string) => void;
}) {
  const [isAddFundOpen, setIsAddFundOpen] = useState(false);

  const handleCreateFund = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(newFundTarget);
    if (!newFundName.trim() || !target || target <= 0) return;
    onAddFund({
      id: `fund-${Date.now()}`,
      name: newFundName.trim(),
      targetAmount: target,
      currentAmount: parseFloat(newFundCurrent) || 0,
    });
    setNewFundName('');
    setNewFundTarget('');
    setNewFundCurrent('');
    setIsAddFundOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">קרנות חיסכון ויעדים רב-שנתיים</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            ניהול קופות חיסכון ייעודיות ומעקב התמדה שבועי
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddFundOpen(true)}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>קרן חיסכון חדשה</span>
        </button>
      </div>

      {/* Savings Funds Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {savingsFunds.map((fund) => {
          const pct =
            fund.targetAmount > 0
              ? Math.min(100, Math.round((fund.currentAmount / fund.targetAmount) * 100))
              : 0;
          return (
            <div key={fund.id} className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-slate-900">{fund.name}</div>
                  <div className="text-xs text-slate-400 font-mono-num mt-0.5">
                    {formatILS(fund.currentAmount)} מתוך {formatILS(fund.targetAmount)} ({pct}%)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteFund(fund.id)}
                  className="p-1 text-slate-300 hover:text-rose-600"
                  aria-label="מחק קרן"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onUpdateFundAmount(fund.id, 250)}
                  className="flex-1 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl transition-colors font-mono-num"
                >
                  +250 ₪
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateFundAmount(fund.id, 1000)}
                  className="flex-1 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl transition-colors font-mono-num"
                >
                  +1,000 ₪
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateFundAmount(fund.id, -250)}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl transition-colors font-mono-num"
                >
                  −250 ₪
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Clean Streak Summary Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">
              רצף חיסכון נוכחי: {savingsStats.streak} שבועות ({savingsStats.total} שבועות חיוביים סה״כ)
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              שבוע נחשב חיובי כאשר סך ההכנסות גבוה או שווה לסך ההוצאות באותו שבוע
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {BADGE_THRESHOLDS.map((b) => {
            const unlocked = savingsStats.total >= b.n;
            return (
              <div
                key={b.n}
                className={`px-3 py-1.5 rounded-xl border text-xs font-medium ${
                  unlocked
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                    : 'bg-slate-50 border-slate-200/60 text-slate-400'
                }`}
              >
                {b.label} ({b.n} שב׳)
              </div>
            );
          })}
        </div>
      </div>

      {isAddFundOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">קרן חיסכון חדשה</h3>
              <button
                type="button"
                onClick={() => setIsAddFundOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFund} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">שם הקרן</label>
                <input
                  type="text"
                  value={newFundName}
                  onChange={(e) => setNewFundName(e.target.value)}
                  placeholder="לדוגמה: קרן חירום / חופשה"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">סכום יעד (₪)</label>
                <input
                  type="number"
                  min="100"
                  value={newFundTarget}
                  onChange={(e) => setNewFundTarget(e.target.value)}
                  placeholder="10000"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">יתרה התחלתית (₪)</label>
                <input
                  type="number"
                  min="0"
                  value={newFundCurrent}
                  onChange={(e) => setNewFundCurrent(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl font-mono-num"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddFundOpen(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
                >
                  צור קרן
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
