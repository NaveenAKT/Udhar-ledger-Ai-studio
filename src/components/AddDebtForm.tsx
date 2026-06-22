/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shop, Customer, Transaction } from '../types';
import { useLanguage } from '../lib/translations';
import { AlertCircle, Loader2 } from 'lucide-react';

interface AddDebtFormProps {
  customer: Customer;
  shops: Shop[];
  transactions: Transaction[];
  onSave: (shopId: string, shopName: string, amount: number, notes: string) => Promise<void>;
  onClose: () => void;
}

export default function AddDebtForm({ customer, shops, transactions, onSave, onClose }: AddDebtFormProps) {
  const { t, language } = useLanguage();
  const [selectedShopId, setSelectedShopId] = useState<string>(shops[0]?.id || '');
  const [amountInput, setAmountInput] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [txType, setTxType] = useState<'due' | 'payment'>('due');
  
  // Safety check states
  const [hasAmountError, setHasAmountError] = useState(false);
  const [isConfirmingInline, setIsConfirmingInline] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Find the details of selected shop
  const selectedShop = shops.find(s => s.id === selectedShopId);

  // Sum up outstanding amounts for this customer in selectedShopId
  const currentShopDebt = React.useMemo(() => {
    let total = 0;
    (transactions || []).forEach(tx => {
      if (tx.customerId === customer.id && tx.shopId === selectedShopId && tx.status === 'Unpaid') {
        total += tx.amount;
      }
    });
    return total;
  }, [customer.id, selectedShopId, transactions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setHasAmountError(false);
    setSaveError(null);

    if (!selectedShopId) {
      alert(language === 'te' 
        ? "దయచేసి మొదట ఒక దుకాణాన్ని క్రియేట్ చేయండి లేదా ఎంచుకోండి." 
        : "Please register or select a shop first.");
      return;
    }

    if (txType === 'payment' && currentShopDebt <= 0) {
      return; // Doubly prevent submit
    }

    const parsedAmount = parseFloat(amountInput);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setHasAmountError(true);
      return;
    }

    // TRIGGER INLINE CONFIRMATION
    setIsConfirmingInline(true);
  };

  const handleConfirmTransaction = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    setSaveError(null);
    try {
      if (selectedShop) {
        const rawAmount = parseFloat(amountInput);
        const finalAmount = txType === 'due' ? rawAmount : -rawAmount;
        
        // Prep notes prefix for clarity
        const rawNotes = notes.trim();
        const finalNotes = txType === 'payment'
          ? (rawNotes ? (language === 'te' ? `[జమ / బకాయి చెల్లింపు] ${rawNotes}` : `[Clearing Debt] ${rawNotes}`) : (language === 'te' ? '[జమ / బకాయి చెల్లింపు]' : '[Clearing Debt]'))
          : rawNotes;

        await onSave(selectedShop.id, selectedShop.name, finalAmount, finalNotes);
        setIsConfirmingInline(false);
        onClose();
      }
    } catch (err: any) {
      console.error(err);
      let errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("permission") || errMsg.includes("Permissions")) {
        errMsg = language === 'te' 
          ? "క్షమించండి, మీ ఖాతాకు లావాదేవీలను నమోదు చేయడానికి తగిన అనుమతులు (Permissions) లేవు." 
          : "Permission Denied: Your account does not have authorization to write transactions to this store.";
      }
      setSaveError(errMsg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="add-debt-form-container" className="space-y-4 text-slate-800">
      {/* Dynamic Segment Toggle for Transaction Type */}
      <div>
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
          {language === 'te' ? 'లావాదేవీ రకం (Transaction Type)' : 'Transaction Type'}
        </label>
        <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-xl border border-gray-200">
          <button
            type="button"
            disabled={isConfirmingInline}
            onClick={() => !isConfirmingInline && setTxType('due')}
            className={`py-2 text-xs font-extrabold rounded-lg transition-all ${
              txType === 'due'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            } disabled:opacity-60`}
          >
            {language === 'te' ? 'అప్పు నమోదు (Add Debt)' : 'Add Debt'}
          </button>
          <button
            type="button"
            disabled={isConfirmingInline}
            onClick={() => !isConfirmingInline && setTxType('payment')}
            className={`py-2 text-xs font-extrabold rounded-lg transition-all ${
              txType === 'payment'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            } disabled:opacity-60`}
          >
            {language === 'te' ? 'జమ / చెల్లింపు (Clearing Debt)' : 'Clearing Debt'}
          </button>
        </div>
      </div>

      {/* Safety block forbidding clearing debt when currentShopDebt <= 0 */}
      {txType === 'payment' && currentShopDebt <= 0 && (
        <div id="no-debt-warning" className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-900 text-xs font-medium leading-relaxed flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
          <div>
            <p className="font-extrabold text-red-950 mb-0.5">
              {language === 'te' ? 'జమ నమోదు సాధ్యం కాదు' : 'Clearing Debt Not Allowed'}
            </p>
            <p>
              {language === 'te'
                ? 'ఈ దుకాణంలో ఈ కస్టమర్‌కు ఎలాంటి యాక్టివ్ బాకీ బ్యాలెన్స్ లేదు. కాబట్టి జమ/చెల్లింపు రికార్డ్ నమోదు చేయబడదు.'
                : 'This customer has no active outstanding debt at this shop, so clearing debt is not allowed.'}
            </p>
          </div>
        </div>
      )}

      {/* Inline Confirmation Panel */}
      {isConfirmingInline && selectedShop && (
        <div id="confirm-inline-panel" className="p-4 bg-slate-50 border border-emerald-100 rounded-xl space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <h4 className="text-xs font-extrabold text-slate-905 uppercase tracking-wide flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${txType === 'due' ? 'bg-emerald-500' : 'bg-blue-500'}`}></span>
            {language === 'te' ? 'లావాదేవీ ధృవీకరణ' : 'Transaction Verification'}
          </h4>

          {/* BIG NUMBER WARNING BANNER */}
          {parseFloat(amountInput) > 150000 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs font-bold leading-relaxed flex items-start gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-extrabold">
                  {language === 'te' 
                    ? '⚠️ మీరు పెద్ద మొత్తాన్ని నమోదు చేస్తున్నారు, ఇది సరైనదేనా?' 
                    : '⚠️ You are entering a big number. Are you sure this is correct?'}
                </p>
              </div>
            </div>
          )}

          <div className="p-3.5 bg-white border border-gray-150 rounded-lg">
            {language === 'te' ? (
              <p id="transaction-verification-message" className="text-gray-800 text-xs leading-relaxed font-extrabold text-slate-905">
                లావాదేవీ ధృవీకరణ: మీరు ఖచ్చితంగా ₹{parseFloat(amountInput).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {txType === 'due' ? 'బకాయి మొత్తాన్ని' : 'జమ మొత్తాన్ని (చెల్లింపు)'} కస్టమర్ {customer.name} ఖాతాలో {selectedShop.name} వద్ద నమోదు చేయాలనుకుంటున్నారా?
              </p>
            ) : (
              <p id="transaction-verification-message" className="text-gray-800 text-xs leading-relaxed font-semibold text-slate-905">
                Transaction Verification: Are you sure you want to log ₹{parseFloat(amountInput).toLocaleString('en-IN', { minimumFractionDigits: 2 })} as {txType === 'due' ? 'outstanding debt' : 'payment received (clearing debt)'} for customer {customer.name} at {selectedShop.name}?
              </p>
            )}
          </div>

          {saveError && (
            <div id="inline-permission-denied-error" className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-900 text-xs font-bold leading-relaxed flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <div>
                <p className="font-extrabold text-red-950">
                  {language === 'te' ? 'నమోదు వైఫల్యం' : 'Failed to save transaction'}
                </p>
                <p className="font-semibold text-red-800 mt-0.5">{saveError}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              id="cancel-confirm-btn"
              type="button"
              disabled={isSaving}
              onClick={() => { setIsConfirmingInline(false); setSaveError(null); }}
              className="px-3.5 py-1.5 border border-gray-200 text-gray-750 bg-white rounded-lg hover:bg-gray-50 text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
            >
              {language === 'te' ? 'మార్చండి (Edit)' : 'No, Edit'}
            </button>
            <button
              id="confirm-submit-btn"
              type="button"
              disabled={isSaving}
              onClick={handleConfirmTransaction}
              className={`px-3.5 py-1.5 text-white rounded-lg text-xs font-semibold transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                txType === 'due' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {language === 'te' ? 'నమోదు చేయబడుతోంది...' : 'Saving...'}
                </>
              ) : (
                language === 'te' ? 'అవును, నమోదు చేయి' : 'Yes, Save Entry'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Main Add Debt Form */}
      <form id="add-debt-entry-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            {t.addDebtShopSelect}
          </label>
          {shops.length === 0 ? (
            <div className="p-3 bg-amber-50 text-amber-800 rounded-lg text-sm border border-amber-200">
              {language === 'te' 
                ? 'ఎలాంటి రిజిస్టర్డ్ దుకాణాలు అందుబాటులో లేవు. దయచేసి మొదట మీ దుకాణాన్ని రిజిస్టర్ చేయండి.' 
                : 'No shops registered. Please register a shop first.'}
            </div>
          ) : (
            <select
              id="debt-shop-select"
              disabled={isConfirmingInline}
              value={selectedShopId}
              onChange={(e) => setSelectedShopId(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-gray-800 disabled:bg-gray-100 disabled:text-gray-400"
            >
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name} ({shop.address})
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            {txType === 'due' 
              ? (language === 'te' ? 'బకాయి పెరిగే అప్పు మొత్తం (₹) *' : 'Debt Outstanding Amount (₹) *') 
              : (language === 'te' ? 'జమ చేయాల్సిన చెల్లింపు మొత్తం (₹) *' : 'Payment Clearing Amount (₹) *')}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-gray-400 font-semibold text-sm">₹</span>
            <input
              id="debt-amount-input"
              type="number"
              step="0.01"
              required
              disabled={isConfirmingInline || (txType === 'payment' && currentShopDebt <= 0)}
              placeholder="0.00"
              value={amountInput}
              onChange={(e) => {
                setAmountInput(e.target.value);
                setHasAmountError(false);
              }}
              className={`w-full bg-white border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-gray-900 transition-colors disabled:bg-gray-100 disabled:text-gray-400 ${
                hasAmountError ? 'border-red-500 ring-2 ring-red-100 placeholder-red-300' : 'border-gray-200'
              }`}
            />
          </div>
          {hasAmountError && (parseFloat(amountInput) <= 0 || isNaN(parseFloat(amountInput))) && (
            <p className="text-xs text-red-500 mt-1 font-semibold flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> 
              {language === 'te' 
                ? 'దయచేసి సరైన క్రెడిట్ మొత్తాన్ని నమోదు చేయండి.' 
                : 'Please enter a valid credit amount.'}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            {txType === 'due' 
              ? (language === 'te' ? 'వివరాలు / సామాన్ల వివరాలు' : 'Comments / Itemized List')
              : (language === 'te' ? 'చెల్లింపు వివరాలు (ఆప్షనల్)' : 'Payment Notes (Optional)')}
          </label>
          <textarea
            id="debt-notes-textarea"
            rows={3}
            disabled={isConfirmingInline || (txType === 'payment' && currentShopDebt <= 0)}
            placeholder={txType === 'due' 
              ? (language === 'te' ? 'కొనుగోలు చేసిన సామాన్లు, ఉదా. బియ్యం, పప్పు' : 'What was purchased on credit? e.g. Rice, Oil')
              : (language === 'te' ? 'కూలీ జమ, నగదు, గూగుల్ పే వగైరా' : 'e.g. Google Pay, Cash, partial clearance')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-800 font-medium disabled:bg-gray-100 disabled:text-gray-400"
          />
        </div>

        {!isConfirmingInline && (
          <div className="pt-2 flex justify-end gap-2">
            <button
              id="cancel-debt-form-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-semibold text-gray-750 transition cursor-pointer"
            >
              {t.cancelBtn}
            </button>
            <button
              id="save-debt-form-btn"
              type="submit"
              disabled={shops.length === 0 || (txType === 'payment' && currentShopDebt <= 0)}
              className={`px-4 py-2 text-white font-semibold rounded-lg text-sm transition flex items-center gap-2 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed cursor-pointer shadow-xs ${
                txType === 'due' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {txType === 'due' 
                ? (language === 'te' ? 'బకాయి సృష్టించు' : 'Create Entry') 
                : (language === 'te' ? 'జమ నమోదు చేయి' : 'Settle Amount')}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
