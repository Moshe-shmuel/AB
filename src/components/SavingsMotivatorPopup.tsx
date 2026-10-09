import React from 'react';
import { Award, PiggyBank, TrendingUp, X, ArrowLeft } from 'lucide-react';
import { SavingsFund } from '../types';
import { formatILS } from '../utils/portableExporter';

export interface MotivationalPopupData {
  id: string;
  headline: string;
  message: string;
  actualSavedThisMonth: number;
  projectedEndMonthSavings: number;
  savedVsPaceToDate: number; // Positive means user spent LESS than expected pace up to today
  savingsGoalTarget: number;
}

interface SavingsMotivatorPopupProps {
  popup: MotivationalPopupData | null;
  onDismiss: () => void;
  primaryFund?: SavingsFund;
  onQuickDepositToFund: (fundId: string, amount: number) => void;
  onNavigateToForecast: () => void;
}

export const SavingsMotivatorPopup: React.FC<SavingsMotivatorPopupProps> = ({
  popup,
  onDismiss,
  primaryFund,
  onQuickDepositToFund,
  onNavigateToForecast,
}) => {
  if (!popup) return null;

  const progressPct =
    popup.projectedEndMonthSavings > 0
      ? Math.min(
          100,
          Math.max(
            10,
            Math.round(
              (popup.actualSavedThisMonth / Math.max(1, popup.projectedEndMonthSavings)) * 100
            )
          )
        )
      : 0;

  return (
    <div
      className="fixed bottom-5 left-5 z-50 max-w-md w-[calc(100vw-2.5rem)] bg-white border border-slate-200 rounded-xl shadow-xl p-5 space-y-4 transition-all"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">{popup.headline}</h4>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{popup.message}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 text-slate-400 hover:text-slate-700 rounded-lg shrink-0"
          aria-label="סגור הודעת עידוד"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Actual Savings vs. Monthly Expected Savings Breakdown */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3.5 space-y-2.5">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[11px] text-slate-500">חיסכון נטו עד כה</div>
            <div
              className={`text-sm font-bold font-mono-num tabular-nums ${
                popup.actualSavedThisMonth >= 0 ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {formatILS(popup.actualSavedThisMonth)}
            </div>
          </div>

          <div className="border-x border-slate-200 px-1">
            <div className="text-[11px] text-slate-500">צפי חיסכון בסוף החודש</div>
            <div
              className={`text-sm font-bold font-mono-num tabular-nums ${
                popup.projectedEndMonthSavings >= 0 ? 'text-blue-700' : 'text-red-700'
              }`}
            >
              {formatILS(popup.projectedEndMonthSavings)}
            </div>
          </div>

          <div>
            <div className="text-[11px] text-slate-500">חיסכון מול קצב צפוי</div>
            <div
              className={`text-sm font-bold font-mono-num tabular-nums ${
                popup.savedVsPaceToDate >= 0 ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {popup.savedVsPaceToDate >= 0
                ? `+${formatILS(popup.savedVsPaceToDate)}`
                : `−${formatILS(Math.abs(popup.savedVsPaceToDate))}`}
            </div>
          </div>
        </div>

        {/* Visual Bar comparing actual saved vs projected monthly savings */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
            <span>קצב עמידה ביעד החיסכון החודשי</span>
            <span className="font-mono-num font-semibold text-slate-700">{progressPct}%</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Action Buttons Inside Popup */}
      <div className="flex items-center justify-between gap-2 pt-1">
        {primaryFund && popup.actualSavedThisMonth > 250 && (
          <button
            type="button"
            onClick={() => {
              onQuickDepositToFund(primaryFund.id, 250);
              onDismiss();
            }}
            className="flex-1 py-2 px-3 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <PiggyBank className="w-3.5 h-3.5" />
            <span>הפקד +250 ₪ ל{primaryFund.name.slice(0, 18)}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            onNavigateToForecast();
            onDismiss();
          }}
          className="py-2 px-3 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1"
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>לניתוח הצפי המלא</span>
          <ArrowLeft className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
