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
  const { t } = useLanguage();
  const [selectedShopId, setSelectedShopId] = useState<string>(shops[0]?.id || '');
  const [amountInput, setAmountInput] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  
  // Safety check states
  const [hasAmountError, setHasAmountError] = useState(false);
  const [showLimitAlert, setShowLimitAlert] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Find the details of selected shop
  const selectedShop = shops.find(s => s.id === selectedShopId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setHasAmountError(false);

    if (!selectedShopId) {
      alert("దయచేసి మొదటగా ఒక దుకాణాన్ని సృష్టించండి లేదా ఎంచుకోండి.");
      return;
    }

    const parsedAmount = parseFloat(amountInput);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setHasAmountError(true);
      return;
    }

    // 1. MAXIMUM THRESHOLD GUARD
    if (parsedAmount > 150000) {
      setHasAmountError(true);
      setShowLimitAlert(true);
      return;
    }

    // 2. TRIGGER CONFIRMATION MODAL
    setShowConfirmModal(true);
  };

  const handleConfirmTransaction = async () => {
    if (isSaving) return;
    
    // 3. DOUBLE-CLICK BLOCKER
    setIsSaving(true);
    try {
      if (selectedShop) {
        await onSave(selectedShop.id, selectedShop.name, parseFloat(amountInput), notes);
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
      {/* Maximum Threshold Alert (Custom Overlay Modal to prevent iframe blocking) */}
      {showLimitAlert && (
        <div id="limit-alert-backdrop" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[90]">
          <div id="limit-alert-card" className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border-l-4 border-red-500 animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-50 rounded-full text-red-600">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">{t.limitBlockedTitle}</h3>
                <p className="text-sm text-gray-600 mt-2 font-medium">
                  {t.limitBlockedDesc}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                id="close-limit-alert-btn"
                type="button"
                onClick={() => setShowLimitAlert(false)}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-semibold transition"
              >
                {t.acknowledgeBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal Overlay */}
      {showConfirmModal && selectedShop && (
        <div id="confirm-modal-backdrop" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[80]">
          <div id="confirm-modal-card" className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-gray-100 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              కాలానుగుణ బకాయి రికార్డ్ వెరిఫికేషన్
            </h3>
            
            <div className="my-5 p-4 bg-emerald-50/50 border border-emerald-100 rounded-lg">
              <p className="text-gray-800 text-base leading-relaxed">
                లావాదేవీ ధృవీకరణ: <strong className="text-emerald-950 font-extrabold text-base">మీరు ఖచ్చితంగా ₹{parseFloat(amountInput).toLocaleString('en-IN', { minimumFractionDigits: 2 })} బకాయి మొత్తాన్ని కస్టమర్ {customer.name} ఖాతాలో {selectedShop.name} వద్ద నమోదు చేయాలనుకుంటున్నారా?</strong>
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
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    నమోదు చేయబడుతోంది...
                  </>
                ) : (
                  'ధృవీకరించి సేవ్ చేయి'
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
              ఎలాంటి రిజిస్టర్డ్ దుకాణాలు అందుబాటులో లేవు. దయచేసి మునుముందుగా 'దుకాణాల నమోదు (Shops)' ట్యాబ్‌లో దుకాణాన్ని క్రియేట్ చేయండి.
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
            {t.addDebtAmountLabel}
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
          {hasAmountError && parseFloat(amountInput) > 150000 && (
            <p className="text-xs text-red-500 mt-1 font-semibold flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> పరిమితి ₹1,50,000 కంటే ఎక్కువ ఉండకూడదు.
            </p>
          )}
          {hasAmountError && (parseFloat(amountInput) <= 0 || isNaN(parseFloat(amountInput))) && (
            <p className="text-xs text-red-500 mt-1 font-semibold flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> దయచేసి సరైన క్రెడిట్ మొత్తాన్ని నమోదు చేయండి.
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            {t.addDebtNotesLabel} (ఐచ్ఛికం)
          </label>
          <textarea
            id="debt-notes-textarea"
            rows={3}
            placeholder={t.addDebtNotesPlaceholder}
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
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-sm transition flex items-center gap-2 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed cursor-pointer"
          >
            {t.logDebtBtn}
          </button>
        </div>
      </form>
    </div>
  );
}
