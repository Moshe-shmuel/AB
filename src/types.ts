export type TransactionType = 'expense' | 'income';

export type PaymentMethod = 'credit' | 'bank_transfer' | 'cash' | 'bit_paybox' | 'check';

export type MaaserCategoryId =
  | 'torah'
  | 'poor'
  | 'hachnasat_kallah'
  | 'medical_chesed'
  | 'synagogue'
  | 'general';

export interface CategoryItem {
  id: string;
  label: string;
  color: string;
  type: TransactionType;
  defaultMaaserEligible?: boolean;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  category: string;
  categoryLabel: string;
  amount: number;
  note: string;
  date: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  isRecurring?: boolean;
  // Maaser linkage
  isMaaserEligible?: boolean; // For income: included in Maaser obligation
  isDeductibleFromIncome?: boolean; // For expense: deducted from obligated income (הוצאות ייצור הכנסה)
  isMaaserPayment?: boolean; // For expense: counts directly as paid Tzedakah/Maaser
}

export interface MaaserDonation {
  id: string;
  recipient: string;
  category: MaaserCategoryId;
  categoryLabel: string;
  amount: number;
  date: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  receiptNumber?: string;
  hasTaxCredit46?: boolean;
  status: 'paid' | 'pledged';
  isRecurring?: boolean;
  note?: string;
}

export interface MaaserSettings {
  ratePercent: number; // 10 for Maaser, 20 for Chumash, or custom
  deductEarningExpenses: boolean;
  calculationScope: 'monthly' | 'cumulative';
  openingBalance: number; // Positive = debt left to pay, Negative = surplus credit carried forward
}

export interface SavingsFund {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  note?: string;
}

export interface RecurringTemplate {
  id: string;
  title: string;
  type: TransactionType;
  category: string;
  categoryLabel: string;
  amount: number;
  dayOfMonth: number; // 1..28
  paymentMethod: PaymentMethod;
  autoGenerate: boolean; // true = auto-create at month start, false = show reminder to confirm
  active: boolean;
  isMaaserEligible?: boolean;
  isDeductibleFromIncome?: boolean;
  isMaaserPayment?: boolean;
  lastGeneratedMonth?: string; // YYYY-MM
  skippedMonths?: string[]; // YYYY-MM list of months skipped by user
}

export type ActiveTab =
  | 'overview'
  | 'recurring'
  | 'forecast'
  | 'maaserot'
  | 'calendar'
  | 'categories'
  | 'goals'
  | 'compare'
  | 'rewards';

export interface AppBackupPayload {
  version: string;
  exportedAt: string;
  transactions: Transaction[];
  maaserDonations: MaaserDonation[];
  maaserSettings: MaaserSettings;
  goals: Record<string, number>;
  customCategories: CategoryItem[];
  savingsFunds: SavingsFund[];
  recurringTemplates?: RecurringTemplate[];
}
