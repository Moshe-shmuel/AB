import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Download,
  FileCode2,
  FileSpreadsheet,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react';
import { AppBackupPayload } from '../types';
import {
  exportBackupJSON,
  exportMaaserCSV,
  exportStandaloneSingleFileHTML,
  exportTransactionsCSV,
} from '../utils/portableExporter';

interface DesktopExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  backupPayload: AppBackupPayload;
  onImportBackup: (data: AppBackupPayload) => void;
  onResetEmpty: () => void;
  onLoadDemo: () => void;
}

export const DesktopExportModal: React.FC<DesktopExportModalProps> = ({
  isOpen,
  onClose,
  backupPayload,
  onImportBackup,
  onResetEmpty,
  onLoadDemo,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || '{}'));
        if (Array.isArray(parsed.transactions)) {
          onImportBackup(parsed);
          setImportStatus('הגיבוי שוחזר בהצלחה אל המערכת!');
          setTimeout(() => setImportStatus(null), 4000);
        } else {
          setImportStatus('שגיאה: קובץ ה-JSON אינו בפורמט גיבוי תקין.');
        }
      } catch {
        setImportStatus('שגיאה בפענוח קובץ הגיבוי.');
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadSingleFile = async () => {
    const ok = await exportStandaloneSingleFileHTML(backupPayload);
    if (!ok) {
      setImportStatus(
        'בסביבת פיתוח חיה מומלץ להוריד קובץ גיבוי (.JSON) או להשתמש בקובץ ה-SingleFile שנוצר ב-GitHub Actions.'
      );
      setTimeout(() => setImportStatus(null), 5000);
    } else {
      setImportStatus('קובץ האפליקציה העצמאי (.HTML) הורד בהצלחה עם כל הנתונים שלך!');
      setTimeout(() => setImportStatus(null), 4000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-modal-title"
    >
      <div className="bg-white border border-slate-100 rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 lg:p-7 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 id="backup-modal-title" className="text-base font-bold text-slate-900">
                גיבוי, ייצוא וניהול נתונים
              </h2>
              <p className="text-xs text-slate-400">
                שמירה ושחזור של כלל התנועות, המעשרות, היעדים והקרנות
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl"
            aria-label="סגור חלון"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1: JSON Backup & Excel CSV Export */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-slate-500">
            גיבוי מסד הנתונים (JSON) וייצוא לאקסל (CSV)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => exportBackupJSON(backupPayload)}
              className="p-3.5 text-right bg-slate-50/70 hover:bg-slate-100/80 border border-slate-200/80 rounded-2xl flex items-center justify-between transition-colors"
            >
              <div>
                <div className="text-xs font-bold text-slate-900">שמירת קובץ גיבוי מלא (.JSON)</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  שומר תנועות, קבועות, מעשרות וקרנות
                </div>
              </div>
              <Download className="w-4 h-4 text-blue-600 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-3.5 text-right bg-slate-50/70 hover:bg-slate-100/80 border border-slate-200/80 rounded-2xl flex items-center justify-between transition-colors"
            >
              <div>
                <div className="text-xs font-bold text-slate-900">שחזור מקובץ גיבוי (.JSON)</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  טעינת נתונים מקובץ שמור במחשב
                </div>
              </div>
              <Upload className="w-4 h-4 text-blue-600 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => exportTransactionsCSV(backupPayload.transactions)}
              className="p-3.5 text-right bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between transition-colors"
            >
              <div>
                <div className="text-xs font-bold text-slate-900">ייצוא תנועות לאקסל (CSV)</div>
                <div className="text-[11px] text-slate-500 mt-0.5">קידוד עברית מלא ל-Excel</div>
              </div>
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => exportMaaserCSV(backupPayload.maaserDonations)}
              className="p-3.5 text-right bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between transition-colors"
            >
              <div>
                <div className="text-xs font-bold text-slate-900">ייצוא פנקס מעשרות (CSV)</div>
                <div className="text-[11px] text-slate-500 mt-0.5">כולל קבלות וסעיף 46</div>
              </div>
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {importStatus && (
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{importStatus}</span>
            </div>
          )}
        </div>

        {/* Section 2: Standalone Electron Desktop Suite & Single-File HTML */}
        <div className="bg-slate-50/80 border border-slate-200/70 rounded-2xl p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1 min-w-[240px]">
              <div className="text-xs font-bold text-slate-900">
                חבילת תוכנה שולחנית מואצת ל-Windows (<code className="font-mono-num">Setup / ZIP / Portable .EXE</code>)
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                בכל Push או Release ב-GitHub Actions (או בהרצת{' '}
                <code className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono-num">
                  npm run dist:exe
                </code>
                ), נוצרות אוטומטית בתיקיית <code className="font-mono-num">release/</code> כל הגרסאות לנוחות ומהירות מרבית:
                {' '}
                <code className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono-num text-blue-700 font-semibold">
                  Budget-Maaser-Pro-Setup.exe
                </code>{' '}
                (מתקין בקליק אחד שנפתח תוך פחות משנייה),{' '}
                <code className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono-num text-blue-700 font-semibold">
                  Budget-Maaser-Pro-Win64.zip
                </code>{' '}
                (חילוץ חד-פעמי ללא התקנה וללא המתנה), ו-
                <code className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono-num text-blue-700 font-semibold">
                  Budget-Maaser-Pro-Portable.exe
                </code>{' '}
                (קובץ בודד מואץ ללא דחיסה כבדה, עם חלון Splash מיידי ומזעור ל-System Tray לפתיחה חוזרת ב-0.1 שניות).
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadSingleFile}
              className="px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
            >
              <FileCode2 className="w-4 h-4" />
              <span>הורד קובץ HTML יחיד</span>
            </button>
          </div>
        </div>

        {/* Section 3: Data Management (Demo / Clear) */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onLoadDemo();
                onClose();
              }}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              טען נתוני הדגמה
            </button>

            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="px-3.5 py-2 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>איפוס נתונים</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onResetEmpty();
                    setConfirmReset(false);
                    onClose();
                  }}
                  className="px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl"
                >
                  אישור מחיקה מלאה
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="px-2.5 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  ביטול
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
};
