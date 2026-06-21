/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Customer, Transaction, Shop, LedgerUser, AuditLogEntry } from '../types';
import { useLanguage } from '../lib/translations';
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
  BadgeDollarSign,
  User,
  Edit2,
  History,
  Activity
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

      {/* Dynamic Add Debt Modal */}
      {showAddModal && (
        <div id="add-tx-modal-backdrop" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[75]">
          <div id="add-tx-modal-card" className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="font-bold text-gray-905 text-base flex items-center gap-2">
                <BadgeDollarSign className="w-5 h-5 text-emerald-600" />
                {t.logDebtFor}: {customer.name}
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-5 h-5" />
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
                <label className="block text-xs font-bold text-gray-400 mb-1">{t.ledgerRecordStatus}</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'Paid' | 'Unpaid')}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-gray-800"
                >
                  <option value="Unpaid">{t.statusUnpaid}</option>
                  <option value="Paid">{t.statusPaid}</option>
                </select>
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
            <BadgeDollarSign className="w-5 h-5 text-emerald-600" />
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
                <div className="flex items-center justify-between gap-2.5">
                  <span className="font-extrabold text-slate-800 text-sm truncate" title={item.shopName}>
                    {item.shopName}
                  </span>
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                    item.isMyShop 
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                      : 'bg-amber-100 text-amber-800 border border-amber-100'
                  }`}>
                    {item.isMyShop ? (language === 'te' ? 'మీ దుకాణం' : 'My Shop') : (language === 'te' ? 'ఇతర దుకాణం' : 'Other Shop')}
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
          <span className="text-xs font-mono font-bold bg-gray-55  text-gray-500 px-2.5 py-1 rounded border border-gray-100">
            {customerTx.length} {t.entriesFoundLabel}
          </span>
        </div>

        {customerTx.length === 0 ? (
          <div className="text-center py-16 p-8">
            <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <h4 className="font-bold text-gray-800">{t.noHistoryTitle}</h4>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto leading-relaxed">
              {t.noHistoryDesc}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-[10px] uppercase font-extrabold text-gray-400">
                  <th className="px-6 py-3.5">{t.tableHeaderDate}</th>
                  <th className="px-6 py-3.5">{t.tableHeaderShop}</th>
                  <th className="px-6 py-3.5">{t.tableHeaderNotes}</th>
                  <th className="px-6 py-3.5">{t.tableHeaderAmount}</th>
                  <th className="px-6 py-3.5">{t.tableHeaderStatus}</th>
                  <th className="px-6 py-3.5 text-right">{t.tableHeaderActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-semibold">
                {customerTx.map(tx => {
                  const isUnpaid = tx.status === 'Unpaid';
                  const isDeletingTarget = confirmDeleteId === tx.id;
                  
                  // Permitted: Super user has access to everything. General owner checks shops.
                  const hasAccessToShop = isSuperUser || shops.some(s => s.id === tx.shopId);

                  return (
                    <tr id={`tx-row-${tx.id}`} key={tx.id} className="hover:bg-gray-55/40 transition-colors">
                      <td className="px-6 py-4 font-mono text-gray-500 whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleDateString('te-IN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-extrabold text-gray-800 flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${hasAccessToShop ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
                          {tx.shopName}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 max-w-xs font-medium">
                        <div className="truncate mb-1.5" title={tx.notes}>
                          {tx.notes || <span className="text-gray-300 italic font-medium">{language === 'te' ? 'వివరాలు లేవు' : 'No details'}</span>}
                        </div>
                        <div className="text-[10px] text-slate-450 font-medium space-y-1 bg-slate-50/50 p-1.5 border border-slate-100 rounded-lg font-sans">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block w-1 h-1 rounded-full bg-emerald-500"></span>
                            <span className="font-bold text-slate-500">{language === 'te' ? 'సృష్టించినది' : 'Created By'}:</span> 
                            <span className="truncate max-w-[140px]" title={`${tx.createdByName || 'System'} (${tx.createdByEmail || ''})`}>
                              {tx.createdByName || 'System/Merchant'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block w-1 h-1 rounded-full bg-amber-500"></span>
                            <span className="font-bold text-slate-500">{language === 'te' ? 'సవరించినది' : 'Last Updated By'}:</span> 
                            <span className="truncate max-w-[140px]" title={`${tx.updatedByName || 'System'} (${tx.updatedByEmail || ''})`}>
                              {tx.updatedByName || 'System/Merchant'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono font-extrabold whitespace-nowrap">
                        {tx.amount < 0 ? (
                          <span className="text-blue-650">
                            - ₹{Math.abs(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className={isUnpaid ? 'text-red-650' : 'text-emerald-650'}>
                            ₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
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
                              className="px-2 py-1 border border-gray-200 hover:bg-gray-50 text-gray-650 text-[10px] font-bold rounded cursor-pointer"
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
                            <button
                              id={`edit-tx-btn-${tx.id}`}
                              onClick={() => startEditTx(tx)}
                              className="p-1 px-2 border border-gray-250 bg-white hover:bg-gray-50 text-gray-700 rounded text-[11px] font-bold hover:border-emerald-500/30 transition flex items-center gap-1 cursor-pointer"
                            >
                              <FileEdit className="w-3.5 h-3.5 text-gray-400" />
                              {t.actionEdit}
                            </button>
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
                  );
                })}
              </tbody>
            </table>
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
                      {log.actionType}
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
    </div>
  );
}
