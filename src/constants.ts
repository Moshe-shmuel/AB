import { CategoryItem, MaaserCategoryId, MaaserDonation, MaaserSettings, PaymentMethod, RecurringTemplate, SavingsFund, Transaction } from './types';

export const DEFAULT_EXPENSE_CATS: CategoryItem[] = [
  { id: 'food', label: 'מזון וסופרמרקט', color: '#D85A30', type: 'expense' },
  { id: 'home', label: 'דיור וחשבונות', color: '#2563EB', type: 'expense' },
  { id: 'transport', label: 'תחבורה ורכב', color: '#D97706', type: 'expense' },
  { id: 'education', label: 'חינוך וחוגים', color: '#0891B2', type: 'expense' },
  { id: 'health', label: 'בריאות ורפואה', color: '#16A34A', type: 'expense' },
  { id: 'shopping', label: 'קניות וביגוד', color: '#7C3AED', type: 'expense' },
  { id: 'fun', label: 'בילויים ופנאי', color: '#DB2777', type: 'expense' },
  { id: 'business_exp', label: 'הוצאות עסק / ייצור הכנסה', color: '#475569', type: 'expense' },
  { id: 'other', label: 'אחר', color: '#64748B', type: 'expense' },
];

export const DEFAULT_INCOME_CATS: CategoryItem[] = [
  { id: 'salary', label: 'משכורת', color: '#16A34A', type: 'income', defaultMaaserEligible: true },
  { id: 'freelance', label: 'עסק / פרילנס', color: '#0D9488', type: 'income', defaultMaaserEligible: true },
  { id: 'investment', label: 'רווחי הון והשקעות', color: '#2563EB', type: 'income', defaultMaaserEligible: true },
  { id: 'allowance', label: 'קצבאות ומלגות', color: '#7C3AED', type: 'income', defaultMaaserEligible: true },
  { id: 'gift', label: 'מתנות כספיות', color: '#D97706', type: 'income', defaultMaaserEligible: true },
  { id: 'other_income', label: 'הכנסה אחרת', color: '#64748B', type: 'income', defaultMaaserEligible: true },
];

export const MAASER_CATEGORIES: { id: MaaserCategoryId; label: string; description: string }[] = [
  { id: 'torah', label: 'החזקת תורה וישיבות', description: 'תמיכה בלומדי תורה, כוללים ומוסדות תורניים' },
  { id: 'poor', label: 'מתנות לאביונים ומשפחות נזקקות', description: 'סיוע ישיר במזון, ביגוד או כסף לעניים' },
  { id: 'hachnasat_kallah', label: 'הכנסת כלה', description: 'סיוע לחתנים וכלות מעוטי יכולת' },
  { id: 'medical_chesed', label: 'רפואה וארגוני חסד', description: 'הצלה, השאלת ציוד רפואי וסיוע לחולים' },
  { id: 'synagogue', label: 'בית כנסת ועליות', description: 'נדרים, עליות לתורה ותחזוקת בית הכנסת' },
  { id: 'general', label: 'צדקה כללית', description: 'תרומות שונות ומטרות צדקה כלליות' },
];

export const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'credit', label: 'כרטיס אשראי' },
  { id: 'bank_transfer', label: 'העברה בנקאית' },
  { id: 'bit_paybox', label: 'ביט / פייבוקס' },
  { id: 'cash', label: 'מזומן' },
  { id: 'check', label: 'שיק' },
];

export const HE_MONTHS = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

export const HE_DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

export const BADGE_THRESHOLDS = [
  { n: 1, label: 'שבוע חיסכון ראשון', desc: 'סיימתם שבוע ראשון ביתרה חיובית' },
  { n: 4, label: 'חודש של יציבות', desc: '4 שבועות של שליטה מלאה בתקציב' },
  { n: 8, label: 'חודשיים ברצף', desc: '8 שבועות של חיסכון עקבי' },
  { n: 12, label: 'רבעון מנצח', desc: '12 שבועות של מאזן חיובי' },
  { n: 26, label: 'חצי שנת צמיחה', desc: '26 שבועות של ניהול מופתי' },
  { n: 52, label: 'כתר השנה הפיננסית', desc: 'שנה שלמה של חיסכון והתמדה' },
];

