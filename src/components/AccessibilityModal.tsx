import React from 'react';
import {
  Accessibility,
  Contrast,
  Eye,
  Keyboard,
  Sparkles,
  Type,
  Volume2,
  X,
} from 'lucide-react';

export type FontScale = 'normal' | 'large' | 'xlarge';

export interface AccessibilityPreferences {
  fontScale: FontScale;
  highContrast: boolean;
  simplifiedMode: boolean;
}

interface AccessibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefs: AccessibilityPreferences;
  onUpdatePrefs: (next: AccessibilityPreferences) => void;
  onSpeakMonthlySummary: () => void;
}

export const AccessibilityModal: React.FC<AccessibilityModalProps> = ({
  isOpen,
  onClose,
  prefs,
  onUpdatePrefs,
  onSpeakMonthlySummary,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="a11y-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Accessibility className="w-5 h-5" />
            </div>
            <div>
              <h2 id="a11y-modal-title" className="text-base font-bold text-slate-900">
                הנגשה, נוחות תצוגה וקיצורי מקלדת
              </h2>
              <p className="text-xs text-slate-500">
                התאימו את גודל הטקסט, רמת הפשטות והניווט המהיר לנוחות מרבית
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="סגור חלון נגישות"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. Font Scale */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Type className="w-4 h-4 text-blue-600" />
            <span>גודל גופן ומספרים</span>
          </label>
          <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl">
            {(
              [
                { id: 'normal', label: 'רגיל (100%)' },
                { id: 'large', label: 'גדול (112%)' },
                { id: 'xlarge', label: 'ענק (125%)' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onUpdatePrefs({ ...prefs, fontScale: opt.id })}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  prefs.fontScale === opt.id
                    ? 'bg-white text-blue-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Simplified Mode & High Contrast Toggles */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() =>
              onUpdatePrefs({ ...prefs, simplifiedMode: !prefs.simplifiedMode })
            }
            className={`w-full p-3.5 rounded-xl border text-right flex items-center justify-between gap-4 transition-colors ${
              prefs.simplifiedMode
                ? 'bg-blue-50/70 border-blue-300'
                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/60'
            }`}
          >
            <div className="flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-900">
                  מצב תצוגה פשוטה וממוקדת
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  מציג רק את המסכים הבסיסיים (תנועות, הוראות קבע ומעשרות) ומסתיר גרפים וניתוחים מתקדמים
                </div>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 ${
                prefs.simplifiedMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {prefs.simplifiedMode ? 'פעיל' : 'כבוי'}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdatePrefs({ ...prefs, highContrast: !prefs.highContrast })
            }
            className={`w-full p-3.5 rounded-xl border text-right flex items-center justify-between gap-4 transition-colors ${
              prefs.highContrast
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/60'
            }`}
          >
            <div className="flex items-start gap-3">
              <Contrast
                className={`w-4 h-4 mt-0.5 shrink-0 ${
                  prefs.highContrast ? 'text-amber-400' : 'text-slate-700'
                }`}
              />
              <div>
                <div
                  className={`text-xs font-bold ${
                    prefs.highContrast ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  ניגודיות גבוהה והדגשת גבולות
                </div>
                <div
                  className={`text-[11px] mt-0.5 ${
                    prefs.highContrast ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  מחזק את ניגודיות הטקסט ומדגיש קווי מתאר לקריאה נוחה לבעלי רגישות חזותית
                </div>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 ${
                prefs.highContrast
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {prefs.highContrast ? 'פעיל' : 'כבוי'}
            </span>
          </button>
        </div>

        {/* 3. Voice Summary Readout */}
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
          <div className="flex items-center gap-2.5">
            <Volume2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-900">הקראה קולית של סיכום החודש</div>
              <div className="text-[11px] text-slate-500">
                הקראת יתרת התקציב, ההוצאות וקופת המעשרות באמצעות מנוע הדיבור של הדפדפן
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onSpeakMonthlySummary}
            className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
          >
            הקרא עכשיו
          </button>
        </div>

        {/* 4. Keyboard Shortcuts Reference */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Keyboard className="w-4 h-4 text-blue-600" />
            <span>קיצורי מקלדת לניווט והזנה מהירה</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-slate-50 rounded-lg flex items-center justify-between">
              <span className="text-slate-600">תנועה חדשה</span>
              <kbd className="px-2 py-0.5 bg-white border border-slate-200 rounded font-mono-num text-[11px] font-bold">
                N / +
              </kbd>
            </div>
            <div className="p-2 bg-slate-50 rounded-lg flex items-center justify-between">
              <span className="text-slate-600">חיפוש ביומן</span>
              <kbd className="px-2 py-0.5 bg-white border border-slate-200 rounded font-mono-num text-[11px] font-bold">
                /
              </kbd>
            </div>
            <div className="p-2 bg-slate-50 rounded-lg flex items-center justify-between">
              <span className="text-slate-600">מעבר בין מסכים ראשיים</span>
              <kbd className="px-2 py-0.5 bg-white border border-slate-200 rounded font-mono-num text-[11px] font-bold">
                1 – 4
              </kbd>
            </div>
            <div className="p-2 bg-slate-50 rounded-lg flex items-center justify-between">
              <span className="text-slate-600">סגירת חלונות קופצים</span>
              <kbd className="px-2 py-0.5 bg-white border border-slate-200 rounded font-mono-num text-[11px] font-bold">
                Esc
              </kbd>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() =>
              onUpdatePrefs({
                fontScale: 'normal',
                highContrast: false,
                simplifiedMode: false,
              })
            }
            className="text-xs font-medium text-slate-500 hover:text-slate-800 underline"
          >
            איפוס להגדרות תצוגה רגילות
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
          >
            סיום ושמירה
          </button>
        </div>
      </div>
    </div>
  );
};
