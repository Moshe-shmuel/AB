import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Layers,
  Plus,
  Sliders,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { CategoryItem, MaaserSettings, SavingsFund, Transaction } from '../types';
import { HE_DAYS, HE_MONTHS } from '../constants';
import { formatILS } from '../utils/portableExporter';

interface ForecastAndAnalyticsViewProps {
  viewYear: number;
  viewMonth: number;
  transactions: Transaction[];
  expenseCategories: CategoryItem[];
  goals: Record<string, number>;
  maaserSettings: MaaserSettings;
  savingsFunds: SavingsFund[];
  onQuickAddTransaction: (tx: Omit<Transaction, 'id'>) => void;
}

type ForecastModel = 'smart_hybrid' | 'linear_run_rate' | 'historical_baseline';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export const ForecastAndAnalyticsView: React.FC<ForecastAndAnalyticsViewProps> = ({
  viewYear,
  viewMonth,
  transactions,
  expenseCategories,
  goals,
  maaserSettings,
  onQuickAddTransaction,
}) => {
  const now = new Date();
  const isCurrentRealMonth =
    viewYear === now.getFullYear() && viewMonth === now.getMonth();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // Allow user to inspect real current day or simulate any cutoff day in the month
  const defaultCutoffDay = isCurrentRealMonth
    ? Math.max(1, now.getDate())
    : daysInMonth;
  const [simulatedDay, setSimulatedDay] = useState<number>(defaultCutoffDay);
  const [forecastModel, setForecastModel] = useState<ForecastModel>('smart_hybrid');
  const [includeExpectedRecurring, setIncludeExpectedRecurring] = useState<boolean>(true);

  // What-If Simulator State
  const [cutVariablePct, setCutVariablePct] = useState<number>(10);
  const [extraIncomeMonthly, setExtraIncomeMonthly] = useState<number>(0);
  const [annualYieldPct, setAnnualYieldPct] = useState<number>(4.5);

  // Installment Planner State
  const [purchaseTotal, setPurchaseTotal] = useState<string>('3600');
  const [installmentsCount, setInstallmentsCount] = useState<string>('6');
  const [installmentCategory, setInstallmentCategory] = useState<string>('shopping');

  // Keep simulatedDay synced when switching months
  React.useEffect(() => {
    setSimulatedDay(
      viewYear === now.getFullYear() && viewMonth === now.getMonth()
        ? Math.max(1, now.getDate())
        : new Date(viewYear, viewMonth + 1, 0).getDate()
    );
  }, [viewYear, viewMonth]);

  const elapsedDays = Math.min(daysInMonth, Math.max(1, simulatedDay));
  const remainingDays = Math.max(0, daysInMonth - elapsedDays);
  const currentMonthPrefix = `${viewYear}-${pad(viewMonth + 1)}`;

  // Core Deterministic Statistical & Run-Rate Analysis
  const analysis = useMemo(() => {
    // 1. Separate current month transactions up to simulatedDay vs historical months
    const currentMonthTx = transactions.filter((t) => {
      if (t.date.slice(0, 7) !== currentMonthPrefix) return false;
      const dayNum = parseInt(t.date.slice(8, 10), 10);
      return dayNum <= elapsedDays;
    });

    // Previous 3 months prefixes
    const prevPrefixes: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(viewYear, viewMonth - i, 1);
      prevPrefixes.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
    }

    const historicalTx = transactions.filter((t) =>
      prevPrefixes.includes(t.date.slice(0, 7))
    );
    const activeHistoricalMonthsCount = Math.max(
      1,
      new Set(historicalTx.map((t) => t.date.slice(0, 7))).size
    );

    // 2. Analyze weekday spending weights from all available history + current month
    const weekdaySpend = [0, 0, 0, 0, 0, 0, 0];
    const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
    for (const t of transactions) {
      if (t.type === 'expense' && !t.isRecurring) {
        const d = new Date(t.date + 'T00:00:00');
        const wd = d.getDay();
        weekdaySpend[wd] += t.amount;
        weekdayCounts[wd] += 1;
      }
    }
    const totalVariableAllTime = weekdaySpend.reduce((a, b) => a + b, 0);
    // Relative weight of each weekday (1.0 = average day)
    const weekdayWeights = weekdaySpend.map((amt) =>
      totalVariableAllTime > 0 ? (amt / totalVariableAllTime) * 7 : 1
    );

    // Compute weekday weight multiplier for the remaining days of the current month
    let remainingWeightedDays = 0;
    for (let d = elapsedDays + 1; d <= daysInMonth; d++) {
      const wd = new Date(viewYear, viewMonth, d).getDay();
      // Blend 50% uniform day + 50% empirical weekday pattern for stability
      const weight = 0.5 + 0.5 * weekdayWeights[wd];
      remainingWeightedDays += weight;
    }

    // 3. Detect Expected Recurring Transactions from previous month that haven't occurred yet this month
    const lastMonthPrefix = prevPrefixes[0];
    const lastMonthRecurring = transactions.filter(
      (t) => t.date.slice(0, 7) === lastMonthPrefix && t.isRecurring
    );

    const upcomingRecurring: {
      template: Transaction;
      expectedDay: number;
      expectedDate: string;
    }[] = [];

    for (const prevRec of lastMonthRecurring) {
      const expectedDay = Math.min(daysInMonth, parseInt(prevRec.date.slice(8, 10), 10));
      // Check if an equivalent recurring transaction already exists in currentMonthTx
      const alreadyLogged = currentMonthTx.some(
        (cur) =>
          cur.type === prevRec.type &&
          cur.category === prevRec.category &&
          cur.isRecurring &&
          Math.abs(cur.amount - prevRec.amount) / Math.max(1, prevRec.amount) < 0.25
      );
      if (!alreadyLogged) {
        upcomingRecurring.push({
          template: prevRec,
          expectedDay: Math.max(elapsedDays + 1, expectedDay),
          expectedDate: `${currentMonthPrefix}-${pad(Math.min(daysInMonth, expectedDay))}`,
        });
      }
    }

    const expectedRecurringExpenses = includeExpectedRecurring
      ? upcomingRecurring
          .filter((u) => u.template.type === 'expense')
          .reduce((s, u) => s + u.template.amount, 0)
      : 0;

    const expectedRecurringIncomes = includeExpectedRecurring
      ? upcomingRecurring
          .filter((u) => u.template.type === 'income')
          .reduce((s, u) => s + u.template.amount, 0)
      : 0;

    // 4. Current Month Fixed vs Variable Totals So Far
    let fixedExpenseSoFar = 0;
    let variableExpenseSoFar = 0;
    let incomeSoFar = 0;

    for (const t of currentMonthTx) {
      if (t.type === 'income') {
        incomeSoFar += t.amount;
      } else {
        if (t.isRecurring) fixedExpenseSoFar += t.amount;
        else variableExpenseSoFar += t.amount;
      }
    }

    const totalExpenseSoFar = fixedExpenseSoFar + variableExpenseSoFar;

    // Historical Variable & Total Monthly Averages
    let histVariableTotal = 0;
    let histTotalExpense = 0;
    let histTotalIncome = 0;
    for (const t of historicalTx) {
      if (t.type === 'income') {
        histTotalIncome += t.amount;
      } else {
        histTotalExpense += t.amount;
        if (!t.isRecurring) histVariableTotal += t.amount;
      }
    }
    const avgHistVariableMonthly = histVariableTotal / activeHistoricalMonthsCount;
    const avgHistDailyVariable = avgHistVariableMonthly / 30;
    const avgHistTotalMonthlyExpense = histTotalExpense / activeHistoricalMonthsCount;

    // Current Daily Run Rate (Variable & Total)
    const currentDailyVariableRate = variableExpenseSoFar / elapsedDays;
    const currentDailyTotalRate = totalExpenseSoFar / elapsedDays;

    // 5. Calculate Projected Variable Spend for Remaining Days under the 3 Models
    const linearProjectedRemainingVariable = currentDailyVariableRate * remainingDays;
    const historicalProjectedRemainingVariable = avgHistDailyVariable * remainingWeightedDays;
    const hybridProjectedRemainingVariable =
      0.6 * (currentDailyVariableRate * remainingWeightedDays) +
      0.4 * (avgHistDailyVariable * remainingDays);

    let selectedRemainingVariable = hybridProjectedRemainingVariable;
    if (forecastModel === 'linear_run_rate') {
      selectedRemainingVariable = linearProjectedRemainingVariable;
    } else if (forecastModel === 'historical_baseline') {
      selectedRemainingVariable = historicalProjectedRemainingVariable;
    }

    const projectedEndMonthExpense =
      totalExpenseSoFar + expectedRecurringExpenses + selectedRemainingVariable;
    const projectedEndMonthIncome = incomeSoFar + expectedRecurringIncomes;
    const projectedEndMonthBalance = projectedEndMonthIncome - projectedEndMonthExpense;

    // Total Budget Goal Comparison
    const totalBudgetGoal = Object.values(goals).reduce(
      (s: number, v) => s + (Number(v) || 0),
      0
    );
    const effectiveTargetCap =
      totalBudgetGoal > 0 ? totalBudgetGoal : projectedEndMonthIncome * 0.85;

    const remainingBudgetAfterFixed = Math.max(
      0,
      effectiveTargetCap - totalExpenseSoFar - expectedRecurringExpenses
    );
    const safeDailyAllowance =
      remainingDays > 0 ? remainingBudgetAfterFixed / remainingDays : 0;

    // 6. Category-by-Category Forecast Table
    const categoryForecasts = expenseCategories.map((cat) => {
      const catCurrTx = currentMonthTx.filter(
        (t) => t.type === 'expense' && t.category === cat.id
      );
      const catFixedSoFar = catCurrTx
        .filter((t) => t.isRecurring)
        .reduce((s, t) => s + t.amount, 0);
      const catVarSoFar = catCurrTx
        .filter((t) => !t.isRecurring)
        .reduce((s, t) => s + t.amount, 0);
      const catSpentSoFar = catFixedSoFar + catVarSoFar;

      const catUpcomingFixed = includeExpectedRecurring
        ? upcomingRecurring
            .filter(
              (u) => u.template.type === 'expense' && u.template.category === cat.id
            )
            .reduce((s, u) => s + u.template.amount, 0)
        : 0;

      const catHistTotal = historicalTx
        .filter((t) => t.type === 'expense' && t.category === cat.id)
        .reduce((s, t) => s + t.amount, 0);
      const catHistVarTotal = historicalTx
        .filter(
          (t) => t.type === 'expense' && t.category === cat.id && !t.isRecurring
        )
        .reduce((s, t) => s + t.amount, 0);

      const catHistAvg = catHistTotal / activeHistoricalMonthsCount;
      const catHistDailyVar = catHistVarTotal / activeHistoricalMonthsCount / 30;
      const catCurrDailyVar = catVarSoFar / elapsedDays;

      let catRemVar = 0;
      if (forecastModel === 'linear_run_rate') {
        catRemVar = catCurrDailyVar * remainingDays;
      } else if (forecastModel === 'historical_baseline') {
        catRemVar = catHistDailyVar * remainingDays;
      } else {
        catRemVar = (0.6 * catCurrDailyVar + 0.4 * catHistDailyVar) * remainingDays;
      }

      const catProjectedTotal = catSpentSoFar + catUpcomingFixed + catRemVar;
      const catGoal = Number(goals[cat.id]) || 0;
      const catVariance = catGoal > 0 ? catGoal - catProjectedTotal : catHistAvg - catProjectedTotal;
      const catSafeDaily =
        remainingDays > 0 && catGoal > 0
          ? Math.max(0, (catGoal - catSpentSoFar - catUpcomingFixed) / remainingDays)
          : 0;

      // Anomaly / Creep detection: is projected >15% above historical average?
      const creepRatio =
        catHistAvg > 100 ? (catProjectedTotal - catHistAvg) / catHistAvg : 0;

      return {
        category: cat,
        spentSoFar: catSpentSoFar,
        upcomingFixed: catUpcomingFixed,
        histAvg: catHistAvg,
        dailyRate: catCurrDailyVar,
        projectedTotal: catProjectedTotal,
        goal: catGoal,
        variance: catVariance,
        safeDaily: catSafeDaily,
        creepRatio,
      };
    });

    // 7. Build Daily Cumulative Trajectory Series (Day 1 .. daysInMonth) for SVG Chart
    const dailySeries: {
      day: number;
      actualCumulative: number | null;
      projectedCumulative: number | null;
      budgetPace: number;
    }[] = [];

    let runningActual = 0;
    let runningProjected = totalExpenseSoFar;
    const dailyProjectedStep =
      remainingDays > 0 ? selectedRemainingVariable / remainingDays : 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = `${currentMonthPrefix}-${pad(d)}`;
      if (d <= elapsedDays) {
        const daySum = currentMonthTx
          .filter((t) => t.type === 'expense' && t.date === dayStr)
          .reduce((s, t) => s + t.amount, 0);
        runningActual += daySum;
        dailySeries.push({
          day: d,
          actualCumulative: runningActual,
          projectedCumulative: d === elapsedDays ? runningActual : null,
          budgetPace: (effectiveTargetCap / daysInMonth) * d,
        });
      } else {
        const dayUpcomingRec = includeExpectedRecurring
          ? upcomingRecurring
              .filter(
                (u) => u.template.type === 'expense' && u.expectedDay === d
              )
              .reduce((s, u) => s + u.template.amount, 0)
          : 0;
        runningProjected += dailyProjectedStep + dayUpcomingRec;
        dailySeries.push({
          day: d,
          actualCumulative: null,
          projectedCumulative: runningProjected,
          budgetPace: (effectiveTargetCap / daysInMonth) * d,
        });
      }
    }

    return {
      incomeSoFar,
      fixedExpenseSoFar,
      variableExpenseSoFar,
      totalExpenseSoFar,
      expectedRecurringExpenses,
      expectedRecurringIncomes,
      upcomingRecurring,
      currentDailyVariableRate,
      currentDailyTotalRate,
      avgHistDailyVariable,
      avgHistTotalMonthlyExpense,
      projectedEndMonthExpense,
      projectedEndMonthIncome,
      projectedEndMonthBalance,
      totalBudgetGoal,
      effectiveTargetCap,
      safeDailyAllowance,
      categoryForecasts,
      dailySeries,
      weekdaySpend,
    };
  }, [
    transactions,
    currentMonthPrefix,
    elapsedDays,
    daysInMonth,
    viewYear,
    viewMonth,
    includeExpectedRecurring,
    forecastModel,
    goals,
    expenseCategories,
  ]);

  // What-If Simulator Calculations
  const whatIfResults = useMemo(() => {
    const monthlySavedFromCut =
      (analysis.variableExpenseSoFar / elapsedDays) * 30 * (cutVariablePct / 100);
    const newMonthlyNet =
      analysis.projectedEndMonthBalance + monthlySavedFromCut + extraIncomeMonthly;
    const extraMaaserMonthly =
      extraIncomeMonthly > 0
        ? (extraIncomeMonthly * maaserSettings.ratePercent) / 100
        : 0;
    const netInvestableMonthly = Math.max(0, newMonthlyNet - extraMaaserMonthly);

    // Compound future value over N years with monthly contributions
    const calcFV = (years: number) => {
      const r = annualYieldPct / 100 / 12;
      const n = years * 12;
      if (r === 0) return netInvestableMonthly * n;
      return netInvestableMonthly * ((Math.pow(1 + r, n) - 1) / r);
    };

    return {
      monthlySavedFromCut,
      newMonthlyNet,
      extraMaaserMonthly,
      fv1Year: calcFV(1),
      fv3Years: calcFV(3),
      fv5Years: calcFV(5),
    };
  }, [
    analysis.variableExpenseSoFar,
    analysis.projectedEndMonthBalance,
    elapsedDays,
    cutVariablePct,
    extraIncomeMonthly,
    annualYieldPct,
    maaserSettings.ratePercent,
  ]);

  // Installment Impact Calculation
  const installmentAnalysis = useMemo(() => {
    const total = parseFloat(purchaseTotal) || 0;
    const count = Math.max(1, parseInt(installmentsCount, 10) || 1);
    const monthlyPayment = total / count;
    const catForecast = analysis.categoryForecasts.find(
      (c) => c.category.id === installmentCategory
    );
    const newProjectedBalance = analysis.projectedEndMonthBalance - monthlyPayment;
    const newCatProjected = (catForecast?.projectedTotal || 0) + monthlyPayment;
    const catGoal = catForecast?.goal || 0;
    const exceedsCatGoal = catGoal > 0 && newCatProjected > catGoal;
    const isSafeOverall = newProjectedBalance >= 0 && !exceedsCatGoal;

    return {
      monthlyPayment,
      newProjectedBalance,
      newCatProjected,
      catGoal,
      exceedsCatGoal,
      isSafeOverall,
    };
  }, [purchaseTotal, installmentsCount, installmentCategory, analysis]);

  const budgetDiff = analysis.effectiveTargetCap - analysis.projectedEndMonthExpense;

  return (
    <div className="space-y-6">
      {/* Top Control & Model Selection Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-700" />
            <span>
              חיזוי תקציב לסוף החודש וניתוח קצב ריצה — {HE_MONTHS[viewMonth]} {viewYear}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            חישוב מתמטי וסטטיסטי (100% מקומי וללא קריאות רשת) המבוסס על קצב העסקאות היומי, דפוסי ימי השבוע, והיסטוריית חודשים קודמים
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Model Selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setForecastModel('smart_hybrid')}
              className={`px-3 py-1.5 font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                forecastModel === 'smart_hybrid'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              מודל משוקלל (קצב + היסטוריה)
            </button>
            <button
              type="button"
              onClick={() => setForecastModel('linear_run_rate')}
              className={`px-3 py-1.5 font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                forecastModel === 'linear_run_rate'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              קצב יומי ליניארי (Run-Rate)
            </button>
            <button
              type="button"
              onClick={() => setForecastModel('historical_baseline')}
              className={`px-3 py-1.5 font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                forecastModel === 'historical_baseline'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ממוצע חודשים קודמים
            </button>
          </div>
        </div>
      </div>

      {/* Simulation Day Bar (Allows testing the forecast at any point in the month) */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-800">
            נקודת חיתוך לחישוב בחודש ({elapsedDays} ימים חלפו · {remainingDays} ימים נותרו לסוף החודש):
          </span>
          <input
            type="range"
            min={1}
            max={daysInMonth}
            value={simulatedDay}
            onChange={(e) => setSimulatedDay(parseInt(e.target.value, 10))}
            className="w-44 accent-blue-700 cursor-pointer"
          />
          <span className="font-mono-num font-bold text-blue-700">
            יום {elapsedDays} מתוך {daysInMonth}
          </span>
        </div>

        <label className="inline-flex items-center gap-2 cursor-pointer select-none text-slate-700 font-medium">
          <input
            type="checkbox"
            checked={includeExpectedRecurring}
            onChange={(e) => setIncludeExpectedRecurring(e.target.checked)}
            className="rounded border-slate-300 text-blue-600"
          />
          <span>
            שקלל הוראות קבע צפויות מהחודש הקודם שטרם ירדו ({formatILS(analysis.expectedRecurringExpenses)})
          </span>
        </label>
      </div>

      {/* 4-Column End-of-Month Projection KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">
            צפי הוצאות כולל לסוף החודש
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1.5 font-mono-num tabular-nums">
            {formatILS(analysis.projectedEndMonthExpense)}
          </div>
          <div className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
            <span>עד כה: {formatILS(analysis.totalExpenseSoFar)}</span>
            <span aria-hidden="true">·</span>
            <span>ממוצע היסטורי: {formatILS(analysis.avgHistTotalMonthlyExpense)}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">
            יתרה חזויה בסוף החודש (נטו)
          </div>
          <div
            className={`text-2xl font-bold mt-1.5 font-mono-num tabular-nums ${
              analysis.projectedEndMonthBalance >= 0 ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {formatILS(analysis.projectedEndMonthBalance)}
          </div>
          <div className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
            <span>צפי הכנסות: {formatILS(analysis.projectedEndMonthIncome)}</span>
            <span aria-hidden="true">·</span>
            <span>
              {analysis.projectedEndMonthBalance >= 0 ? 'סיום בעודף' : 'אזהרת גירעון'}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">
            עמידה ביעד התקציב בסוף החודש
          </div>
          <div
            className={`text-2xl font-bold mt-1.5 font-mono-num tabular-nums ${
              budgetDiff >= 0 ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {budgetDiff >= 0
              ? `+${formatILS(budgetDiff)} חיסכון`
              : `−${formatILS(Math.abs(budgetDiff))} חריגה`}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            מול תקרת יעד של {formatILS(analysis.effectiveTargetCap)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">
            תקציב יומי בטוח ל-{remainingDays} הימים הנותרים
          </div>
          <div className="text-2xl font-bold text-blue-700 mt-1.5 font-mono-num tabular-nums">
            {remainingDays > 0 ? `${formatILS(analysis.safeDailyAllowance)} / יום` : 'החודש הסתיים'}
          </div>
          <div className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
            <span>קצב משתנות נוכחי: {formatILS(analysis.currentDailyVariableRate)}/יום</span>
          </div>
        </div>
      </div>

      {/* Cumulative Spend Trajectory Chart + Upcoming Recurring Bills Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Trajectory SVG Chart (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                מסלול הוצאות מצטבר ותחזית עד סוף החודש (יום 1 עד {daysInMonth})
              </h3>
              <p className="text-xs text-slate-500">
                השוואה בין ההוצאה בפועל עד היום, המשך המסלול החזוי, וקו תקציב המטרה
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-blue-700 font-semibold">━ בפועל עד יום {elapsedDays}</span>
              <span className="text-amber-600 font-semibold">┅ צפי עד סוף החודש</span>
              <span className="text-slate-400 font-semibold">─ קו תקציב יעד</span>
            </div>
          </div>

          <TrajectorySvgChart
            series={analysis.dailySeries}
            targetCap={analysis.effectiveTargetCap}
            elapsedDays={elapsedDays}
          />
        </div>

        {/* Upcoming Expected Recurring Bills Radar (4 cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-blue-700" />
              <span>חיובים והכנסות קבועות צפויות</span>
            </h3>
            <span className="text-xs font-mono-num text-slate-500">
              {analysis.upcomingRecurring.length} זוהו
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            על סמך ניתוח החודשים הקודמים, אלו תנועות קבועות שמופיעות אצלכם בדרך כלל אך טרם נרשמו בחודש זה:
          </p>

          {analysis.upcomingRecurring.length === 0 ? (
            <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>כל הוראות הקבע המוכרות מהחודש הקודם כבר נרשמו החודש!</span>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[240px] overflow-y-auto">
              {analysis.upcomingRecurring.map((item, idx) => (
                <div
                  key={`${item.template.id}-${idx}`}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">
                      {item.template.categoryLabel} · {item.template.note || 'קבוע'}
                    </div>
                    <div className="text-slate-500 font-mono-num mt-0.5">
                      צפוי סביב {item.expectedDate}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`font-bold font-mono-num ${
                        item.template.type === 'income'
                          ? 'text-emerald-700'
                          : 'text-red-700'
                      }`}
                    >
                      {item.template.type === 'income' ? '+' : '−'}
                      {formatILS(item.template.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onQuickAddTransaction({
                          type: item.template.type,
                          category: item.template.category,
                          categoryLabel: item.template.categoryLabel,
                          amount: item.template.amount,
                          note: item.template.note,
                          date: item.expectedDate,
                          paymentMethod: item.template.paymentMethod,
                          isRecurring: true,
                          isMaaserEligible: item.template.isMaaserEligible,
                          isDeductibleFromIncome: item.template.isDeductibleFromIncome,
                          isMaaserPayment: item.template.isMaaserPayment,
                        })
                      }
                      title="רשום תנועה זו כעת בחודש הנוכחי"
                      className="px-2 py-1 text-[11px] font-semibold bg-white border border-slate-300 hover:bg-slate-100 rounded text-slate-800 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>רשום</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Category-Level End-of-Month Projection Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              תחזית סוף חודש מפורטת לפי קטגוריות הוצאה
            </h3>
            <p className="text-xs text-slate-500">
              השוואת הוצאה עד כה, קצב יומי משתנה, ממוצע חודשים קודמים, וצפי סיום מול היעד החודשי
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500 bg-slate-50">
                <th className="py-2.5 px-3 text-right font-semibold">קטגוריה</th>
                <th className="py-2.5 px-3 text-left font-semibold">הוצאה עד כה</th>
                <th className="py-2.5 px-3 text-left font-semibold">קצב יומי (משתנות)</th>
                <th className="py-2.5 px-3 text-left font-semibold">ממוצע חודשים קודמים</th>
                <th className="py-2.5 px-3 text-left font-semibold">צפי לסוף החודש</th>
                <th className="py-2.5 px-3 text-left font-semibold">יעד תקציב</th>
                <th className="py-2.5 px-3 text-left font-semibold">חיסכון / חריגה חזויה</th>
                <th className="py-2.5 px-3 text-left font-semibold">מותר ליום (יתרת החודש)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {analysis.categoryForecasts.map((row) => {
                const isOverGoal = row.goal > 0 && row.projectedTotal > row.goal;
                return (
                  <tr key={row.category.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{row.category.label}</span>
                        {row.creepRatio > 0.15 && (
                          <span className="text-[11px] text-amber-700 font-normal">
                            · זחילה (+{Math.round(row.creepRatio * 100)}% מהממוצע)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-left font-mono-num tabular-nums text-slate-700">
                      {formatILS(row.spentSoFar)}
                    </td>
                    <td className="py-3 px-3 text-left font-mono-num tabular-nums text-slate-600 text-xs">
                      {formatILS(row.dailyRate)} / יום
                    </td>
                    <td className="py-3 px-3 text-left font-mono-num tabular-nums text-slate-500">
                      {formatILS(row.histAvg)}
                    </td>
                    <td className="py-3 px-3 text-left font-bold font-mono-num tabular-nums text-slate-900">
                      {formatILS(row.projectedTotal)}
                    </td>
                    <td className="py-3 px-3 text-left font-mono-num tabular-nums text-slate-600">
                      {row.goal > 0 ? formatILS(row.goal) : '—'}
                    </td>
                    <td className="py-3 px-3 text-left font-bold font-mono-num tabular-nums">
                      {row.goal > 0 ? (
                        <span className={isOverGoal ? 'text-red-600' : 'text-emerald-700'}>
                          {isOverGoal
                            ? `−${formatILS(Math.abs(row.variance))} חריגה`
                            : `+${formatILS(row.variance)} יתרה`}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">ללא יעד</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-left font-mono-num tabular-nums text-xs font-semibold text-blue-700">
                      {row.goal > 0 && remainingDays > 0
                        ? `${formatILS(row.safeDaily)} / יום`
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Additional Offline Smart Tools Grid: 1) What-If Simulator, 2) Installment Planner, 3) Weekday Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Interactive What-If & Compound Wealth Simulator (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-700" />
            <h3 className="text-base font-bold text-slate-900">
              סימולטור "מה אם" וצמיחה רב-שנתית
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            בדקו כיצד התאמה קלה בהוצאות המשתנות או בהכנסה החודשית תשפיע על סוף החודש ועל החיסכון המצטבר:
          </p>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between mb-1 font-medium text-slate-700">
                <span>הפחתת הוצאות משתנות:</span>
                <span className="font-mono-num font-bold text-blue-700">
                  {cutVariablePct}% (חיסכון של {formatILS(whatIfResults.monthlySavedFromCut)} לחודש)
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                step={5}
                value={cutVariablePct}
                onChange={(e) => setCutVariablePct(parseInt(e.target.value, 10))}
                className="w-full accent-blue-700 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1 font-medium text-slate-700">
                <span>תוספת הכנסה חודשית נטו:</span>
                <span className="font-mono-num font-bold text-emerald-700">
                  +{formatILS(extraIncomeMonthly)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={10000}
                step={500}
                value={extraIncomeMonthly}
                onChange={(e) => setExtraIncomeMonthly(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1 font-medium text-slate-700">
                <span>תשואה שנתית משוערת על החיסכון (פק״מ / שוק ההון):</span>
                <span className="font-mono-num font-bold text-slate-900">{annualYieldPct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={10}
                step={0.5}
                value={annualYieldPct}
                onChange={(e) => setAnnualYieldPct(parseFloat(e.target.value))}
                className="w-full accent-slate-800 cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center">
            <div className="p-2.5 bg-slate-50 rounded-lg">
              <div className="text-[11px] text-slate-500">חיסכון בעוד שנה</div>
              <div className="text-sm font-bold text-slate-900 font-mono-num mt-0.5">
                {formatILS(whatIfResults.fv1Year)}
              </div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg">
              <div className="text-[11px] text-slate-500">בעוד 3 שנים</div>
              <div className="text-sm font-bold text-blue-700 font-mono-num mt-0.5">
                {formatILS(whatIfResults.fv3Years)}
              </div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg">
              <div className="text-[11px] text-slate-500">בעוד 5 שנים</div>
              <div className="text-sm font-bold text-emerald-700 font-mono-num mt-0.5">
                {formatILS(whatIfResults.fv5Years)}
              </div>
            </div>
          </div>
        </div>

        {/* Installment Purchase Impact Checker (4 cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-blue-700" />
            <h3 className="text-base font-bold text-slate-900">
              בדיקת עסקה בפריסת תשלומים
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            שוקלים רכישה גדולה בתשלומים? בדקו מראש אם תחזית סוף החודש שלכם מסוגלת לספוג את ההחזר החודשי:
          </p>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">סכום עסקה כולל (₪)</label>
              <input
                type="number"
                min="100"
                step="100"
                value={purchaseTotal}
                onChange={(e) => setPurchaseTotal(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">מספר תשלומים</label>
              <select
                value={installmentsCount}
                onChange={(e) => setInstallmentsCount(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white font-mono-num"
              >
                {[1, 2, 3, 4, 6, 10, 12, 18, 24, 36].map((n) => (
                  <option key={n} value={n}>
                    {n} תשלומים
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">שיוך לקטגוריה</label>
            <select
              value={installmentCategory}
              onChange={(e) => setInstallmentCategory(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
            >
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div
            className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
              installmentAnalysis.isSafeOverall
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                : 'bg-amber-50/80 border-amber-200 text-amber-950'
            }`}
          >
            <div className="flex items-center justify-between font-bold">
              <span>החזר חודשי לעסקה:</span>
              <span className="font-mono-num text-sm">
                {formatILS(installmentAnalysis.monthlyPayment)} / חודש
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>יתרה חזויה בסוף החודש לאחר העסקה:</span>
              <span className="font-mono-num font-semibold">
                {formatILS(installmentAnalysis.newProjectedBalance)}
              </span>
            </div>
            <div className="pt-1 font-medium flex items-center gap-1.5">
              {installmentAnalysis.isSafeOverall ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>העסקה בטוחה לתזרים ועומדת ביעדי הקטגוריה.</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    {installmentAnalysis.exceedsCatGoal
                      ? 'שימו לב: העסקה תגרום לחריגה ביעד הקטגוריה החודשי.'
                      : 'אזהרה: העסקה עלולה להעביר את סוף החודש לגירעון.'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Weekday Spending Behavior Profile (3 cols) */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-700" />
            <h3 className="text-base font-bold text-slate-900">דפוס הוצאות לפי ימי השבוע</h3>
          </div>
          <p className="text-xs text-slate-500">
            זיהוי הימים בשבוע שבהם מרוכזות מרבית ההוצאות המשתנות (כגון קניות לקראת שבת):
          </p>

          <div className="space-y-2.5">
            {HE_DAYS.map((dayLabel, idx) => {
              const maxWd = Math.max(1, ...analysis.weekdaySpend);
              const amt = analysis.weekdaySpend[idx];
              const pct = Math.round((amt / maxWd) * 100);
              return (
                <div key={dayLabel} className="text-xs">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium text-slate-700">יום {dayLabel}</span>
                    <span className="font-mono-num text-slate-600">{formatILS(amt)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * SVG CUMULATIVE TRAJECTORY CHART
 * ============================================================================ */

function TrajectorySvgChart({
  series,
  targetCap,
  elapsedDays,
}: {
  series: {
    day: number;
    actualCumulative: number | null;
    projectedCumulative: number | null;
    budgetPace: number;
  }[];
  targetCap: number;
  elapsedDays: number;
}) {
  const width = 680;
  const height = 230;
  const padLeft = 52;
  const padRight = 20;
  const padTop = 18;
  const padBottom = 28;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxY = Math.max(
    1000,
    targetCap * 1.1,
    ...series.map((s) => Math.max(s.actualCumulative || 0, s.projectedCumulative || 0))
  );

  const n = Math.max(1, series.length - 1);
  const toX = (day: number) => padLeft + ((day - 1) / n) * plotW;
  const toY = (val: number) => padTop + plotH - (val / maxY) * plotH;

  const actualPoints = series
    .filter((s) => s.actualCumulative !== null)
    .map((s) => `${toX(s.day).toFixed(1)},${toY(s.actualCumulative!).toFixed(1)}`)
    .join(' ');

  const projectedPoints = series
    .filter((s) => s.projectedCumulative !== null)
    .map((s) => `${toX(s.day).toFixed(1)},${toY(s.projectedCumulative!).toFixed(1)}`)
    .join(' ');

  const targetCapY = toY(targetCap);
  const cutoffX = toX(elapsedDays);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label="גרף תחזית הוצאות מצטברת עד סוף החודש"
    >
      {/* Horizontal Grid Lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const val = maxY * frac;
        const y = toY(val);
        return (
          <g key={frac}>
            <line
              x1={padLeft}
              y1={y}
              x2={width - padRight}
              y2={y}
              stroke="#f1f5f9"
              strokeWidth="1"
            />
            <text
              x={padLeft - 6}
              y={y + 4}
              textAnchor="end"
              fontSize="10"
              fill="#94a3b8"
              className="font-mono-num"
            >
              {Math.round(val / 1000)}k
            </text>
          </g>
        );
      })}

      {/* Linear Budget Pace Diagonal */}
      <line
        x1={toX(1)}
        y1={toY(0)}
        x2={toX(series.length)}
        y2={targetCapY}
        stroke="#cbd5e1"
        strokeWidth="1.5"
        strokeDasharray="3 3"
      />

      {/* Horizontal Total Budget Ceiling Line */}
      <line
        x1={padLeft}
        y1={targetCapY}
        x2={width - padRight}
        y2={targetCapY}
        stroke="#ef4444"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      <text
        x={width - padRight - 4}
        y={targetCapY - 5}
        textAnchor="end"
        fontSize="10"
        fill="#dc2626"
        className="font-mono-num"
      >
        תקרת יעד: {formatILS(targetCap)}
      </text>

      {/* Today / Cutoff Vertical Marker */}
      <line
        x1={cutoffX}
        y1={padTop}
        x2={cutoffX}
        y2={height - padBottom}
        stroke="#e2e8f0"
        strokeWidth="1.5"
      />

      {/* Actual Cumulative Spend Line */}
      {actualPoints && (
        <polyline
          fill="none"
          stroke="#1d4ed8"
          strokeWidth="2.5"
          points={actualPoints}
        />
      )}

      {/* Projected Spend Line */}
      {projectedPoints && (
        <polyline
          fill="none"
          stroke="#d97706"
          strokeWidth="2.5"
          strokeDasharray="6 4"
          points={projectedPoints}
        />
      )}

      {/* X-Axis Day Ticks */}
      {series
        .filter((s) => s.day === 1 || s.day % 5 === 0 || s.day === series.length)
        .map((s) => (
          <text
            key={s.day}
            x={toX(s.day)}
            y={height - 8}
            textAnchor="middle"
            fontSize="10"
            fill="#64748b"
            className="font-mono-num"
          >
            יום {s.day}
          </text>
        ))}
    </svg>
  );
}
