/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, Customer, Shop, LedgerUser, AuditLogEntry } from '../types';
import { useLanguage } from '../lib/translations';
import { 
  FileEdit, 
  Trash2, 
  X, 
  Loader2, 
  AlertCircle, 
  Search, 
  Filter, 
  CreditCard, 
  ArrowUpDown, 
  ExternalLink,
  ChevronDown,
  ShoppingBag,
  User,
  Info,
  History,
  Activity,
  PlusCircle,
  Edit,
  Trash,
  Settings,
  Users
} from 'lucide-react';

interface MerchantTransactionsProps {
  transactions: Transaction[];
  customers: Customer[];
  shops: Shop[];
  currentUser: LedgerUser | null;
  auditLogs: AuditLogEntry[];
  onSelectCustomer: (customer: Customer) => void;
  onUpdateTransaction: (txId: string, updates: Partial<Pick<Transaction, 'amount' | 'status' | 'notes'>>) => Promise<void>;
  onDeleteTransaction: (txId: string) => Promise<void>;
  initialSubTab?: 'ledger' | 'audit';
}

type SortField = 'date' | 'amount' | 'customer' | 'shop';
type SortOrder = 'asc' | 'desc';

export default function MerchantTransactions({
  transactions,
  customers,
  shops,
  currentUser,
  auditLogs = [],
  onSelectCustomer,
  onUpdateTransaction,
  onDeleteTransaction,
  initialSubTab = 'ledger',
}: MerchantTransactionsProps) {
  const { t, language } = useLanguage();
  
  // Navigation sub-tab
  const [subTab, setSubTab] = useState<'ledger' | 'audit'>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShopId, setSelectedShopId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Edit / Delete states
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editStatus, setEditStatus] = useState<'Paid' | 'Unpaid'>('Unpaid');
  const [editNotes, setEditNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [editHasError, setEditHasError] = useState(false);
  const [showEditLimitAlert, setShowEditLimitAlert] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [inspectingTxId, setInspectingTxId] = useState<string | null>(null);

  const [expandedTxIds, setExpandedTxIds] = useState<Record<string, boolean>>({});
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});

  const toggleTxExpand = (id: string) => {
    setExpandedTxIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const toggleLogExpand = (id: string) => {
    setExpandedLogIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const isSuperUser = currentUser?.email === 'naveenkumar31343@gmail.com' || currentUser?.email === 'akuthota.rajkumar@gmail.com';

  // Only show transactions of shops the user has access to, except for super users
  const accessibleTransactions = useMemo(() => {
    if (isSuperUser) return transactions;
    const myShopIds = new Set(shops.map(s => s.id));
    return transactions.filter(tx => myShopIds.has(tx.shopId));
  }, [transactions, shops, isSuperUser]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Pre-calculate sums for merchant-level overview
  const stats = useMemo(() => {
    let unpaidSum = 0;
    let paidSum = 0;
    
    // Filter transactions relevant to shop access
    accessibleTransactions.forEach(tx => {
      if (tx.status === 'Unpaid') {
        unpaidSum += tx.amount;
        if (tx.amount < 0) {
          paidSum += Math.abs(tx.amount);
        }
      } else {
        paidSum += tx.amount;
      }
    });

    return {
      unpaid: unpaidSum,
      paid: paidSum,
      totalCount: accessibleTransactions.length
    };
  }, [accessibleTransactions]);

  // Apply filters and sorting
  const filteredAndSortedTx = useMemo(() => {
    let result = [...accessibleTransactions];

    // 1. Shop filter
    if (selectedShopId !== 'all') {
      result = result.filter(tx => tx.shopId === selectedShopId);
    }

    // 2. Status filter
    if (selectedStatus !== 'all') {
      result = result.filter(tx => tx.status === selectedStatus);
    }

    // 3. Search query (matches customer name or notes)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(tx => 
        tx.customerName.toLowerCase().includes(q) || 
        tx.notes.toLowerCase().includes(q) ||
        tx.shopName.toLowerCase().includes(q)
      );
    }

    // 4. Sort
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'date') {
        comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else if (sortField === 'amount') {
        comparison = b.amount - a.amount;
      } else if (sortField === 'customer') {
        comparison = a.customerName.localeCompare(b.customerName);
      } else if (sortField === 'shop') {
        comparison = a.shopName.localeCompare(b.shopName);
      }

      return sortOrder === 'desc' ? comparison : -comparison;
    });

    return result;
  }, [accessibleTransactions, selectedShopId, selectedStatus, searchQuery, sortField, sortOrder]);

  // Filter and prepare audit logs
  const filteredAuditLogs = useMemo(() => {
    let result = [...auditLogs];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(log => 
        log.details.toLowerCase().includes(q) || 
        log.detailsTe.toLowerCase().includes(q) ||
        log.performedByEmail.toLowerCase().includes(q) ||
        log.performedByName.toLowerCase().includes(q) ||
        log.itemDisplayName.toLowerCase().includes(q)
      );
    }

    return result;
  }, [auditLogs, searchQuery]);

  // Edit action triggers
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

    // INR safety limit guard: ₹1,50,000 threshold
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

  const handleNavigateToCustomer = (customerId: string, customerName: string) => {
    const foundCustomer = customers.find(c => c.id === customerId);
    if (foundCustomer) {
      onSelectCustomer(foundCustomer);
    } else {
      // If customer is unlinked or deleted but tx still exists
      alert((t.custNotFoundAlert || 'Customer "{name}" was not found in the active directory.').replace('{name}', customerName));
    }
  };

  return (
    <div id="merchant-transactions-view" className="space-y-6 animate-in fade-in duration-200 text-slate-800">
      
      {/* Search limit alert modal */}
      {showEditLimitAlert && (
        <div id="tx-limit-alert-backdrop" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[95]">
          <div id="tx-limit-alert-card" className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border-l-4 border-red-500 animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-50 rounded-full text-red-600">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">{t.limitBlockedTitle || "పరిమితి ఉల్లంఘన"}</h3>
                <p className="text-sm text-gray-600 mt-2 font-medium">
                  {t.limitBlockedDesc || "సింగిల్ ఎంట్రీ పరిమితి ₹1,50,000 మించకూడదు."}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowEditLimitAlert(false)}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-semibold transition"
              >
                {t.acknowledgeBtn || "సరే"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editingTransaction && (
        <div id="tx-edit-modal-backdrop" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[75]">
          <div id="tx-edit-modal-card" className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <FileEdit className="w-5 h-5 text-emerald-600" />
                {t.modifyTxTitle || "లావాదేవీ సవరణ"}
              </h3>
              <button 
                onClick={() => setEditingTransaction(null)}
                className="text-gray-400 hover:text-gray-605 transition"
                disabled={isUpdating}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-450 mb-1">{t.dueAmountLabel || "బకాయి మొత్తం (₹) *"}</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400 font-bold text-xs">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editAmount}
                    onChange={(e) => {
                      setEditAmount(e.target.value);
                      setEditHasError(false);
                    }}
                    className={`w-full bg-slate-50 border rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-gray-900 transition-colors ${
                      editHasError ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-200'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-450 mb-1">{t.notesDetailsLabel || "లావాదేవీ వివరాలు / వస్తువులు"}</label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-800 font-medium"
                  placeholder={t.notesPlaceholder || "కొనుగోలు చేసిన వస్తువులు మరియు ఇతర వివరణలు"}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t mt-4">
                <button
                  type="button"
                  onClick={() => setEditingTransaction(null)}
                  disabled={isUpdating}
                  className="px-4 py-2 border border-gray-200 text-gray-750 bg-white rounded-lg hover:bg-gray-50 text-xs font-bold"
                >
                  {t.cancelBtn || "రద్దు చేయి"}
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  {isUpdating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t.savingChangesBtn || "సేవ్ చేయి"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            {t.merchantLedgerTitle || "సమగ్ర లావాదేవీల లెడ్జర్"}
          </h2>
          <p className="text-xs font-semibold text-slate-400 mt-1">
            {t.merchantLedgerSub || "వ్యాపారి స్థాయి వ్యూ (Merchant Level View) - మీ అన్ని దుకాణాల పరిధిలోని లావాదేవీల ప్రదర్శన"}
          </p>
        </div>

        {/* Sub-tab selection */}
        <div className="flex gap-1.5 p-1 bg-slate-100 border border-gray-200 rounded-xl">
          <button
            onClick={() => setSubTab('ledger')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-black tracking-tight transition cursor-pointer flex items-center gap-1.5 ${
              subTab === 'ledger' 
                ? 'bg-white text-emerald-800 shadow-2xs border border-gray-200' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
            {language === 'te' ? 'లావాదేవీల లెడ్జర్' : 'Transaction Ledger'}
          </button>
          <button
            onClick={() => setSubTab('audit')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-black tracking-tight transition cursor-pointer flex items-center gap-1.5 ${
              subTab === 'audit' 
                ? 'bg-white text-emerald-800 shadow-2xs border border-gray-200' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-600" />
            {language === 'te' ? 'చర్యల చరిత్ర (Audit Logs)' : 'Action History'}
          </button>
        </div>
      </div>



      {/* Filters Toolbar */}
      <div className="bg-white border border-gray-150 p-4 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Real-time search */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-400" />
            <input
              type="text"
              placeholder={subTab === 'ledger' ? (t.searchTxPlaceholder || "మర్చంట్ శోధన: కస్టమర్ పేరు, వస్తువులు, లేదా దుకాణం వెతకండి...") : (language === 'te' ? 'శోధించండి: ఎడిటర్ పేరు, కస్టమర్, మరియు దుకాణ వివరాలు...' : "Audit search: Search editor name, item details, or description...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-gray-150 rounded-xl pl-10 pr-4 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none font-semibold text-slate-800"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3.5 text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {t.clearBtn || "తుడిచివేయి"}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {subTab === 'ledger' && (
              <>
                {/* Shop selectors */}
                <div className="flex items-center gap-1 bg-slate-50 border border-gray-150 rounded-xl px-2.5 py-1.5 text-xs">
                  <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                  <select
                    value={selectedShopId}
                    onChange={(e) => setSelectedShopId(e.target.value)}
                    className="bg-transparent border-none outline-none text-slate-700 font-bold text-xs max-w-[140px] truncate"
                  >
                    <option value="all">{t.allShopsOption || "అన్ని దుకాణాలు"}</option>
                    {shops.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Status selectors */}
                <div className="flex items-center gap-1 bg-slate-50 border border-gray-150 rounded-xl px-2.5 py-1.5 text-xs">
                  <Filter className="w-3.5 h-3.5 text-emerald-605" />
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="bg-transparent border-none outline-none text-slate-705 font-bold text-xs"
                  >
                    <option value="all">{t.allTxTypesOption || "అన్ని రకాలు"}</option>
                    <option value="Unpaid">{t.optionUnpaidOnly || "Unpaid (బాకీ ఉన్నవి)"}</option>
                    <option value="Paid">{t.optionPaidOnly || "Settled (చెల్లించబడినవి)"}</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {subTab === 'ledger' ? (
        /* Main ledger table */
        <div id="ledger-grid-view" className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-end">
            <span className="text-xs font-mono font-bold bg-gray-50 border border-gray-150 text-slate-500 px-3 py-1 rounded-md">
              {filteredAndSortedTx.length} {t.recordSuffix || "వసూళ్ళు భద్రపరిచాము"}
            </span>
          </div>

          {filteredAndSortedTx.length === 0 ? (
            <div className="text-center py-16 p-8">
              <Info className="w-9 h-9 text-slate-300 mx-auto mb-3" />
              <h4 className="font-bold text-slate-800">{t.noTxFoundTitle || "ఎలాంటి లావాదేవీ రికార్డులు కనుగొనబడలేదు"}</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {t.noTxFoundDesc || "శోధనకు సరిపోయే రికార్డులు ఏవీ లేవు. దయచేసి శోధన పదాలను సవరించండి."}
              </p>
            </div>
          ) : (
            <>
              {/* MOBILE COMPACT LIST - Prevents horizontal overflow completely */}
              <div className="block md:hidden divide-y divide-gray-150/60 max-w-full overflow-hidden">
                {filteredAndSortedTx.map(tx => {
                  const isUnpaid = tx.status === 'Unpaid';
                  const isDeletingTarget = confirmDeleteId === tx.id;
                  const isExpanded = !!expandedTxIds[tx.id];
                  const hasAccessToShop = isSuperUser || shops.some(s => s.id === tx.shopId);

                  return (
                    <div key={tx.id} id={`mobile-tx-card-${tx.id}`} className="p-4 space-y-3.5 hover:bg-slate-50/20 transition-colors">
                      {/* Customer name and Date */}
                      <div className="flex items-center justify-between gap-3">
                        <button
                          onClick={() => handleNavigateToCustomer(tx.customerId, tx.customerName)}
                          className="font-extrabold text-blue-650 hover:text-blue-805 hover:underline text-xs flex items-center gap-1.5 cursor-pointer max-w-[65%] truncate text-left"
                          title={t.customerProfileTip || "కస్టమర్ ప్రొఫైల్"}
                        >
                          <User className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="truncate">{tx.customerName}</span>
                        </button>
                        <span className="font-mono text-[9px] text-gray-500 shrink-0 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded font-black uppercase">
                          {new Date(tx.createdAt).toLocaleDateString(language === 'te' ? 'te-IN' : 'en-IN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                          })}
                        </span>
                      </div>

                      {/* Shop Name & Amount */}
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

                      {/* Status / Toggle and Actions row */}
                      <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-dashed border-gray-100">
                        <div className="flex items-center gap-1.5">
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
                          <button
                            onClick={() => toggleTxExpand(tx.id)}
                            className="p-1 px-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all cursor-pointer inline-flex items-center justify-center"
                            title={language === 'te' ? 'వివరాలు' : 'Details'}
                          >
                            <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          {!hasAccessToShop ? (
                            <span className="text-[9px] text-slate-400 font-bold bg-slate-50 border border-gray-150 px-2 py-0.5 rounded">
                              {t.managedByPartner || "భాగస్వామి పరిధిలో ఉంది"}
                            </span>
                          ) : isDeletingTarget ? (
                            <div className="inline-flex items-center gap-1 animate-in fade-in slide-in-from-right-1 duration-150">
                              <span className="text-[9px] font-black text-red-700 select-none mr-0.5 shrink-0">{t.confirmDeleteLabel || "తొలగించాలా?"}</span>
                              <button
                                disabled={isDeleting}
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-1.5 py-0.5 border border-gray-200 hover:bg-gray-50 text-gray-600 text-[9px] font-bold rounded cursor-pointer shrink-0"
                              >
                                {t.deleteNo || "రద్దు"}
                              </button>
                              <button
                                disabled={isDeleting}
                                onClick={() => handleTransactionDelete(tx.id)}
                                className="px-1.5 py-0.5 bg-red-650 hover:bg-red-750 text-white text-[9px] font-bold rounded flex items-center gap-0.5 cursor-pointer shrink-0"
                              >
                                {isDeleting && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                                {t.deleteYes || "అవును"}
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex gap-1">
                              <button
                                onClick={() => setInspectingTxId(tx.id)}
                                className="p-1 px-1.5 border border-slate-205 bg-slate-50 hover:bg-slate-100 text-slate-750 rounded text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                                title={language === 'te' ? 'చరిత్ర చరిత్ర' : 'History'}
                              >
                                <History className="w-3 h-3 text-slate-500" />
                              </button>
                              {tx.amount >= 0 && (
                                <button
                                  onClick={() => startEditTx(tx)}
                                  className="p-1 px-1.5 border border-gray-250 bg-white hover:bg-slate-50 text-gray-700 rounded text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                                >
                                  <FileEdit className="w-3 h-3 text-gray-400" />
                                </button>
                              )}
                              <button
                                onClick={() => setConfirmDeleteId(tx.id)}
                                className="p-1 px-1.5 border border-red-100 bg-red-50 hover:bg-red-100 text-red-700 rounded text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3 text-red-650" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Expandable region on Mobile */}
                      {isExpanded && (
                        <div className="mt-2.5 p-3.5 bg-slate-50/60 border border-slate-150 rounded-xl space-y-3.5 text-[11px] animate-in slide-in-from-top-1.5 duration-200">
                          <div className="space-y-1">
                            <span className="font-extrabold uppercase tracking-wider text-[9px] text-slate-400">
                              {language === 'te' ? 'లావాదేవీ వివరాలు / వస్తువులు' : 'Transaction Notes & Details'}
                            </span>
                            <div className="bg-white p-2.5 border border-gray-150 rounded-lg whitespace-normal break-words min-h-[4rem] flex flex-col justify-between">
                              <p className="text-slate-800 leading-relaxed font-semibold">
                                {tx.notes || <span className="text-gray-300 italic">{language === 'te' ? 'వివరాలు లేవు' : 'No description logged'}</span>}
                              </p>
                              <div className="mt-2.5 pt-2 border-t border-gray-50 flex items-center justify-between text-[9px] text-slate-400">
                                <span>ID: {tx.id}</span>
                                <button 
                                  onClick={() => setInspectingTxId(tx.id)}
                                  className="text-blue-650 hover:underline cursor-pointer font-extrabold inline-flex items-center gap-0.5"
                                >
                                  <History className="w-2.5 h-2.5" />
                                  {language === 'te' ? 'పూర్తి చరిత్ర' : 'Audit Log'}
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="font-extrabold uppercase tracking-wider text-[9px] text-slate-400">
                              {language === 'te' ? 'ఆడిట్ మెటాడేటా రికార్డు' : 'Audit Metadata Records'}
                            </span>
                            <div className="bg-white p-2.5 border border-gray-150 rounded-lg space-y-2">
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
                      )}
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP VIEW - Only rendered on md screens and wider */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-[10px] uppercase font-black text-gray-400 select-none">
                      <th className="px-4 py-3.5 w-12 text-center"></th>
                      <th className="px-6 py-3.5 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('date')}>
                        <div className="flex items-center gap-1">
                          {t.colDate || "తేదీ (Date)"}
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="px-6 py-3.5 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('customer')}>
                        <div className="flex items-center gap-1">
                          {t.colCustomer || "కస్టమర్ (Customer)"}
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="px-6 py-3.5 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('shop')}>
                        <div className="flex items-center gap-1">
                          {t.colShop || "దుకాణం (Shop)"}
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="px-6 py-3.5 cursor-pointer hover:bg-gray-100 transition-colors text-right" onClick={() => handleSort('amount')}>
                        <div className="flex items-center justify-end gap-1">
                          {t.colAmount || "మొత్తం (Amount)"}
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="px-6 py-3.5 text-center">{t.colStatus || "స్థితి (Status)"}</th>
                      <th className="px-6 py-3.5 text-right">{t.colActions || "చర్యలు (Actions)"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs font-semibold">
                    {filteredAndSortedTx.map(tx => {
                      const isUnpaid = tx.status === 'Unpaid';
                      const isDeletingTarget = confirmDeleteId === tx.id;
                      const isExpanded = !!expandedTxIds[tx.id];
                      const hasAccessToShop = isSuperUser || shops.some(s => s.id === tx.shopId);

                      return (
                        <React.Fragment key={tx.id}>
                          <tr id={`merchant-tx-row-${tx.id}`} className="hover:bg-slate-50/40 transition-colors border-b border-gray-50/60">
                            <td className="px-4 py-4 text-center whitespace-nowrap">
                              <button
                                onClick={() => toggleTxExpand(tx.id)}
                                className="p-1 hover:bg-slate-100 rounded-lg transition-all cursor-pointer inline-flex items-center justify-center"
                                title={language === 'te' ? 'వివరాలు చూడటానికి క్లిక్ చేయండి' : 'Click to toggle details'}
                              >
                                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                              </button>
                            </td>
                            <td className="px-6 py-4 font-mono text-gray-500 whitespace-nowrap cursor-pointer" onClick={() => toggleTxExpand(tx.id)}>
                              {new Date(tx.createdAt).toLocaleDateString(language === 'te' ? 'te-IN' : 'en-IN', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit'
                              })}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button
                                onClick={() => handleNavigateToCustomer(tx.customerId, tx.customerName)}
                                className="font-extrabold text-blue-650 hover:text-blue-805 hover:underline transition-all flex items-center gap-1 text-left cursor-pointer"
                                title={t.customerProfileTip || "కస్టమర్ ప్రొఫైల్ లోపలికి వెళ్ళండి"}
                              >
                                <User className="w-3.5 h-3.5 text-blue-500" />
                                {tx.customerName}
                                <ExternalLink className="w-2.5 h-2.5 text-slate-350 opacity-0 group-hover:opacity-100 inline.block" />
                              </button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-slate-700 cursor-pointer" onClick={() => toggleTxExpand(tx.id)}>
                              <div className="font-extrabold flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-350"></span>
                                {tx.shopName}
                              </div>
                            </td>
                            <td className="px-6 py-4 font-mono font-extrabold text-right whitespace-nowrap cursor-pointer" onClick={() => toggleTxExpand(tx.id)}>
                              {tx.amount < 0 ? (
                                <span className="text-blue-650">
                                  - ₹{Math.abs(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <span className={isUnpaid ? 'text-red-655' : 'text-emerald-655'}>
                                  ₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center whitespace-nowrap cursor-pointer" onClick={() => toggleTxExpand(tx.id)}>
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black leading-none uppercase ${
                                tx.amount < 0
                                  ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                  : isUnpaid
                                    ? 'bg-red-50 text-red-700 border border-red-100'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              }`}>
                                {tx.amount < 0
                                  ? (language === 'te' ? 'జమ (payment)' : 'Payment')
                                  : isUnpaid
                                    ? 'Unpaid'
                                    : 'Settled'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              {!hasAccessToShop ? (
                                <span className="text-[10px] text-slate-400 font-bold bg-slate-50 border border-gray-150 px-2 py-1 rounded">
                                  {t.managedByPartner || "భాగస్వామి పరిధిలో ఉంది"}
                                </span>
                              ) : isDeletingTarget ? (
                                <div className="inline-flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2 duration-150">
                                  <span className="text-[10px] font-bold text-red-700 select-none mr-1">{t.confirmDeleteLabel || "తొలగించాలా?"}</span>
                                  <button
                                    disabled={isDeleting}
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-2 py-0.5 border border-gray-200 hover:bg-gray-50 text-gray-600 text-[10px] font-bold rounded cursor-pointer animate-none"
                                  >
                                    {t.deleteNo || "రద్దు"}
                                  </button>
                                  <button
                                    disabled={isDeleting}
                                    onClick={() => handleTransactionDelete(tx.id)}
                                    className="px-2 py-0.5 bg-red-650 hover:bg-red-750 text-white text-[10px] font-bold rounded flex items-center gap-1 cursor-pointer animate-none"
                                  >
                                    {isDeleting && <Loader2 className="w-3 h-3 animate-spin" />}
                                    {t.deleteYes || "అవును"}
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-flex gap-1.5 font-bold">
                                  <button
                                    onClick={() => setInspectingTxId(tx.id)}
                                    className="p-1 px-2 border border-slate-205 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                    title={language === 'te' ? 'లావాదేవీ మార్పుల చరిత్రను చూపించు' : 'Click to see details change history of this transaction'}
                                  >
                                    <History className="w-3.5 h-3.5 text-slate-500" />
                                    {language === 'te' ? 'చరిత్ర' : 'History'}
                                  </button>
                                  {tx.amount >= 0 && (
                                    <button
                                      onClick={() => startEditTx(tx)}
                                      className="p-1 px-2 border border-gray-250 bg-white hover:bg-slate-50 text-gray-700 rounded text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                    >
                                      <FileEdit className="w-3.5 h-3.5 text-gray-400" />
                                      {t.actionEdit || "సవరించు"}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setConfirmDeleteId(tx.id)}
                                    className="p-1 px-2 border border-red-100 bg-red-50 hover:bg-red-100 text-red-750 rounded text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-red-650" />
                                    {t.actionDelete || "తొలగించు"}
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr key={`expanded-${tx.id}`} className="bg-slate-50/45">
                              <td colSpan={7} className="px-6 py-4 border-t border-gray-100/80 bg-slate-50/30">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-slate-700 animate-in fade-in slide-in-from-top-1 duration-200">
                                  <div className="space-y-2">
                                    <h5 className="font-extrabold uppercase tracking-wider text-[10px] text-slate-400 block mb-1">
                                      {language === 'te' ? 'లావాదేవీ వివరాలు / వస్తువులు' : 'Transaction Notes & Details'}
                                    </h5>
                                    <div className="bg-white p-3 border border-gray-150 rounded-xl whitespace-normal break-words shadow-2xs min-h-[5rem] flex flex-col justify-between">
                                      <p className="text-slate-800 leading-relaxed font-medium">
                                        {tx.notes || <span className="text-gray-300 italic">{language === 'te' ? 'వివరాలు లేవు' : 'No description logged'}</span>}
                                      </p>
                                      <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between text-[10px] text-slate-400">
                                        <span>ID: {tx.id}</span>
                                        <button 
                                          onClick={() => setInspectingTxId(tx.id)}
                                          className="text-blue-650 hover:underline cursor-pointer font-bold inline-flex items-center gap-1"
                                        >
                                          <History className="w-3 h-3" />
                                          {language === 'te' ? 'వివరణాత్మక మార్పుల చరిత్ర' : 'Detailed Audit Log'}
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <h5 className="font-extrabold uppercase tracking-wider text-[10px] text-slate-400 block mb-1">
                                      {language === 'te' ? 'ఆడిట్ మెటాడేటా రికార్డు' : 'Audit Metadata Records'}
                                    </h5>
                                    <div className="bg-white p-3 border border-gray-150 rounded-xl space-y-2.5 shadow-2xs">
                                      <div className="flex items-center justify-between pb-1.5 border-b border-gray-50 last:border-0 last:pb-0">
                                        <span className="text-slate-400">{language === 'te' ? 'సృష్టించినది' : 'Created By'}</span>
                                        <span className="font-extrabold text-slate-800 text-right">
                                          {tx.createdByName || 'System/Merchant'} 
                                          <span className="block font-mono text-[9px] text-slate-400 font-bold">{tx.createdByEmail || ''}</span>
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between pb-1.5 border-b border-gray-50 last:border-0 last:pb-0">
                                        <span className="text-slate-400">{language === 'te' ? 'చివరి సవరణ' : 'Last Updated By'}</span>
                                        <span className="font-extrabold text-slate-800 text-right">
                                          {tx.updatedByName || tx.createdByName || 'System/Merchant'} 
                                          <span className="block font-mono text-[9px] text-slate-400 font-bold">{tx.updatedByEmail || tx.createdByEmail || ''}</span>
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
            </>
          )}
        </div>
      ) : (
        /* AUDIT FEED VIEW */
        <div id="audit-log-view" className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-xs animate-in fade-in duration-250">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-450 uppercase tracking-wider text-slate-500">
              {language === 'te' ? 'నిర్వహణ రికార్డు చరిత్ర' : 'Action History Log records'}
            </span>
            <span className="text-xs font-mono font-bold bg-gray-50 border border-gray-150 text-slate-500 px-3 py-1 rounded-md">
              {filteredAuditLogs.length} {language === 'te' ? 'చర్యలు లోడ్ చేయబడ్డాయి' : 'action logs loaded'}
            </span>
          </div>

          {filteredAuditLogs.length === 0 ? (
            <div className="text-center py-16 p-8">
              <Activity className="w-9 h-9 text-slate-300 mx-auto mb-3" />
              <h4 className="font-bold text-slate-800">
                {language === 'te' ? 'ఎలాంటి రికార్డులు కనుగొనబడలేదు' : 'No Action Log History Records Found'}
              </h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {language === 'te' ? 'ఇంకా ఎలాంటి చర్యలు నమోదు కాలేదు.' : 'No audit trail entries are available matching the current search query.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-[10px] uppercase font-black text-gray-400 select-none font-sans">
                    <th className="px-4 py-3.5 w-12 text-center"></th>
                    <th className="px-6 py-3.5">{language === 'te' ? 'తేదీ (Date)' : 'Date'}</th>
                    <th className="px-6 py-3.5">{language === 'te' ? 'చర్య (Action)' : 'Action'}</th>
                    <th className="px-6 py-3.5">{language === 'te' ? 'లక్ష్య వస్తువు (Item)' : 'Target Item'}</th>
                    <th className="px-6 py-3.5">{language === 'te' ? 'నిర్వహించిన వారు (Author)' : 'Performed By'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs font-semibold">
                  {filteredAuditLogs.map(log => {
                    let badgeColor = "bg-blue-50 text-blue-700 border-blue-100";
                    let actionIcon = <Settings className="w-3.5 h-3.5 text-blue-600" />;
                    if (log.actionType.startsWith('CREATE')) {
                      badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
                      actionIcon = <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />;
                    } else if (log.actionType.startsWith('UPDATE')) {
                      badgeColor = "bg-amber-50 text-amber-700 border-amber-100";
                      actionIcon = <FileEdit className="w-3.5 h-3.5 text-amber-600" />;
                    } else if (log.actionType.startsWith('DELETE')) {
                      badgeColor = "bg-red-50 text-red-700 border-red-100";
                      actionIcon = <Trash2 className="w-3.5 h-3.5 text-red-650" />;
                    } else if (log.actionType === 'COLLABORATOR_CHANGE') {
                      badgeColor = "bg-indigo-50 text-indigo-700 border-indigo-100";
                      actionIcon = <Users className="w-3.5 h-3.5 text-indigo-650" />;
                    }

                    const isExpanded = !!expandedLogIds[log.id];

                    return (
                      <React.Fragment key={log.id}>
                        <tr id={`audit-log-row-${log.id}`} className="hover:bg-slate-50/40 transition-colors border-b border-gray-50/60">
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => toggleLogExpand(log.id)}
                              className="p-1 hover:bg-slate-100 rounded-lg transition-all cursor-pointer inline-flex items-center justify-center"
                              title={language === 'te' ? 'చర్య వివరణను చూడటానికి క్లిక్ చేయండి' : 'Click to see action explanation'}
                            >
                              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          </td>
                          <td className="px-6 py-4 font-mono text-gray-500 whitespace-nowrap cursor-pointer" onClick={() => toggleLogExpand(log.id)}>
                            {new Date(log.createdAt).toLocaleString(language === 'te' ? 'te-IN' : 'en-IN', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap cursor-pointer" onClick={() => toggleLogExpand(log.id)}>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase ${badgeColor}`}>
                              {actionIcon}
                              <span>{log.actionType}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-slate-800 cursor-pointer" onClick={() => toggleLogExpand(log.id)}>
                            <div className="font-extrabold flex items-center gap-1.5">
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-50 border border-slate-150 px-1.5 py-0.5 rounded font-black uppercase">
                                {log.itemType}
                              </span>
                              <span>{log.itemDisplayName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-800 whitespace-nowrap cursor-pointer" onClick={() => toggleLogExpand(log.id)}>
                            <div className="font-extrabold">{log.performedByName}</div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr key={`expanded-${log.id}`} className="bg-slate-50/45">
                            <td colSpan={5} className="px-6 py-4 border-t border-gray-100/80 bg-slate-50/30">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-slate-700 animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="space-y-2">
                                  <h5 className="font-extrabold uppercase tracking-wider text-[10px] text-slate-400 block mb-1">
                                    {language === 'te' ? 'చర్య వివరణ వివరాలు' : 'Action Details'}
                                  </h5>
                                  <div className="bg-white p-3 border border-gray-150 rounded-xl shadow-2xs">
                                    <p className="text-slate-800 leading-relaxed font-semibold whitespace-normal break-words">
                                      {language === 'te' ? log.detailsTe : log.details}
                                    </p>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <h5 className="font-extrabold uppercase tracking-wider text-[10px] text-slate-400 block mb-1">
                                    {language === 'te' ? 'నిర్వహించిన వ్యక్తి వివరాలు' : 'Performed By Details'}
                                  </h5>
                                  <div className="bg-white p-3 border border-gray-150 rounded-xl space-y-2 shadow-2xs font-bold">
                                    <div className="flex items-center justify-between pb-1 text-slate-700">
                                      <span className="text-slate-400">{language === 'te' ? 'పేరు' : 'Name'}</span>
                                      <span>{log.performedByName}</span>
                                    </div>
                                    <div className="flex items-center justify-between pb-1 text-slate-705">
                                      <span className="text-slate-400">{language === 'te' ? 'ఇమెయిల్' : 'Email'}</span>
                                      <span className="font-mono">{log.performedByEmail}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-slate-705">
                                      <span className="text-slate-400">UID</span>
                                      <span className="font-mono text-[10px] text-slate-400">{log.performedByUid || 'system'}</span>
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
          )}
        </div>
      )}

      {/* TRANSACTION CHANGE HISTORY AUDIT MODAL overlay */}
      {inspectingTxId && (() => {
        const txLogs = auditLogs.filter(log => log.itemType === 'Transaction' && log.itemId === inspectingTxId);
        const relativeTx = accessibleTransactions.find(t => t.id === inspectingTxId);
        return (
          <div id="tx-history-modal-backdrop" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[90] animate-in fade-in duration-200">
            <div id="tx-history-modal-card" className="bg-white rounded-3xl shadow-xl max-w-2xl w-full p-6 border border-gray-150 animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between border-b pb-3 mb-4 shrink-0">
                <div>
                  <h3 className="font-bold text-slate-905 text-base flex items-center gap-2">
                    <History className="w-5 h-5 text-emerald-600" />
                    <span>{language === 'te' ? 'లావాదేవీ మార్పుల చరిత్ర రికార్డు' : 'Transaction Audit Logs History'}</span>
                  </h3>
                  <p className="text-xs font-semibold text-slate-400 mt-1">
                    {relativeTx ? `${relativeTx.customerName} - ${relativeTx.shopName} (₹${relativeTx.amount})` : `Transaction ID: ${inspectingTxId}`}
                  </p>
                </div>
                <button 
                  onClick={() => setInspectingTxId(null)}
                  className="text-gray-400 hover:text-gray-600 transition p-1 cursor-pointer bg-slate-50 hover:bg-slate-100 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {txLogs.length === 0 ? (
                  <div className="text-center py-12 p-6">
                    <Activity className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <h4 className="font-bold text-slate-700">{language === 'te' ? 'మార్పు రికార్డులు ఏవీ లేవు' : 'No Modification Logs Available'}</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      {language === 'te' ? 'ఈ లావాదేవీ కొరకు ఎలాంటి మార్పు రికార్డులు లభించలేదు.' : 'No audit entries were recorded for this transaction details so far.'}
                    </p>
                  </div>
                ) : (
                  <div className="border border-slate-150 rounded-xl overflow-hidden divide-y divide-slate-100">
                    {txLogs.map(log => {
                      let badge = "bg-blue-50 text-blue-700 border-blue-100";
                      if (log.actionType.startsWith('CREATE')) badge = "bg-emerald-50 text-emerald-700 border-emerald-100";
                      else if (log.actionType.startsWith('UPDATE')) badge = "bg-amber-50 text-amber-700 border-amber-100";
                      else if (log.actionType.startsWith('DELETE')) badge = "bg-red-50 text-red-700 border-red-100";

                      return (
                        <div key={log.id} className="p-4 hover:bg-slate-50/45 transition">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                            <span className={`text-[10px] font-black uppercase font-mono tracking-wider border rounded-md px-2 py-0.5 ${badge}`}>
                              {log.actionType}
                            </span>
                            <span className="text-[10px] text-slate-450 font-mono font-bold">
                              {new Date(log.createdAt).toLocaleString(language === 'te' ? 'te-IN' : 'en-IN')}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-slate-850 leading-normal">
                            {language === 'te' ? log.detailsTe : log.details}
                          </p>
                          <div className="mt-2 text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                            <span>{language === 'te' ? 'నిర్వహించిన వారు' : 'Performed By'}:</span>
                            <span className="text-slate-705 font-extrabold">{log.performedByName}</span>
                            <span className="text-slate-400 font-mono">({log.performedByEmail})</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-3 border-t mt-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setInspectingTxId(null)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-850 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  {language === 'te' ? 'మూసివేయి' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
