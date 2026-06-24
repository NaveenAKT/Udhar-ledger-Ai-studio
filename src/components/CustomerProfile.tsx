/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Customer, Transaction, Shop, LedgerUser, AuditLogEntry } from '../types';
import { useLanguage } from '../lib/translations';
import { getActionTypeLabel } from './MerchantTransactions';
import AddDebtForm from './AddDebtForm';
import { 
  ArrowLeft, 
  Phone, 
  Mail, 
  Calendar, 
  CreditCard, 
  Plus, 
  FileEdit, 
  Trash2, 
  AlertCircle, 
  X, 
  Loader2,
  IndianRupee,
  User,
  Edit2,
  History,
  Activity,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';

interface CustomerProfileProps {
  customer: Customer;
  transactions: Transaction[];
  shops: Shop[];
  currentUser: LedgerUser | null;
  auditLogs: AuditLogEntry[];
  onBack: () => void;
  onAddTransaction: (shopId: string, shopName: string, amount: number, notes: string) => Promise<void>;
  onUpdateTransaction: (txId: string, updates: Partial<Pick<Transaction, 'amount' | 'status' | 'notes'>>) => Promise<void>;
  onDeleteTransaction: (txId: string) => Promise<void>;
  onUpdateCustomer: (customerId: string, name: string, phone: string, email: string, village?: string, mandal?: string) => Promise<void>;
}

export default function CustomerProfile({
  customer,
  transactions,
  shops,
  currentUser,
  auditLogs = [],
  onBack,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  onUpdateCustomer,
}: CustomerProfileProps) {
  const { t, language } = useLanguage();

  // Navigation & Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showCustomerEditModal, setShowCustomerEditModal] = useState(false);
  // Customer Edit Form states
  const [custName, setCustName] = useState(customer.name);
  const [custPhone, setCustPhone] = useState(customer.phone);
  const [custEmail, setCustEmail] = useState(customer.email || '');
  const [custVillage, setCustVillage] = useState(customer.village || '');
  const [custMandal, setCustMandal] = useState(customer.mandal || '');
  const [isUpdatingCustomer, setIsUpdatingCustomer] = useState(false);
  const [custEditError, setCustEditError] = useState('');

  // Edit transaction states
  const [editAmount, setEditAmount] = useState('');
  const [editStatus, setEditStatus] = useState<'Paid' | 'Unpaid'>('Unpaid');
  const [editNotes, setEditNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [editHasError, setEditHasError] = useState(false);
  const [showEditLimitAlert, setShowEditLimitAlert] = useState(false);

  // Deletion tracker
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Accordion and bottom sheet states
  const [expandedTxIds, setExpandedTxIds] = useState<Record<string, boolean>>({});
  const [activeMobileBottomSheetTx, setActiveMobileBottomSheetTx] = useState<Transaction | null>(null);

  const toggleTxExpand = (txId: string) => {
    setExpandedTxIds(prev => ({
      ...prev,
      [txId]: !prev[txId]
    }));
  };

  const isSuperUser = currentUser?.email === 'naveenkumar31343@gmail.com';
  const canEditCustomer = isSuperUser || (currentUser && customer.ownerId === currentUser.uid);

  // Filter historic transactions for this specific customer
  const customerTx = useMemo(() => {
    return transactions
      .filter(t => t.customerId === customer.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [transactions, customer.id]);

  // Aggregate stats
  const totals = useMemo(() => {
    let unpaidSum = 0;
    let paidSum = 0;
    const uniqueShops = new Set<string>();

    customerTx.forEach(t => {
      if (t.status === 'Unpaid') {
        unpaidSum += t.amount;
        uniqueShops.add(t.shopId);
        if (t.amount < 0) {
          paidSum += Math.abs(t.amount);
        }
      } else {
        paidSum += t.amount;
      }
    });

    return {
      unpaid: unpaidSum,
      paid: paidSum,
      shopsCount: uniqueShops.size
    };
  }, [customerTx]);

  // Group outstanding balances by individual shop (even shops the merchant doesn't have access to)
  const debtByShop = useMemo(() => {
    const shopMap: Record<string, { shopName: string; amount: number; isMyShop: boolean }> = {};
    const myShopIds = new Set(shops.map(s => s.id));

    // Sum up outstanding amounts per shop name using all of this customer's transactions
    transactions.forEach(tx => {
      if (tx.customerId === customer.id && tx.status === 'Unpaid') {
        if (!shopMap[tx.shopId]) {
          shopMap[tx.shopId] = {
            shopName: tx.shopName,
            amount: 0,
            isMyShop: myShopIds.has(tx.shopId)
          };
        }
        shopMap[tx.shopId].amount += tx.amount;
      }
    });

    return Object.values(shopMap).sort((a, b) => b.amount - a.amount);
  }, [customer.id, transactions, shops]);

  // Trigger edit modal prep
  const startEditTx = (tx: Transaction) => {
    setEditingTransaction(tx);
    setEditAmount(tx.amount.toString());
    setEditStatus(tx.status);
    setEditNotes(tx.notes);
    setEditHasError(false);
    setShowEditLimitAlert(false);
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;

    const parsed = parseFloat(editAmount);
    if (isNaN(parsed) || parsed <= 0) {
      setEditHasError(true);
      return;
    }

    // Safety constraint: Maximum transaction threshold
    if (parsed > 150000) {
      setEditHasError(true);
      setShowEditLimitAlert(true);
      return;
    }

    setIsUpdating(true);
    try {
      await onUpdateTransaction(editingTransaction.id, {
        amount: parsed,
        status: editStatus,
        notes: editNotes.trim()
      });
      setEditingTransaction(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTransactionDelete = async (txId: string) => {
    setIsDeleting(true);
    try {
      await onDeleteTransaction(txId);
      setConfirmDeleteId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCustomerEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !custPhone.trim()) return;

    setIsUpdatingCustomer(true);
    setCustEditError('');
    try {
      await onUpdateCustomer(
        customer.id, 
        custName.trim(), 
        custPhone.trim(), 
        custEmail.trim(), 
        custVillage.trim(), 
        custMandal.trim()
      );
      setShowCustomerEditModal(false);
    } catch (err: any) {
      setCustEditError(err.message || (language === 'te' ? 'మార్పులను సేవ్‌ చేయడంలో లోపం బంధించబడింది.' : 'Failed to save changes.'));
    } finally {
      setIsUpdatingCustomer(false);
    }
  };

  return (
    <div id="customer-profile-view" className="space-y-6 animate-in fade-in duration-200 text-slate-800">
      
      {/* Edit Customer Modal */}
      {showCustomerEditModal && (
        <div id="edit-customer-profile-backdrop" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[75]">
          <div id="edit-customer-profile-card" className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-600" />
                {t.editCustomerTitle}
              </h3>
              <button 
                onClick={() => setShowCustomerEditModal(false)}
                className="text-gray-400 hover:text-gray-600 transition"
                disabled={isUpdatingCustomer}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCustomerEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">{t.newCustomerNameLabel}</label>
                <input
                  type="text"
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-850"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">{t.newCustomerPhoneLabel}</label>
                <input
                  type="text"
                  required
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-850"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">{t.newCustomerEmailLabel}</label>
                <input
                  type="email"
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-850"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">{t.customerVillageLabel}</label>
                  <input
                    type="text"
                    placeholder={t.customerVillagePlaceholder}
                    value={custVillage}
                    onChange={(e) => setCustVillage(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-850"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">{t.customerMandalLabel}</label>
                  <input
                    type="text"
                    placeholder={t.customerMandalPlaceholder}
                    value={custMandal}
                    onChange={(e) => setCustMandal(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-850"
                  />
                </div>
              </div>

              {custEditError && (
                <p className="text-xs text-red-605 bg-red-50 p-2 text-center rounded border border-red-100 font-bold">{custEditError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t mt-4">
                <button
                  type="button"
                  onClick={() => setShowCustomerEditModal(false)}
                  disabled={isUpdatingCustomer}
                  className="px-4 py-2 border border-gray-200 text-gray-700 bg-white rounded-lg hover:bg-gray-50 text-xs font-bold"
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingCustomer}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  {isUpdatingCustomer && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t.savingChangesBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Limit Alert Popup */}
      {showEditLimitAlert && (
        <div id="edit-limit-backdrop" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[95]">
          <div id="edit-limit-card" className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border-l-4 border-red-500 animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-50 rounded-full text-red-600">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">{t.limitBlockedTitle}</h3>
                <p className="text-sm text-gray-650 mt-2 font-medium">
                  {t.limitBlockedDesc}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowEditLimitAlert(false)}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-semibold transition"
              >
                {t.acknowledgeBtn}
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Edit Transaction Modal */}
      {editingTransaction && (
        <div id="edit-tx-modal-backdrop" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[75]">
          <div id="edit-tx-modal-card" className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <FileEdit className="w-5 h-5 text-emerald-600" />
                {t.modifyTxTitle}
              </h3>
              <button 
                onClick={() => setEditingTransaction(null)}
                className="text-gray-400 hover:text-gray-600 transition"
                disabled={isUpdating}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">{t.dueAmountLabel}</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editAmount}
                  onChange={(e) => {
                    setEditAmount(e.target.value);
                    setEditHasError(false);
                  }}
                  className={`w-full bg-gray-50 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-gray-900 transition-colors ${
                    editHasError ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-200'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">{t.notesDetailsLabel}</label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-850 font-medium"
                  placeholder={t.notesPlaceholder}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t mt-4">
                <button
                  type="button"
                  onClick={() => setEditingTransaction(null)}
                  disabled={isUpdating}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-xs font-bold transition"
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  {isUpdating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t.savingChangesBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header and Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
        <button
          id="profile-back-btn"
          onClick={onBack}
          className="flex items-center gap-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold px-6 py-3 rounded-xl transition border border-gray-200 cursor-pointer text-sm group shrink-0 shadow-2xs"
        >
          <ArrowLeft className="w-5 h-5 text-emerald-600 group-hover:-translate-x-1.5 transition-transform stroke-[2.5]" />
          <span>{t.backToDirectory}</span>
        </button>
 
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          {canEditCustomer && (
            <button
              onClick={() => setShowCustomerEditModal(true)}
              className="bg-yellow-50 border border-yellow-250 hover:bg-yellow-100 text-yellow-850 text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-3xs"
            >
              <Edit2 className="w-3.5 h-3.5" />
              {t.editCustomerDetailsBtn}
            </button>
          )}

          <button
            id="profile-add-tx-btn"
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            {t.logDebtEntryBtn}
          </button>
        </div>
      </div>

      {/* Dynamic Add Debt Inline Panel */}
      {showAddModal && (
        <div id="add-tx-inline-container" className="bg-white rounded-2xl border-2 border-emerald-500/80 p-6 shadow-md animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between border-b pb-3 mb-4">
            <h3 className="font-extrabold text-emerald-900 text-base flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-emerald-600" />
              <span>{t.logDebtFor || "ਲਾਗ ਲਾਭ"}: <span className="text-gray-800 font-extrabold">{customer.name}</span></span>
            </h3>
            <button 
              onClick={() => setShowAddModal(false)}
              className="p-1 px-1.5 hover:bg-slate-150 text-gray-400 hover:text-gray-600 rounded-lg transition"
            >
              <X className="w-5 h-5" strokeWidth={2.5} />
            </button>
          </div>

          <AddDebtForm
            customer={customer}
            shops={shops}
            transactions={transactions}
            onSave={onAddTransaction}
            onClose={() => setShowAddModal(false)}
          />
        </div>
      )}

      {/* Customer Meta Panel */}
      <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              {language === 'te' ? 'కస్టమర్ వ్యక్తిగత ప్రొఫైల్' : 'Customer Personal Profile'}
            </span>
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight leading-tight mt-1">{customer.name}</h2>
            <p className="text-[10px] font-semibold text-slate-400 mt-1 flex items-center gap-1.5 font-mono">
              <Calendar className="w-3.5 h-3.5" />
              {t.profileRegisterDate}: {new Date(customer.createdAt).toLocaleDateString()}
            </p>
          </div>

          <div className="space-y-2 text-xs font-bold text-slate-600">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-400" />
              <span>{customer.phone}</span>
            </div>
            {customer.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                <span>{customer.email}</span>
              </div>
            )}
            {(customer.village || customer.mandal) && (
              <div className="flex items-center gap-2 text-slate-700 bg-slate-50 border border-slate-200/60 p-2 rounded-lg mt-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">
                  {language === 'te' ? 'గ్రామం & మండలం:' : 'Village & Mandal:'}
                </span>
                <span className="font-semibold">{customer.village || '-'}{customer.mandal ? ` / ${customer.mandal}` : ''}</span>
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-red-50/50 border border-red-100/50 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-red-700/80 uppercase tracking-wider block">{t.outstandingUnpaidHeader}</span>
            <p className="text-2xl font-extrabold text-red-650 font-mono mt-2">
              ₹{totals.unpaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-[9px] font-bold text-red-500/80 mt-2 block">{t.requiresSettlementSub}</span>
          </div>

          <div className="bg-emerald-50/50 border border-emerald-100/40 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-emerald-700/80 uppercase tracking-wider block">{t.totalSettledHeader}</span>
            <p className="text-2xl font-extrabold text-emerald-650 font-mono mt-2">
              ₹{totals.paid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-[9px] font-bold text-emerald-500/80 mt-2 block">{t.settledHistorySub}</span>
          </div>

          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{t.activeAccountsHeader}</span>
            <p className="text-2xl font-extrabold text-gray-805 font-mono mt-2 flex items-baseline gap-1">
              {totals.shopsCount} <span className="text-xs text-slate-400">{totals.shopsCount === 1 ? t.shopPlural : t.shopsPlural}</span>
            </p>
            <span className="text-[9px] font-bold text-gray-400 mt-2 block">{t.countShopsOwedSub}</span>
          </div>
        </div>
      </div>

      {/* Shop-wise Outstanding Debt Breakdowns */}
      <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h3 className="font-extrabold text-slate-905 text-base flex items-center gap-2">
            <IndianRupee className="w-5 h-5 text-emerald-600" />
            <span>{language === 'te' ? 'దుకాణాల వారీగా బాకీల వివరాలు (అన్ని దుకాణాలు)' : 'Outstanding Debts by Shop (All Associated Shops)'}</span>
          </h3>
          <p className="text-xs font-semibold text-slate-405 mt-1">
            {language === 'te' ? 'ఈ కస్టమర్ ఏయే దుకాణాలకు ఎంత బాకీ ఉన్నారో ఇక్కడ స్పష్టంగా చూడవచ్చు (మీకు యాక్సెస్ లేని దుకాణాలతో సహా).' : 'Detailed breakdown of how much money this customer owes to each shop across the system (including shops you do not manage).'}
          </p>
        </div>

        {debtByShop.length === 0 ? (
          <div className="bg-emerald-50/30 border border-emerald-100 rounded-xl p-4 text-center">
            <span className="text-sm font-bold text-emerald-800">{language === 'te' ? 'ఈ కస్టమర్‌కు ఎలాంటి బాకీలు లేవు! అన్ని చెల్లించబడినవి.' : 'This customer does not owe money to any shops! Everything is fully settled.'}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {debtByShop.map(item => (
              <div 
                key={item.shopName} 
                className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                  item.isMyShop 
                    ? 'bg-slate-55/50 border-gray-200 shadow-3xs hover:border-emerald-250' 
                    : 'bg-amber-50/15 border-amber-100 hover:border-amber-250'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-extrabold text-slate-800 text-sm truncate" title={item.shopName}>
                    {item.shopName}
                  </span>
                </div>
                <div className="mt-4 flex items-baseline justify-between pt-2 border-t border-dashed border-slate-100">
                  <span className="text-xs text-slate-400 font-bold uppercase">{language === 'te' ? 'బాకీ' : 'Owes'}</span>
                  <span className="text-xl font-mono font-black text-red-650">
                    ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historic Ledger Tables */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-xs uppercase tracking-wider">{t.historicalDebtTitle}</h3>
          <span className="text-xs font-mono font-bold bg-gray-50 border border-gray-150 text-slate-500 px-3 py-1 rounded-md">
            {customerTx.length} {t.recordSuffix}
          </span>
        </div>

        {customerTx.length === 0 ? (
          <div className="text-center py-16 p-8">
            <Info className="w-9 h-9 text-slate-300 mx-auto mb-3" />
            <h4 className="font-bold text-slate-800">{language === 'te' ? 'ఎలాంటి లావాదేవీ రికార్డులు కనుగొనబడలేదు' : 'No Transaction Records Found'}</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {language === 'te' ? 'ఈ కస్టమర్కు సంబంధించిన ఎలాంటి లావాదేవీల రికార్డులు లేవు.' : 'There are no ledger transactions recorded for this customer in our system.'}
            </p>
          </div>
        ) : (
          <div>
            {/* MOBILE COMPACT LIST - Prevents horizontal overflow completely */}
            <div className="block md:hidden divide-y divide-gray-150/60 max-w-full overflow-hidden">
              {customerTx.map(tx => {
                const isUnpaid = tx.status === 'Unpaid';
                return (
                  <div
                    key={tx.id}
                    onClick={() => setActiveMobileBottomSheetTx(tx)}
                    className="p-4 space-y-3 hover:bg-slate-50/20 active:bg-slate-50/55 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-extrabold text-slate-900 text-sm">{customer.name}</span>
                      <span className="font-mono text-[9px] text-gray-500 shrink-0 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded font-black uppercase">
                        {new Date(tx.createdAt).toLocaleDateString('te-IN')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] font-bold text-slate-650 truncate flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></span>
                        <span className="truncate">{tx.shopName}</span>
                      </div>
                      <div className="font-mono font-black text-xs text-right shrink-0">
                        {tx.amount < 0 ? (
                          <span className="text-blue-650">
                            - ₹{Math.abs(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className={isUnpaid ? 'text-red-655 font-bold' : 'text-emerald-655 font-bold'}>
                            ₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-dashed border-gray-100">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black leading-none uppercase ${
                        tx.amount < 0
                          ? 'bg-blue-50 text-blue-700 border border-blue-105'
                          : isUnpaid
                            ? 'bg-red-50 text-red-700 border border-red-105'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-110'
                      }`}>
                        {tx.amount < 0
                          ? (language === 'te' ? 'జమ (payment)' : 'Payment')
                          : isUnpaid
                            ? 'Unpaid'
                            : 'Settled'}
                      </span>
                      <span className="text-[10px] text-emerald-655 font-bold hover:underline cursor-pointer">
                        {language === 'te' ? 'వివరాలు చూడండి →' : 'View Details →'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP VIEW - Only rendered on md screens and wider */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-[10px] uppercase font-extrabold text-gray-400">
                    <th className="px-4 py-3.5 w-12 text-center"></th>
                    <th className="px-6 py-3.5">{t.tableHeaderDate}</th>
                    <th className="px-6 py-3.5">{t.tableHeaderShop}</th>
                    <th className="px-6 py-3.5">{t.tableHeaderAmount}</th>
                    <th className="px-6 py-3.5">{t.tableHeaderStatus}</th>
                    <th className="px-6 py-3.5 text-right">{t.tableHeaderActions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs font-semibold">
                  {customerTx.map(tx => {
                    const isUnpaid = tx.status === 'Unpaid';
                    const isDeletingTarget = confirmDeleteId === tx.id;
                    const isExpanded = !!expandedTxIds[tx.id];
                    const hasAccessToShop = isSuperUser || shops.some(s => s.id === tx.shopId);

                    return (
                      <React.Fragment key={tx.id}>
                        <tr id={`tx-row-${tx.id}`} className="hover:bg-gray-55/40 transition-colors">
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => toggleTxExpand(tx.id)}
                              className="p-1 hover:bg-slate-100 rounded-lg transition-all cursor-pointer inline-flex items-center justify-center"
                              title={language === 'te' ? 'వివరాలు' : 'Details'}
                            >
                              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          </td>
                          <td className="px-6 py-4 font-mono text-gray-500 whitespace-nowrap cursor-pointer" onClick={() => toggleTxExpand(tx.id)}>
                            {new Date(tx.createdAt).toLocaleDateString('te-IN')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap cursor-pointer" onClick={() => toggleTxExpand(tx.id)}>
                            <div className="font-extrabold text-gray-800 flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${hasAccessToShop ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
                              {tx.shopName}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono font-extrabold whitespace-nowrap cursor-pointer" onClick={() => toggleTxExpand(tx.id)}>
                            {tx.amount < 0 ? (
                              <span className="text-blue-650">
                                - ₹{Math.abs(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className={isUnpaid ? 'text-red-655 font-bold' : 'text-emerald-655 font-bold'}>
                                ₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap cursor-pointer" onClick={() => toggleTxExpand(tx.id)}>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black leading-none uppercase ${
                              tx.amount < 0
                                ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                : isUnpaid
                                  ? 'bg-red-50 text-red-700 border border-red-100'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            }`}>
                              {tx.amount < 0
                                ? (language === 'te' ? 'జమ (Payment)' : 'Payment')
                                : isUnpaid
                                  ? 'Unpaid'
                                  : 'Settled'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            {!hasAccessToShop ? (
                              <span
                                className="text-[10px] text-slate-400 font-bold bg-slate-50 border border-gray-150 px-2 py-1 rounded"
                                title={language === 'te' ? "మీకు ఈ దుకాణానికి తగినంత యాక్సెస్ లేదు" : "You do not have access to this shop"}
                              >
                                {t.managedByPartner}
                              </span>
                            ) : isDeletingTarget ? (
                              <div className="inline-flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2 duration-150">
                                <span className="text-[10px] font-bold text-red-700 select-none mr-1.5">{t.confirmDeleteLabel}</span>
                                <button
                                  id={`cancel-del-tx-${tx.id}`}
                                  disabled={isDeleting}
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-1 border border-gray-200 hover:bg-gray-55 text-gray-650 text-[10px] font-bold rounded cursor-pointer"
                                >
                                  {t.deleteNo}
                                </button>
                                <button
                                  id={`confirm-del-tx-${tx.id}`}
                                  disabled={isDeleting}
                                  onClick={() => handleTransactionDelete(tx.id)}
                                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold rounded flex items-center gap-1 cursor-pointer"
                                >
                                  {isDeleting && <Loader2 className="w-3 h-3 animate-spin" />}
                                  {t.deleteYes}
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex gap-2">
                                {tx.amount >= 0 && (
                                  <button
                                    id={`edit-tx-btn-${tx.id}`}
                                    onClick={() => startEditTx(tx)}
                                    className="p-1 px-2 border border-gray-250 bg-white hover:bg-gray-50 text-gray-700 rounded text-[11px] font-bold hover:border-emerald-500/30 transition flex items-center gap-1 cursor-pointer"
                                  >
                                    <FileEdit className="w-3.5 h-3.5 text-gray-400" />
                                    {t.actionEdit}
                                  </button>
                                )}
                                <button
                                  id={`delete-tx-btn-${tx.id}`}
                                  onClick={() => setConfirmDeleteId(tx.id)}
                                  className="p-1 px-2 border border-red-100 bg-red-50 hover:bg-red-100 text-red-750 rounded text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-650" />
                                  {t.actionDelete}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr key={`expanded-${tx.id}`} className="bg-slate-50/45">
                            <td colSpan={6} className="px-6 py-4 border-t border-gray-100 bg-slate-50/30">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-slate-750 animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="space-y-2">
                                  <h5 className="font-extrabold uppercase tracking-wider text-[10px] text-slate-400">
                                    {language === 'te' ? 'లావాదేవీ వివరాలు / వస్తువులు' : 'Transaction Notes & Details'}
                                  </h5>
                                  <div className="bg-white p-3 border border-gray-150 rounded-xl shadow-2xs min-h-[5rem] flex flex-col justify-between whitespace-normal break-words">
                                    <p className="text-slate-800 leading-relaxed font-semibold">
                                      {tx.notes || <span className="text-gray-300 italic">{language === 'te' ? 'వివరాలు లేవు' : 'No description logged'}</span>}
                                    </p>
                                    <div className="mt-3 pt-2 border-t border-gray-50 flex items-center justify-between text-[10px] text-slate-400 font-bold">
                                      <span>ID: {tx.id}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <h5 className="font-extrabold uppercase tracking-wider text-[10px] text-slate-400">
                                    {language === 'te' ? 'ఆడిట్ మెటాడేటా రికార్డు' : 'Audit Metadata Records'}
                                  </h5>
                                  <div className="bg-white p-3 border border-gray-150 rounded-xl shadow-2xs space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-400 font-bold">{language === 'te' ? 'సృష్టించినది' : 'Created By'}</span>
                                      <span className="font-extrabold text-slate-800 text-right">
                                        {tx.createdByName || 'System/Merchant'} 
                                        <span className="block font-mono text-[8px] text-slate-400 font-bold">{tx.createdByEmail || ''}</span>
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-400 font-bold">{language === 'te' ? 'చివరి సవరణ' : 'Last Updated By'}</span>
                                      <span className="font-extrabold text-slate-800 text-right">
                                        {tx.updatedByName || tx.createdByName || 'System/Merchant'} 
                                        <span className="block font-mono text-[8px] text-slate-400 font-bold">{tx.updatedByEmail || tx.createdByEmail || ''}</span>
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Customer details edit logs section */}
      <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h3 className="font-bold text-gray-905 text-xs uppercase tracking-wider flex items-center gap-2">
            <History className="w-4.5 h-4.5 text-emerald-600 font-black" />
            <span>{language === 'te' ? 'కస్టమర్ ప్రొఫైల్ మార్పుల రికార్డు చరిత్ర' : 'Customer Profile Details Change History'}</span>
          </h3>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            {language === 'te' ? 'కస్టమర్ ప్రొఫైల్ తాజా మార్పుల వివరణాత్మక లీజర్ సమాచారం సమాహారం' : 'Timeline of metadata edits performed on this customer details record'}
          </p>
        </div>

        {(() => {
          const customerLogs = auditLogs.filter(log => log.itemType === 'Customer' && log.itemId === customer.id);
          if (customerLogs.length === 0) {
            return (
              <p className="text-xs text-slate-400 font-bold italic py-4">
                {language === 'te' ? 'ప్రొఫైల్ రికార్డుకు ఎలాంటి సవరణలు జరగలేదు.' : 'No details change history is available for this customer record.'}
              </p>
            );
          }
          return (
            <div className="border border-slate-150 rounded-xl overflow-hidden divide-y divide-slate-100">
              {customerLogs.map(log => (
                <div key={log.id} className="p-4 hover:bg-slate-50/45 transition">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                    <span className="text-[10px] font-black uppercase font-mono tracking-wider bg-orange-50 text-orange-700 border border-orange-100 rounded-md px-2 py-0.5 self-start">
                      {getActionTypeLabel(log.actionType, language)}
                    </span>
                    <span className="text-[10px] text-slate-450 font-mono font-bold">
                      {new Date(log.createdAt).toLocaleString(language === 'te' ? 'te-IN' : 'en-IN')}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 leading-normal">
                    {language === 'te' ? log.detailsTe : log.details}
                  </p>
                  <div className="mt-2 text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                    <span>{language === 'te' ? 'నిర్వహించిన వారు' : 'Performed By'}:</span>
                    <span className="text-slate-700 font-extrabold">{log.performedByName}</span>
                    <span className="text-slate-400 font-mono">({log.performedByEmail})</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
      {/* Mobile Bottom Sheet Component */}
      {activeMobileBottomSheetTx && (
        <div className="fixed inset-0 z-[90] md:hidden">
          {/* Backdrop */}
          <div 
            onClick={() => {
              if (!isDeleting) {
                setActiveMobileBottomSheetTx(null);
                setConfirmDeleteId(null);
              }
            }}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
          />

          {/* Bottom Sheet Container */}
          <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white rounded-t-3xl shadow-2xl z-[100] border-t border-gray-150 overflow-hidden flex flex-col max-h-[80vh] h-[65vh] animate-in slide-in-from-bottom duration-300 ease-out">
            {/* Drag Handle Indicator */}
            <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto my-3 shrink-0" />

            {/* Header */}
            <div className="px-6 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{customer.name}</span>
              </h3>
              <button 
                onClick={() => {
                  setActiveMobileBottomSheetTx(null);
                  setConfirmDeleteId(null);
                }}
                disabled={isDeleting}
                className="p-1 rounded-full hover:bg-slate-100 transition text-slate-400 hover:text-slate-650 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrolling Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 pb-28">
              {/* Date */}
              <div className="flex justify-between items-center py-2.5 border-b border-slate-100 font-bold text-xs">
                <span className="text-slate-400">{language === 'te' ? 'తేదీ' : 'Date'}</span>
                <span className="font-mono text-slate-800">{new Date(activeMobileBottomSheetTx.createdAt).toLocaleDateString('te-IN')}</span>
              </div>

              {/* Shop Location */}
              <div className="flex justify-between items-center py-2.5 border-b border-slate-100 font-bold text-xs">
                <span className="text-slate-400">{language === 'te' ? 'దుకాణం' : 'Shop Location'}</span>
                <span className="text-slate-800">{activeMobileBottomSheetTx.shopName}</span>
              </div>

              {/* Amount Due & Status */}
              <div className="flex justify-between items-center py-2.5 border-b border-slate-100 font-bold text-xs">
                <span className="text-slate-400">{language === 'te' ? 'మొత్తం' : 'Amount Due'}</span>
                <span className="font-mono text-slate-800 font-black text-sm">
                  {activeMobileBottomSheetTx.amount < 0 ? (
                    <span className="text-blue-650">
                      - ₹{Math.abs(activeMobileBottomSheetTx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  ) : (
                    <span className={activeMobileBottomSheetTx.status === 'Unpaid' ? 'text-red-655 font-bold' : 'text-emerald-655 font-bold'}>
                      ₹{activeMobileBottomSheetTx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </span>
              </div>

              {/* Status Badge */}
              <div className="flex justify-between items-center py-2.5 border-b border-slate-100 font-bold text-xs">
                <span className="text-slate-400">{language === 'te' ? 'స్థితి' : 'Status'}</span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black leading-none uppercase ${
                  activeMobileBottomSheetTx.amount < 0
                    ? 'bg-blue-50 text-blue-700 border border-blue-100'
                    : activeMobileBottomSheetTx.status === 'Unpaid'
                      ? 'bg-red-50 text-red-700 border border-red-100'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                }`}>
                  {activeMobileBottomSheetTx.amount < 0
                    ? (language === 'te' ? 'జమ (payment)' : 'Payment')
                    : activeMobileBottomSheetTx.status === 'Unpaid'
                      ? 'Unpaid'
                      : 'Settled'}
                </span>
              </div>

              {/* Comments / Notes */}
              <div className="py-2.5 space-y-1 text-xs">
                <span className="text-slate-400 font-bold">{language === 'te' ? 'వివరాలు / నోట్స్' : 'Comments & Notes'}</span>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 text-slate-750 font-medium leading-relaxed whitespace-normal break-words">
                  {activeMobileBottomSheetTx.notes || <span className="text-slate-350 italic font-medium">{language === 'te' ? 'వివరాలు లేవు' : 'No description logged'}</span>}
                </div>
              </div>

              {/* Creator & Editor details */}
              <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 space-y-2 text-[10px] font-semibold text-slate-500">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold">{language === 'te' ? 'సృష్టించినది' : 'Created By'}</span>
                  <span className="text-slate-800 font-bold">{activeMobileBottomSheetTx.createdByName || 'System/Merchant'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold">{language === 'te' ? 'చివరి సవరణ' : 'Updated By'}</span>
                  <span className="text-slate-800 font-bold">{activeMobileBottomSheetTx.updatedByName || activeMobileBottomSheetTx.createdByName || 'System/Merchant'}</span>
                </div>
              </div>
            </div>

            {/* Anchored bottom button bar */}
            <div className="absolute bottom-0 left-0 right-0 bg-slate-50 border-t border-slate-150 p-4 pb-6 flex gap-3 z-[110]">
              {(() => {
                const sheetHasAccess = isSuperUser || shops.some(s => s.id === activeMobileBottomSheetTx.shopId);
                const isDeletingTarget = confirmDeleteId === activeMobileBottomSheetTx.id;

                if (!sheetHasAccess) {
                  return (
                    <div className="text-center w-full text-xs font-bold text-slate-400 p-2 bg-slate-100 rounded-xl border border-slate-150">
                      {t.managedByPartner}
                    </div>
                  );
                }

                if (isDeletingTarget) {
                  return (
                    <div className="flex items-center justify-between w-full bg-red-50 p-3 border border-red-100 rounded-xl">
                      <span className="text-xs font-bold text-red-750 mr-2">{t.confirmDeleteLabel}</span>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-1.5 border border-slate-200 bg-white text-slate-700 text-xs font-bold rounded-lg cursor-pointer hover:bg-slate-50"
                        >
                          {t.deleteNo}
                        </button>
                        <button
                          onClick={async () => {
                            await handleTransactionDelete(activeMobileBottomSheetTx.id);
                            setActiveMobileBottomSheetTx(null);
                            setConfirmDeleteId(null);
                          }}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-750 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
                        >
                          {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          {t.deleteYes}
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <>
                    {activeMobileBottomSheetTx.amount >= 0 && (
                      <button
                        onClick={() => {
                          setActiveMobileBottomSheetTx(null);
                          startEditTx(activeMobileBottomSheetTx);
                        }}
                        className="flex-1 py-3 px-4 bg-white border border-slate-250 hover:bg-slate-50 text-slate-700 text-xs font-extrabold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                      >
                        <FileEdit className="w-4 h-4 text-slate-450" />
                        {t.actionEdit}
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmDeleteId(activeMobileBottomSheetTx.id)}
                      className="flex-1 py-3 px-4 bg-red-50 border border-red-100 hover:bg-red-100 text-red-700 text-xs font-extrabold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                    >
                      <Trash2 className="w-4 h-4 text-red-650" />
                      {t.actionDelete}
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
