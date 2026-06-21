/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shop, Customer } from '../types';
import { useLanguage } from '../lib/translations';
import { AlertCircle, Loader2 } from 'lucide-react';

interface AddDebtFormProps {
  customer: Customer;
  shops: Shop[];
  onSave: (shopId: string, shopName: string, amount: number, notes: string) => Promise<void>;
  onClose: () => void;
}

export default function AddDebtForm({ customer, shops, onSave, onClose }: AddDebtFormProps) {
  const { t, language } = useLanguage();
  const [selectedShopId, setSelectedShopId] = useState<string>(shops[0]?.id || '');
  const [amountInput, setAmountInput] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [txType, setTxType] = useState<'due' | 'payment'>('due');
  
  // Safety check states
  const [hasAmountError, setHasAmountError] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Find the details of selected shop
  const selectedShop = shops.find(s => s.id === selectedShopId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setHasAmountError(false);

    if (!selectedShopId) {
      alert(language === 'te' 
        ? "దయచేసి మొదట ఒక దుకాణాన్ని క్రియేట్ చేయండి లేదా ఎంచుకోండి." 
        : "Please register or select a shop first.");
      return;
    }

    const parsedAmount = parseFloat(amountInput);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setHasAmountError(true);
      return;
    }

    // TRIGGER CONFIRMATION MODAL
    setShowConfirmModal(true);
  };

  const handleConfirmTransaction = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
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
        setShowConfirmModal(false);
        onClose();
      }
    } catch (err) {
      console.error(err);
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
            onClick={() => setTxType('due')}
            className={`py-2 text-xs font-extrabold rounded-lg transition-all ${
              txType === 'due'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {language === 'te' ? 'అప్పు నమోదు (Add Debt)' : 'Add Debt'}
          </button>
          <button
            type="button"
            onClick={() => setTxType('payment')}
            className={`py-2 text-xs font-extrabold rounded-lg transition-all ${
              txType === 'payment'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {language === 'te' ? 'జమ / చెల్లింపు (Clearing Debt)' : 'Clearing Debt'}
          </button>
        </div>
      </div>

      {/* Confirmation Modal Overlay */}
      {showConfirmModal && selectedShop && (
        <div id="confirm-modal-backdrop" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[80]">
          <div id="confirm-modal-card" className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-gray-100 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-3 flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${txType === 'due' ? 'bg-emerald-500' : 'bg-blue-500'}`}></span>
              {language === 'te' ? 'రికార్డు నిర్ధారణ' : 'Record Verification'}
            </h3>
            
            {/* BIG NUMBER WARNING BANNER */}
            {parseFloat(amountInput) > 150000 && (
              <div className="my-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs font-bold leading-relaxed flex items-start gap-2">
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

            <div className="my-4 p-4 bg-slate-50/50 border border-gray-150 rounded-lg">
              <p className="text-gray-800 text-sm leading-relaxed">
                {language === 'te' ? (
                  <>
                    లావాదేవీ ధృవీకరణ: <strong className="text-slate-905 font-extrabold text-sm">
                      మీరు ఖచ్చితంగా ₹{parseFloat(amountInput).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {txType === 'due' ? 'బకాయి మొత్తాన్ని' : 'జమ మొత్తాన్ని (చెల్లింపు)'} కస్టమర్ {customer.name} ఖాతాలో {selectedShop.name} వద్ద నమోదు చేయాలనుకుంటున్నారా?
                    </strong>
                  </>
                ) : (
                  <>
                    Transaction Verification: <strong className="text-slate-905 font-extrabold text-sm">
                      Are you sure you want to log ₹{parseFloat(amountInput).toLocaleString('en-IN', { minimumFractionDigits: 2 })} as {txType === 'due' ? 'outstanding debt' : 'payment received (clearing debt)'} for customer {customer.name} at {selectedShop.name}?
                    </strong>
                  </>
                )}
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                id="cancel-confirm-btn"
                type="button"
                disabled={isSaving}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-gray-200 text-gray-700 bg-white rounded-lg hover:bg-gray-50 text-sm font-semibold transition disabled:opacity-50"
              >
                {t.cancelBtn}
              </button>
              <button
                id="confirm-submit-btn"
                type="button"
                disabled={isSaving}
                onClick={handleConfirmTransaction}
                className={`px-4 py-2 text-white rounded-lg text-sm font-semibold transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  txType === 'due' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {language === 'te' ? 'నమోదు చేయబడుతోంది...' : 'Saving...'}
                  </>
                ) : (
                  language === 'te' ? 'జమ చేయి' : 'Confirm & Save'
                )}
              </button>
            </div>
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
              value={selectedShopId}
              onChange={(e) => setSelectedShopId(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-gray-800"
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
              placeholder="0.00"
              value={amountInput}
              onChange={(e) => {
                setAmountInput(e.target.value);
                setHasAmountError(false);
              }}
              className={`w-full bg-white border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-gray-900 transition-colors ${
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
            placeholder={txType === 'due' 
              ? (language === 'te' ? 'కొనుగోలు చేసిన సామాన్లు, ఉదా. బియ్యం, పప్పు' : 'What was purchased on credit? e.g. Rice, Oil')
              : (language === 'te' ? 'కూలీ జమ, నగదు, గూగుల్ పే వగైరా' : 'e.g. Google Pay, Cash, partial clearance')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-800 font-medium"
          />
        </div>

        <div className="pt-2 flex justify-end gap-2">
          <button
            id="cancel-debt-form-btn"
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-semibold text-gray-750 transition"
          >
            {t.cancelBtn}
          </button>
          <button
            id="save-debt-form-btn"
            type="submit"
            disabled={shops.length === 0}
            className={`px-4 py-2 text-white font-semibold rounded-lg text-sm transition flex items-center gap-2 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed cursor-pointer shadow-xs ${
              txType === 'due' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {txType === 'due' 
              ? (language === 'te' ? 'బకాయి సృష్టించు' : 'Create Entry') 
              : (language === 'te' ? 'జమ నమోదు చేయి' : 'Settle Amount')}
          </button>
        </div>
      </form>
    </div>
  );
}