export const DEFAULT_MAASER_SETTINGS: MaaserSettings = {
  ratePercent: 10,
  deductEarningExpenses: true,
  calculationScope: 'cumulative',
  openingBalance: 0,
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function getSeedData(): {
  transactions: Transaction[];
  maaserDonations: MaaserDonation[];
  goals: Record<string, number>;
  savingsFunds: SavingsFund[];
  recurringTemplates: RecurringTemplate[];
} {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;

  const getOffsetPrefix = (monthsBack: number) => {
    const d = new Date(y, m - 1 - monthsBack, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  };

  const curPrefix = getOffsetPrefix(0);
  const prevPrefix = getOffsetPrefix(1);
  const prev2Prefix = getOffsetPrefix(2);
  const prev3Prefix = getOffsetPrefix(3);

  const transactions: Transaction[] = [
    // Current Month Transactions
    {
      id: 'seed-inc-1',
      type: 'income',
      category: 'salary',
      categoryLabel: 'משכורת',
      amount: 16500,
      note: 'משכורת חודשית נטו - הייטק',
      date: `${curPrefix}-01`,
      paymentMethod: 'bank_transfer',
      isRecurring: true,
      isMaaserEligible: true,
    },
    {
      id: 'seed-inc-2',
      type: 'income',
      category: 'freelance',
      categoryLabel: 'עסק / פרילנס',
      amount: 4200,
      note: 'פרויקט ייעוץ ופיתוח מערכת',
      date: `${curPrefix}-05`,
      paymentMethod: 'bank_transfer',
      isRecurring: false,
      isMaaserEligible: true,
    },
    {
      id: 'seed-exp-1',
      type: 'expense',
      category: 'home',
      categoryLabel: 'דיור וחשבונות',
      amount: 5400,
      note: 'שכירות / משכנתא וועד בית',
      date: `${curPrefix}-02`,
      paymentMethod: 'bank_transfer',
      isRecurring: true,
    },
    {
      id: 'seed-exp-2',
      type: 'expense',
      category: 'food',
      categoryLabel: 'מזון וסופרמרקט',
      amount: 1180,
      note: 'קנייה מרוכזת לשבת - שבוע 1',
      date: `${curPrefix}-03`,
      paymentMethod: 'credit',
    },
    {
      id: 'seed-exp-2b',
      type: 'expense',
      category: 'food',
      categoryLabel: 'מזון וסופרמרקט',
      amount: 890,
      note: 'השלמות סופרמרקט ושוק',
      date: `${curPrefix}-07`,
      paymentMethod: 'credit',
    },
    {
      id: 'seed-exp-3',
      type: 'expense',
      category: 'transport',
      categoryLabel: 'תחבורה ורכב',
      amount: 520,
      note: 'תדלוק וחניה',
      date: `${curPrefix}-06`,
      paymentMethod: 'credit',
    },
    {
      id: 'seed-exp-4',
      type: 'expense',
      category: 'education',
      categoryLabel: 'חינוך וחוגים',
      amount: 1150,
      note: 'שכר לימוד וחוגים לילדים',
      date: `${curPrefix}-07`,
      paymentMethod: 'credit',
      isRecurring: true,
    },
    {
      id: 'seed-exp-5',
      type: 'expense',
      category: 'business_exp',
      categoryLabel: 'הוצאות עסק / ייצור הכנסה',
      amount: 500,
      note: 'ציוד ורישיונות תוכנה לעסק (מנוכה מחישוב מעשר)',
      date: `${curPrefix}-08`,
      paymentMethod: 'credit',
      isDeductibleFromIncome: true,
    },
    {
      id: 'seed-exp-6',
      type: 'expense',
      category: 'shopping',
      categoryLabel: 'קניות וביגוד',
      amount: 460,
      note: 'ביגוד והנעלה לילדים',
      date: `${curPrefix}-08`,
      paymentMethod: 'credit',
    },

    // Month -1 (Previous Month Full Cycle)
    {
      id: 'seed-prev-inc-1',
      type: 'income',
      category: 'salary',
      categoryLabel: 'משכורת',
      amount: 16500,
      note: 'משכורת חודש קודם',
      date: `${prevPrefix}-01`,
      paymentMethod: 'bank_transfer',
      isRecurring: true,
      isMaaserEligible: true,
    },
    {
      id: 'seed-prev-inc-2',
      type: 'income',
      category: 'allowance',
      categoryLabel: 'קצבאות ומלגות',
      amount: 650,
      note: 'קצבת ילדים מביטוח לאומי',
      date: `${prevPrefix}-20`,
      paymentMethod: 'bank_transfer',
      isRecurring: true,
      isMaaserEligible: true,
    },
    {
      id: 'seed-prev-exp-1',
      type: 'expense',
      category: 'home',
      categoryLabel: 'דיור וחשבונות',
      amount: 5400,
      note: 'שכירות / משכנתא וועד בית',
      date: `${prevPrefix}-02`,
      paymentMethod: 'bank_transfer',
      isRecurring: true,
    },
    {
      id: 'seed-prev-exp-1b',
      type: 'expense',
      category: 'home',
      categoryLabel: 'דיור וחשבונות',
      amount: 680,
      note: 'חשבון חשמל, מים וארנונה דו-חודשי',
      date: `${prevPrefix}-18`,
      paymentMethod: 'credit',
      isRecurring: true,
    },
    {
      id: 'seed-prev-exp-2',
      type: 'expense',
      category: 'food',
      categoryLabel: 'מזון וסופרמרקט',
      amount: 3150,
      note: 'קניות מזון וסופרמרקט חודשיות',
      date: `${prevPrefix}-14`,
      paymentMethod: 'credit',
    },
    {
      id: 'seed-prev-exp-3',
      type: 'expense',
      category: 'transport',
      categoryLabel: 'תחבורה ורכב',
      amount: 1120,
      note: 'דלק, כביש 6 ורב-קו',
      date: `${prevPrefix}-19`,
      paymentMethod: 'credit',
    },
    {
      id: 'seed-prev-exp-4',
      type: 'expense',
      category: 'education',
      categoryLabel: 'חינוך וחוגים',
      amount: 1150,
      note: 'שכר לימוד וחוגים לילדים',
      date: `${prevPrefix}-07`,
      paymentMethod: 'credit',
      isRecurring: true,
    },
    {
      id: 'seed-prev-exp-5',
      type: 'expense',
      category: 'health',
      categoryLabel: 'בריאות ורפואה',
      amount: 420,
      note: 'ביטוח בריאות משלים וקופת חולים',
      date: `${prevPrefix}-16`,
      paymentMethod: 'credit',
      isRecurring: true,
    },
    {
      id: 'seed-prev-exp-6',
      type: 'expense',
      category: 'fun',
      categoryLabel: 'בילויים ופנאי',
      amount: 580,
      note: 'יציאה משפחתית ומסעדה',
      date: `${prevPrefix}-24`,
      paymentMethod: 'credit',
    },

    // Month -2
    {
      id: 'seed-prev2-inc-1',
      type: 'income',
      category: 'salary',
      categoryLabel: 'משכורת',
      amount: 16500,
      note: 'משכורת חודשית',
      date: `${prev2Prefix}-01`,
      paymentMethod: 'bank_transfer',
      isRecurring: true,
      isMaaserEligible: true,
    },
    {
      id: 'seed-prev2-exp-1',
      type: 'expense',
      category: 'home',
      categoryLabel: 'דיור וחשבונות',
      amount: 5850,
      note: 'שכירות וחשבונות שוטפים',
      date: `${prev2Prefix}-03`,
      paymentMethod: 'bank_transfer',
      isRecurring: true,
    },
    {
      id: 'seed-prev2-exp-2',
      type: 'expense',
      category: 'food',
      categoryLabel: 'מזון וסופרמרקט',
      amount: 2980,
      note: 'מזון וקניות לבית',
      date: `${prev2Prefix}-15`,
      paymentMethod: 'credit',
    },
    {
      id: 'seed-prev2-exp-3',
      type: 'expense',
      category: 'transport',
      categoryLabel: 'תחבורה ורכב',
      amount: 1050,
      note: 'דלק ותחבורה',
      date: `${prev2Prefix}-21`,
      paymentMethod: 'credit',
    },
    {
      id: 'seed-prev2-exp-4',
      type: 'expense',
      category: 'education',
      categoryLabel: 'חינוך וחוגים',
      amount: 1150,
      note: 'שכר לימוד וחוגים',
      date: `${prev2Prefix}-07`,
      paymentMethod: 'credit',
      isRecurring: true,
    },

    // Month -3
    {
      id: 'seed-prev3-inc-1',
      type: 'income',
      category: 'salary',
      categoryLabel: 'משכורת',
      amount: 16200,
      note: 'משכורת חודשית',
      date: `${prev3Prefix}-01`,
      paymentMethod: 'bank_transfer',
      isRecurring: true,
      isMaaserEligible: true,
    },
    {
      id: 'seed-prev3-exp-1',
      type: 'expense',
      category: 'home',
      categoryLabel: 'דיור וחשבונות',
      amount: 5400,
      note: 'דיור ומשכנתא',
      date: `${prev3Prefix}-02`,
      paymentMethod: 'bank_transfer',
      isRecurring: true,
    },
    {
      id: 'seed-prev3-exp-2',
      type: 'expense',
      category: 'food',
      categoryLabel: 'מזון וסופרמרקט',
      amount: 3100,
      note: 'סופרמרקט וקניות מזון',
      date: `${prev3Prefix}-12`,
      paymentMethod: 'credit',
    },
  ];

  const maaserDonations: MaaserDonation[] = [
    {
      id: 'seed-maaser-1',
      recipient: 'כולל "אור התורה"',
      category: 'torah',
      categoryLabel: 'החזקת תורה וישיבות',
      amount: 1000,
      date: `${curPrefix}-03`,
      paymentMethod: 'credit',
      receiptNumber: '46-99812',
      hasTaxCredit46: true,
      status: 'paid',
      isRecurring: true,
      note: 'הוראת קבע חודשית להחזקת אברכים',
    },
    {
      id: 'seed-maaser-2',
      recipient: 'קופת החסד השכונתית - סלי מזון',
      category: 'poor',
      categoryLabel: 'מתנות לאביונים ומשפחות נזקקות',
      amount: 450,
      date: `${curPrefix}-06`,
      paymentMethod: 'bit_paybox',
      receiptNumber: '46-11204',
      hasTaxCredit46: true,
      status: 'paid',
      isRecurring: false,
      note: 'חלוקת סלי שבת למשפחות',
    },
    {
      id: 'seed-maaser-3',
      recipient: 'עלייה לתורה - בית הכנסת המרכזי',
      category: 'synagogue',
      categoryLabel: 'בית כנסת ועליות',
      amount: 250,
      date: `${curPrefix}-08`,
      paymentMethod: 'bank_transfer',
      status: 'pledged',
      isRecurring: false,
      note: 'נדר מעלייה לתורה בשבת מברכים',
    },
    {
      id: 'seed-maaser-prev-1',
      recipient: 'ישיבת בית מדרש גבוה',
      category: 'torah',
      categoryLabel: 'החזקת תורה וישיבות',
      amount: 1650,
      date: `${prevPrefix}-10`,
      paymentMethod: 'credit',
      receiptNumber: '46-88210',
      hasTaxCredit46: true,
      status: 'paid',
      isRecurring: true,
      note: 'מעשר מלא חודש קודם',
    },
  ];

  const goals: Record<string, number> = {
    food: 3200,
    home: 5600,
    transport: 1200,
    education: 1500,
    health: 600,
    shopping: 1000,
    fun: 800,
  };

  const savingsFunds: SavingsFund[] = [
    {
      id: 'fund-1',
      name: 'קרן חירום וביטחון משפחתי',
      targetAmount: 50000,
      currentAmount: 32500,
      targetDate: `${y + 1}-06-01`,
      note: 'פק״מ נזיל ל-3 חודשי מחיה',
    },
    {
      id: 'fund-2',
      name: 'חופשה משפחתית בקיץ',
      targetAmount: 12000,
      currentAmount: 7800,
      targetDate: `${y}-08-01`,
      note: 'נופש בצפון כולל אטרקציות',
    },
    {
      id: 'fund-3',
      name: 'קרן שמחות ואירועים',
      targetAmount: 25000,
      currentAmount: 11200,
      note: 'חיסכון ייעודי לבר מצווה ושמחות',
    },
  ];

  const recurringTemplates: RecurringTemplate[] = [
    {
      id: 'rec-tpl-1',
      title: 'משכורת חודשית נטו - הייטק',
      type: 'income',
      category: 'salary',
      categoryLabel: 'משכורת',
      amount: 16500,
      dayOfMonth: 1,
      paymentMethod: 'bank_transfer',
      autoGenerate: true,
      active: true,
      isMaaserEligible: true,
      lastGeneratedMonth: curPrefix,
    },
    {
      id: 'rec-tpl-2',
      title: 'שכירות / משכנתא וועד בית',
      type: 'expense',
      category: 'home',
      categoryLabel: 'דיור וחשבונות',
      amount: 5400,
      dayOfMonth: 2,
      paymentMethod: 'bank_transfer',
      autoGenerate: true,
      active: true,
      lastGeneratedMonth: curPrefix,
    },
    {
      id: 'rec-tpl-3',
      title: 'שכר לימוד וחוגים לילדים',
      type: 'expense',
      category: 'education',
      categoryLabel: 'חינוך וחוגים',
      amount: 1150,
      dayOfMonth: 7,
      paymentMethod: 'credit',
      autoGenerate: true,
      active: true,
      lastGeneratedMonth: curPrefix,
    },
    {
      id: 'rec-tpl-4',
      title: 'חשבון חשמל, מים וארנונה',
      type: 'expense',
      category: 'home',
      categoryLabel: 'דיור וחשבונות',
      amount: 680,
      dayOfMonth: 18,
      paymentMethod: 'credit',
      autoGenerate: false, // Will prompt a reminder for user confirmation!
      active: true,
      lastGeneratedMonth: prevPrefix,
    },
    {
      id: 'rec-tpl-5',
      title: 'ביטוח בריאות משלים וקופת חולים',
      type: 'expense',
      category: 'health',
      categoryLabel: 'בריאות ורפואה',
      amount: 420,
      dayOfMonth: 16,
      paymentMethod: 'credit',
      autoGenerate: false, // Will prompt a reminder for user confirmation!
      active: true,
      lastGeneratedMonth: prevPrefix,
    },
    {
      id: 'rec-tpl-6',
      title: 'קצבת ילדים מביטוח לאומי',
      type: 'income',
      category: 'allowance',
      categoryLabel: 'קצבאות ומלגות',
      amount: 650,
      dayOfMonth: 20,
      paymentMethod: 'bank_transfer',
      autoGenerate: true,
      active: true,
      isMaaserEligible: true,
      lastGeneratedMonth: prevPrefix,
    },
    {
      id: 'rec-tpl-7',
      title: 'אינטרנט סיבים וסלולר משפחתי',
      type: 'expense',
      category: 'home',
      categoryLabel: 'דיור וחשבונות',
      amount: 210,
      dayOfMonth: 14,
      paymentMethod: 'credit',
      autoGenerate: false,
      active: true,
      lastGeneratedMonth: prevPrefix,
    },
  ];

  return { transactions, maaserDonations, goals, savingsFunds, recurringTemplates };
}

export const QUICK_EXPENSE_PRESETS: {
  label: string;
  category: string;
  amount: number;
  paymentMethod: PaymentMethod;
}[] = [
  { label: 'קניית סופרמרקט שבועית', category: 'food', amount: 650, paymentMethod: 'credit' },
  { label: 'תדלוק רכב מלא', category: 'transport', amount: 280, paymentMethod: 'credit' },
  { label: 'השלמות מכולת / מאפייה', category: 'food', amount: 85, paymentMethod: 'bit_paybox' },
  { label: 'בית מרקחת / תרופות', category: 'health', amount: 110, paymentMethod: 'credit' },
  { label: 'בילוי / אוכל בחוץ', category: 'fun', amount: 160, paymentMethod: 'credit' },
];
