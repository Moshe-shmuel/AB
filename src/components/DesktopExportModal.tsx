import React, { useRef, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  HardDriveDownload,
  Monitor,
  RotateCcw,
  Upload,
  X,
  CheckCircle2,
} from 'lucide-react';
import { AppBackupPayload } from '../types';
import {
  exportBackupJSON,
  exportDesktopExecutableApp,
  exportMaaserCSV,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <Monitor className="w-5 h-5 text-blue-700" />
            <h2 className="text-lg font-bold text-slate-900">
              הורדת תוכנה שולחנית ל-Windows וניהול גיבויים
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            aria-label="סגור חלון"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1: Windows Desktop App (.HTA / Standalone) */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="text-sm font-bold text-slate-900">
            1. הפעלה כתוכנת שולחן עבודה עצמאית ב-Windows (ללא דפדפן)
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            ניתן להוריד קובץ <strong>Windows Desktop Application (.hta)</strong> או קובץ{' '}
            <strong>Portable Offline (.html)</strong> המכילים את התוכנה ואת כל הנתונים שהזנתם עד כה.
            בלחיצה כפולה ב-Windows, קובץ ה-HTA נפתח בחלון תוכנה שולחני ייעודי ועובד גם ללא חיבור לאינטרנט.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="button"
              onClick={() => exportDesktopExecutableApp(backupPayload, 'hta')}
              className="px-4 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Monitor className="w-4 h-4" />
              <span>הורד תוכנה שולחנית ל-Windows (.HTA)</span>
            </button>
            <button
              type="button"
              onClick={() => exportDesktopExecutableApp(backupPayload, 'html')}
              className="px-4 py-2.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <HardDriveDownload className="w-4 h-4" />
              <span>הורד קובץ Portable עצמאי (.HTML)</span>
            </button>
          </div>
        </div>

        {/* Section 2: Excel CSV & JSON Database Backup */}
        <div className="space-y-3">
          <div className="text-sm font-bold text-slate-900">
            2. ייצוא לאקסל (CSV) וגיבוי/שחזור מסד נתונים (JSON)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => exportTransactionsCSV(backupPayload.transactions)}
              className="p-3 text-right bg-white border border-slate-200 hover:border-slate-300 rounded-lg flex items-center justify-between transition-colors"
            >
              <div>
                <div className="text-xs font-bold text-slate-900">ייצוא תנועות תקציב (CSV)</div>
                <div className="text-[11px] text-slate-500">מותאם לפתיחה בעברית ב-Excel</div>
              </div>
              <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => exportMaaserCSV(backupPayload.maaserDonations)}
              className="p-3 text-right bg-white border border-slate-200 hover:border-slate-300 rounded-lg flex items-center justify-between transition-colors"
            >
              <div>
                <div className="text-xs font-bold text-slate-900">ייצוא פנקס מעשרות (CSV)</div>
                <div className="text-[11px] text-slate-500">כולל פירוט קבלות וסעיף 46</div>
              </div>
              <FileSpreadsheet className="w-4 h-4 text-blue-700 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => exportBackupJSON(backupPayload)}
              className="p-3 text-right bg-white border border-slate-200 hover:border-slate-300 rounded-lg flex items-center justify-between transition-colors"
            >
              <div>
                <div className="text-xs font-bold text-slate-900">שמירת קובץ גיבוי מלא (.JSON)</div>
                <div className="text-[11px] text-slate-500">שומר תנועות, מעשרות, יעדים וקרנות</div>
              </div>
              <Download className="w-4 h-4 text-slate-700 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-3 text-right bg-white border border-slate-200 hover:border-slate-300 rounded-lg flex items-center justify-between transition-colors"
            >
              <div>
                <div className="text-xs font-bold text-slate-900">שחזור מקובץ גיבוי (.JSON)</div>
                <div className="text-[11px] text-slate-500">טעינת נתונים מקובץ שמור במחשב</div>
              </div>
              <Upload className="w-4 h-4 text-slate-700 shrink-0" />
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
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{importStatus}</span>
            </div>
          )}
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
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              טען נתוני הדגמה לדוגמה
            </button>

            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>איפוס כל הנתונים</span>
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
                  className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg"
                >
                  אישור מחיקה מלאה
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  ביטול
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
};
