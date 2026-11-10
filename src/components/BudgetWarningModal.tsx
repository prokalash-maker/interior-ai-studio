import React, { useState } from 'react';
import { AlertTriangle, DollarSign, X, Check, Zap, Sparkles } from 'lucide-react';
import { useI18n } from '../i18n/i18nContext';
import { Resolution } from '../types/cost';

interface BudgetWarningModalProps {
  isOpen: boolean;
  type: 'expensive_request' | 'budget_exceeded';
  resolution: Resolution;
  estimatedCost: number;
  sessionSpend: number;
  budgetLimit: number;
  onProceed: () => void;
  onCancel: () => void;
  onSwitchToDraft: () => void;
  onDisableWarning: () => void;
}

export const BudgetWarningModal: React.FC<BudgetWarningModalProps> = ({
  isOpen,
  type,
  resolution,
  estimatedCost,
  sessionSpend,
  budgetLimit,
  onProceed,
  onCancel,
  onSwitchToDraft,
  onDisableWarning,
}) => {
  const { t, language } = useI18n();
  const [dontAskAgain, setDontAskAgain] = useState(false);

  if (!isOpen) return null;

  const isExceeded = type === 'budget_exceeded';

  const handleProceedClick = () => {
    if (dontAskAgain) {
      onDisableWarning();
    }
    onProceed();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="max-w-md w-full bg-studio-surface border border-studio-border rounded-2xl p-6 shadow-2xl space-y-5 relative">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-studio-textMuted hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon */}
        <div className="flex items-start space-x-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isExceeded
                ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                : 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-400'
            }`}
          >
            {isExceeded ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <DollarSign className="w-5 h-5" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-sm text-white">
              {isExceeded
                ? t('budget.exceededTitle') || 'Лимит бюджета на сессию превышен'
                : t('budget.expensiveWarningTitle') || 'Предупреждение перед 4K генерацией'}
            </h3>
            <p className="text-xs text-studio-textMuted mt-0.5">
              {isExceeded
                ? t('budget.exceededDesc') || 'Текущая стоимость превышает установленный лимит сессии.'
                : t('budget.expensiveWarningDesc') || 'Вы запускаете генерацию высокого разрешения (4K Ultra ArchViz).'}
            </p>
          </div>
        </div>

        {/* Cost Metrics Card */}
        <div className="bg-studio-bg rounded-xl p-3.5 border border-studio-border space-y-2 text-xs">
          <div className="flex justify-between items-center text-studio-textMuted">
            <span>{t('budget.estimatedCostLabel') || 'Стоимость этой генерации:'}</span>
            <span className="font-mono text-sm font-bold text-white">
              ${estimatedCost.toFixed(3)} USD
            </span>
          </div>

          <div className="flex justify-between items-center text-studio-textMuted">
            <span>{t('budget.resolutionLabel') || 'Выбранное разрешение:'}</span>
            <span className="font-mono font-semibold text-indigo-400 uppercase">
              {resolution} {resolution === '4k' ? '(3840×2160)' : resolution === '2k' ? '(2048×1152)' : '(1024×1024)'}
            </span>
          </div>

          <div className="flex justify-between items-center text-studio-textMuted pt-2 border-t border-studio-border/60">
            <span>{t('budget.sessionSpendLabel') || 'Расходы за сессию:'}</span>
            <span className="font-mono text-white">
              ${sessionSpend.toFixed(2)} / {budgetLimit > 0 ? `$${budgetLimit.toFixed(2)}` : '∞'}
            </span>
          </div>
        </div>

        {/* Don't ask again checkbox */}
        <label className="flex items-center space-x-2 text-xs text-studio-textMuted cursor-pointer hover:text-studio-text">
          <input
            type="checkbox"
            checked={dontAskAgain}
            onChange={(e) => setDontAskAgain(e.target.checked)}
            className="rounded border-studio-border bg-studio-bg text-indigo-600 focus:ring-0"
          />
          <span>{t('budget.dontAskAgain') || 'Не предупреждать до конца этой сессии'}</span>
        </label>

        {/* Buttons */}
        <div className="flex items-center justify-end space-x-2 pt-2">
          {resolution === '4k' && (
            <button
              onClick={onSwitchToDraft}
              className="px-3 py-2 bg-studio-surfaceHover hover:bg-studio-border text-studio-text rounded-lg text-xs font-medium transition-colors flex items-center space-x-1"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('budget.switchTo1k') || 'Переключить на 1K ($0.03)'}</span>
            </button>
          )}

          <button
            onClick={onCancel}
            className="px-3 py-2 rounded-lg text-xs text-studio-textMuted hover:text-white transition-colors"
          >
            {t('action.cancel')}
          </button>

          <button
            onClick={handleProceedClick}
            className={`px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-md transition-colors flex items-center space-x-1.5 ${
              isExceeded
                ? 'bg-amber-600 hover:bg-amber-500'
                : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {t('budget.proceedAnyway') || 'Продолжить'} (${estimatedCost.toFixed(3)})
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
