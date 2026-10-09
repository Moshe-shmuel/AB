import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Layers,
  Plus,
  Sliders,
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
type SubSection = 'trajectory' | 'categories' | 'simulators';

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

  const defaultCutoffDay = isCurrentRealMonth
    ? Math.max(1, now.getDate())
    : daysInMonth;
  const [simulatedDay, setSimulatedDay] = useState<number>(defaultCutoffDay);
  const [forecastModel, setForecastModel] = useState<ForecastModel>('smart_hybrid');
  const [includeExpectedRecurring, setIncludeExpectedRecurring] = useState<boolean>(true);
  const [activeSubSection, setActiveSubSection] = useState<SubSection>('trajectory');

  // What-If Simulator State
  const [cutVariablePct, setCutVariablePct] = useState<number>(10);
  const [extraIncomeMonthly, setExtraIncomeMonthly] = useState<number>(0);
  const [annualYieldPct, setAnnualYieldPct] = useState<number>(4.5);

  // Installment Planner State
  const [purchaseTotal, setPurchaseTotal] = useState<string>('3600');
  const [installmentsCount, setInstallmentsCount] = useState<string>('6');
  const [installmentCategory, setInstallmentCategory] = useState<string>('shopping');

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

  const analysis = useMemo(() => {
    const currentMonthTx = transactions.filter((t) => {
      if (t.date.slice(0, 7) !== currentMonthPrefix) return false;
      const dayNum = parseInt(t.date.slice(8, 10), 10);
      return dayNum <= elapsedDays;
    });

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

    const weekdaySpend = [0, 0, 0, 0, 0, 0, 0];
    for (const t of transactions) {
      if (t.type === 'expense' && !t.isRecurring) {
        const d = new Date(t.date + 'T00:00:00');
        weekdaySpend[d.getDay()] += t.amount;
      }
    }
    const totalVariableAllTime = weekdaySpend.reduce((a, b) => a + b, 0);
    const weekdayWeights = weekdaySpend.map((amt) =>
      totalVariableAllTime > 0 ? (amt / totalVariableAllTime) * 7 : 1
    );

    let remainingWeightedDays = 0;
    for (let d = elapsedDays + 1; d <= daysInMonth; d++) {
      const wd = new Date(viewYear, viewMonth, d).getDay();
      const weight = 0.5 + 0.5 * weekdayWeights[wd];
      remainingWeightedDays += weight;
    }

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

    let histVariableTotal = 0;
    let histTotalExpense = 0;
    for (const t of historicalTx) {
      if (t.type === 'expense') {
        histTotalExpense += t.amount;
        if (!t.isRecurring) histVariableTotal += t.amount;
      }
    }
    const avgHistVariableMonthly = histVariableTotal / activeHistoricalMonthsCount;
    const avgHistDailyVariable = avgHistVariableMonthly / 30;
    const avgHistTotalMonthlyExpense = histTotalExpense / activeHistoricalMonthsCount;

    const currentDailyVariableRate = variableExpenseSoFar / elapsedDays;

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
      {/* Clean Header & Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex bg-slate-200/70 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveSubSection('trajectory')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeSubSection === 'trajectory'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            מסלול ותחזית סוף חודש
          </button>
          <button
            type="button"
            onClick={() => setActiveSubSection('categories')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeSubSection === 'categories'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            תחזית לפי קטגוריות
          </button>
          <button
            type="button"
            onClick={() => setActiveSubSection('simulators')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeSubSection === 'simulators'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            סימולטורים ובדיקת תשלומים
          </button>
        </div>

        {/* Model Selector */}
        <div className="inline-flex items-center bg-slate-200/70 p-1 rounded-xl text-xs">
          <button
            type="button"
            onClick={() => setForecastModel('smart_hybrid')}
            className={`px-3 py-1.5 font-semibold rounded-lg transition-all whitespace-nowrap ${
              forecastModel === 'smart_hybrid'
                ? 'bg-white text-blue-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            מודל משוקלל
          </button>
          <button
            type="button"
            onClick={() => setForecastModel('linear_run_rate')}
            className={`px-3 py-1.5 font-semibold rounded-lg transition-all whitespace-nowrap ${
              forecastModel === 'linear_run_rate'
                ? 'bg-white text-blue-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            קצב יומי (Run-Rate)
          </button>
          <button
            type="button"
            onClick={() => setForecastModel('historical_baseline')}
            className={`px-3 py-1.5 font-semibold rounded-lg transition-all whitespace-nowrap ${
              forecastModel === 'historical_baseline'
                ? 'bg-white text-blue-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ממוצע היסטורי
          </button>
        </div>
      </div>

      {/* 4-Column End-of-Month Projection KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-500">
            צפי הוצאות לסוף החודש
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1.5 font-mono-num tabular-nums">
            {formatILS(analysis.projectedEndMonthExpense)}
          </div>
          <div className="text-xs text-slate-400 mt-1.5">
            עד כה: {formatILS(analysis.totalExpenseSoFar)}
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-500">
            יתרה חזויה בסוף החודש
          </div>
          <div
            className={`text-2xl font-bold mt-1.5 font-mono-num tabular-nums ${
              analysis.projectedEndMonthBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {formatILS(analysis.projectedEndMonthBalance)}
          </div>
          <div className="text-xs text-slate-400 mt-1.5">
            צפי הכנסות: {formatILS(analysis.projectedEndMonthIncome)}
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-500">
            מול תקרת יעד התקציב
          </div>
          <div
            className={`text-2xl font-bold mt-1.5 font-mono-num tabular-nums ${
              budgetDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {budgetDiff >= 0
              ? `+${formatILS(budgetDiff)}`
              : `−${formatILS(Math.abs(budgetDiff))}`}
          </div>
          <div className="text-xs text-slate-400 mt-1.5">
            יעד: {formatILS(analysis.effectiveTargetCap)}
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-500">
            תקציב יומי בטוח ({remainingDays} ימים נותרו)
          </div>
          <div className="text-2xl font-bold text-blue-600 mt-1.5 font-mono-num tabular-nums">
            {remainingDays > 0 ? `${formatILS(analysis.safeDailyAllowance)}` : 'הסתיים'}
          </div>
          <div className="text-xs text-slate-400 mt-1.5">
            קצב משתנות כעת: {formatILS(analysis.currentDailyVariableRate)}/יום
          </div>
        </div>
      </div>

      {/* SUB-SECTION 1: TRAJECTORY & UPCOMING BILLS */}
      {activeSubSection === 'trajectory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Trajectory SVG Chart (8 cols) */}
            <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    מסלול הוצאות מצטבר ותחזית עד סוף החודש
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    השוואה בין ההוצאה בפועל עד יום {elapsedDays}, המשך המסלול החזוי, וקו תקציב המטרה
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-blue-600 font-semibold">━ בפועל</span>
                  <span className="text-amber-600 font-semibold">┅ צפי</span>
                  <span className="text-slate-400 font-semibold">─ תקרת יעד</span>
                </div>
              </div>

              <TrajectorySvgChart
                series={analysis.dailySeries}
                targetCap={analysis.effectiveTargetCap}
                elapsedDays={elapsedDays}
              />

              {/* Clean Cutoff Day Slider Footer */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
                <div className="flex items-center gap-3">
                  <span>בדיקת תחזית ליום בחודש:</span>
                  <input
                    type="range"
                    min={1}
                    max={daysInMonth}
                    value={simulatedDay}
                    onChange={(e) => setSimulatedDay(parseInt(e.target.value, 10))}
                    className="w-36 accent-blue-600 cursor-pointer"
                  />
                  <span className="font-mono-num font-bold text-slate-900">
                    יום {elapsedDays} מתוך {daysInMonth}
                  </span>
                </div>

                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeExpectedRecurring}
                    onChange={(e) => setIncludeExpectedRecurring(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>שקלל הוראות קבע צפויות ({formatILS(analysis.expectedRecurringExpenses)})</span>
                </label>
              </div>
            </div>

            {/* Upcoming Expected Recurring Bills Radar (4 cols) */}
            <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-blue-600" />
                  <span>חיובים קבועים שטרם נרשמו</span>
                </h3>
                <span className="text-xs font-mono-num text-slate-400">
                  {analysis.upcomingRecurring.length} זוהו
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                תנועות קבועות מהחודש הקודם שטרם נרשמו בחודש {HE_MONTHS[viewMonth]}:
              </p>

              {analysis.upcomingRecurring.length === 0 ? (
                <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>כל החיובים הקבועים מהחודש הקודם כבר עודכנו!</span>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[240px] overflow-y-auto">
                  {analysis.upcomingRecurring.map((item, idx) => (
                    <div
                      key={`${item.template.id}-${idx}`}
                      className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">
                          {item.template.note || item.template.categoryLabel}
                        </div>
                        <div className="text-slate-400 font-mono-num mt-0.5">
                          צפוי: {item.expectedDate}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`font-bold font-mono-num ${
                            item.template.type === 'income'
                              ? 'text-emerald-600'
                              : 'text-rose-600'
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
                          className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 flex items-center gap-1"
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
        </div>
      )}

      {/* SUB-SECTION 2: CATEGORY FORECAST TABLE & WEEKDAY PROFILE */}
      {activeSubSection === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                תחזית סוף חודש לפי קטגוריות הוצאה
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-400 bg-slate-50/50">
                    <th className="py-3 px-5 text-right font-medium">קטגוריה</th>
                    <th className="py-3 px-4 text-left font-medium">עד כה</th>
                    <th className="py-3 px-4 text-left font-medium">ממוצע היסטורי</th>
                    <th className="py-3 px-4 text-left font-medium">צפי סוף חודש</th>
                    <th className="py-3 px-4 text-left font-medium">יעד</th>
                    <th className="py-3 px-5 text-left font-medium">הפרש חזוי</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analysis.categoryForecasts.map((row) => {
                    const isOverGoal = row.goal > 0 && row.projectedTotal > row.goal;
                    return (
                      <tr key={row.category.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-5 font-semibold text-slate-900">
                          {row.category.label}
                        </td>
                        <td className="py-3.5 px-4 text-left font-mono-num tabular-nums text-slate-600">
                          {formatILS(row.spentSoFar)}
                        </td>
                        <td className="py-3.5 px-4 text-left font-mono-num tabular-nums text-slate-400">
                          {formatILS(row.histAvg)}
                        </td>
                        <td className="py-3.5 px-4 text-left font-bold font-mono-num tabular-nums text-slate-900">
                          {formatILS(row.projectedTotal)}
                        </td>
                        <td className="py-3.5 px-4 text-left font-mono-num tabular-nums text-slate-500">
                          {row.goal > 0 ? formatILS(row.goal) : '—'}
                        </td>
                        <td className="py-3.5 px-5 text-left font-bold font-mono-num tabular-nums">
                          {row.goal > 0 ? (
                            <span className={isOverGoal ? 'text-rose-600' : 'text-emerald-600'}>
                              {isOverGoal
                                ? `−${formatILS(Math.abs(row.variance))}`
                                : `+${formatILS(row.variance)}`}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">פרופיל הוצאות לפי ימי השבוע</h3>
            </div>
            <p className="text-xs text-slate-500">
              הימים בשבוע שבהם מרוכזות מרבית ההוצאות המשתנות:
            </p>

            <div className="space-y-3">
              {HE_DAYS.map((dayLabel, idx) => {
                const maxWd = Math.max(1, ...analysis.weekdaySpend);
                const amt = analysis.weekdaySpend[idx];
                const pct = Math.round((amt / maxWd) * 100);
                return (
                  <div key={dayLabel} className="text-xs">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium text-slate-700">יום {dayLabel}</span>
                      <span className="font-mono-num text-slate-500">{formatILS(amt)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
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
      )}

      {/* SUB-SECTION 3: SIMULATORS (WHAT-IF & INSTALLMENTS) */}
      {activeSubSection === 'simulators' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Interactive What-If & Compound Wealth Simulator */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">
                סימולטור "מה אם" וצמיחה רב-שנתית
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              בדקו כיצד הפחתה בהוצאות המשתנות או תוספת הכנסה ישפיעו על החיסכון המצטבר:
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <div className="flex justify-between mb-1.5 font-medium text-slate-700">
                  <span>הפחתת הוצאות משתנות:</span>
                  <span className="font-mono-num font-bold text-blue-600">
                    {cutVariablePct}% (+{formatILS(whatIfResults.monthlySavedFromCut)} לחודש)
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={5}
                  value={cutVariablePct}
                  onChange={(e) => setCutVariablePct(parseInt(e.target.value, 10))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1.5 font-medium text-slate-700">
                  <span>תוספת הכנסה חודשית נטו:</span>
                  <span className="font-mono-num font-bold text-emerald-600">
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
                <div className="flex justify-between mb-1.5 font-medium text-slate-700">
                  <span>תשואה שנתית משוערת על החיסכון:</span>
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

            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-center">
              <div className="p-3 bg-slate-50 rounded-xl">
                <div className="text-[11px] text-slate-500">חיסכון בעוד שנה</div>
                <div className="text-sm font-bold text-slate-900 font-mono-num mt-1">
                  {formatILS(whatIfResults.fv1Year)}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <div className="text-[11px] text-slate-500">בעוד 3 שנים</div>
                <div className="text-sm font-bold text-blue-600 font-mono-num mt-1">
                  {formatILS(whatIfResults.fv3Years)}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <div className="text-[11px] text-slate-500">בעוד 5 שנים</div>
                <div className="text-sm font-bold text-emerald-600 font-mono-num mt-1">
                  {formatILS(whatIfResults.fv5Years)}
                </div>
              </div>
            </div>
          </div>

          {/* Installment Purchase Impact Checker */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">
                בדיקת כדאיות עסקה בתשלומים
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              בדקו מראש אם תחזית סוף החודש שלכם מסוגלת לספוג רכישה חדשה בפריסת תשלומים:
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
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl font-mono-num focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">מספר תשלומים</label>
                <select
                  value={installmentsCount}
                  onChange={(e) => setInstallmentsCount(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white font-mono-num focus:outline-none focus:border-blue-600"
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
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-blue-600"
              >
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div
              className={`p-4 rounded-xl border text-xs space-y-2 ${
                installmentAnalysis.isSafeOverall
                  ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50/70 border-amber-200 text-amber-950'
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
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>העסקה בטוחה לתזרים ועומדת ביעדי הקטגוריה.</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
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
        </div>
      )}
    </div>
  );
};

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
  const height = 220;
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

      <line
        x1={toX(1)}
        y1={toY(0)}
        x2={toX(series.length)}
        y2={targetCapY}
        stroke="#cbd5e1"
        strokeWidth="1.5"
        strokeDasharray="3 3"
      />

      <line
        x1={padLeft}
        y1={targetCapY}
        x2={width - padRight}
        y2={targetCapY}
        stroke="#f43f5e"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      <text
        x={width - padRight - 4}
        y={targetCapY - 5}
        textAnchor="end"
        fontSize="10"
        fill="#e11d48"
        className="font-mono-num"
      >
        יעד: {formatILS(targetCap)}
      </text>

      <line
        x1={cutoffX}
        y1={padTop}
        x2={cutoffX}
        y2={height - padBottom}
        stroke="#e2e8f0"
        strokeWidth="1.5"
      />

      {actualPoints && (
        <polyline
          fill="none"
          stroke="#2563eb"
          strokeWidth="2.5"
          points={actualPoints}
        />
      )}

      {projectedPoints && (
        <polyline
          fill="none"
          stroke="#d97706"
          strokeWidth="2.5"
          strokeDasharray="6 4"
          points={projectedPoints}
        />
      )}

      {series
        .filter((s) => s.day === 1 || s.day % 5 === 0 || s.day === series.length)
        .map((s) => (
          <text
            key={s.day}
            x={toX(s.day)}
            y={height - 8}
            textAnchor="middle"
            fontSize="10"
            fill="#94a3b8"
            className="font-mono-num"
          >
            יום {s.day}
          </text>
        ))}
    </svg>
  );
}
