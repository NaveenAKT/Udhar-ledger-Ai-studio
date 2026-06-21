/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { getStore, generateId } from './lib/ledgerStore';
import { auth, isFirebaseActive, signInWithPopup, GoogleAuthProvider, signOut } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Customer, Shop, Transaction, MonthlyLog, LedgerUser, AuditLogEntry } from './types';
import { useLanguage } from './lib/translations';
import CustomerDirectory from './components/CustomerDirectory';
import ShopRegistry from './components/ShopRegistry';
import CustomerProfile from './components/CustomerProfile';
import BackgroundAutomation from './components/BackgroundAutomation';
import MerchantTransactions from './components/MerchantTransactions';
import { 
  UserCheck, 
  Store, 
  Cpu, 
  Loader2, 
  LogOut, 
  ShieldCheck, 
  BookOpenCheck,
  CheckCircle,
  X,
  Trash2,
  CreditCard,
  Languages,
  History
} from 'lucide-react';

export default function App() {
  const { t, language, toggleLanguage } = useLanguage();

  // Authentication states
  const [user, setUser] = useState<LedgerUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Layout navigation states
  const [activeTab, setActiveTab] = useState<'customers' | 'shops' | 'transactions' | 'audit'>('customers');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  // Dialog / Modal toggles
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);

  // Core records state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [monthlyLogs, setMonthlyLogs] = useState<MonthlyLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  // Customer Form states
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custVillage, setCustVillage] = useState('');
  const [custMandal, setCustMandal] = useState('');
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);

  // Initialize Auth Sync (Active Firebase Auth or local memory auth loader)
  useEffect(() => {
    if (isFirebaseActive && auth) {
      const unsub = onAuthStateChanged(auth, (fbUser) => {
        if (fbUser) {
          const u: LedgerUser = {
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName,
            photoURL: fbUser.photoURL
          };
          setUser(u);
          // Run saveMerchant in the background without blocking the auth/loading screen
          const store = getStore(fbUser.uid, fbUser.email || undefined);
          store.saveMerchant({
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName,
            photoURL: fbUser.photoURL,
            createdAt: new Date().toISOString()
          }).catch((e) => {
            console.error("Failed to register merchant profile in background: ", e);
          });
        } else {
          setUser(null);
        }
        setAuthLoading(false);
      });
      return () => unsub();
    } else {
      // Offline fallback: reload previous session from localstorage if available
      const savedUser = localStorage.getItem('udhar_ledger_auth_user');
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch {
          setUser(null);
        }
      }
      setAuthLoading(false);
    }
  }, []);

  // Sync state data on user sign-in or transaction triggers
  const loadLedgerData = async (userId: string, userEmail?: string | null) => {
    if (!userId) return;
    setDataLoading(true);
    try {
      const store = getStore(userId, userEmail || undefined);
      const shopList = await store.getShops(userEmail || undefined);
      const associatedShopIds = shopList.map(s => s.id);

      const [customerList, txList, logList, auditLogList] = await Promise.all([
        store.getCustomers(associatedShopIds),
        store.getTransactions(associatedShopIds),
        store.getMonthlyLogs(),
        store.getAuditLogs()
      ]);
      
      setShops(shopList);
      setCustomers(customerList);
      setTransactions(txList);
      setMonthlyLogs(logList);
      setAuditLogs(auditLogList || []);
    } catch (err) {
      console.error("Error loading ledger data: ", err);
    } finally {
      setDataLoading(false);
    }
  };

  // Re-run data fetches when user logs in or switches
  useEffect(() => {
    if (user) {
      loadLedgerData(user.uid, user.email);
      // Reset navigation state when switches
      setSelectedCustomer(null);
    } else {
      setShops([]);
      setCustomers([]);
      setTransactions([]);
      setMonthlyLogs([]);
      setAuditLogs([]);
    }
  }, [user]);

  // Handle actual Google Auth Actions
  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Google Popup Auth Error: ", err);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("SignOut Exception: ", err);
    }
  };

  // Mutator actions
  const handleAddNewCustomer = async (e: React.FormEvent) => {
    if (!user || !custName.trim() || !custPhone.trim()) return;

    setIsAddingCustomer(true);
    try {
      const store = getStore(user.uid, user.email || undefined);
      const generatedIdVal = generateId();
      
      // Parallelize customer creation and audit log creation for faster writes
      await Promise.all([
        store.addCustomer({
          id: generatedIdVal,
          name: custName.trim(),
          phone: custPhone.trim(),
          email: custEmail.trim(),
          village: custVillage.trim(),
          mandal: custMandal.trim(),
        }),
        store.addAuditLog({
          actionType: 'CREATE_CUSTOMER',
          itemType: 'Customer',
          itemId: generatedIdVal,
          itemDisplayName: custName.trim(),
          details: `Created customer "${custName.trim()}" with phone ${custPhone.trim()}`,
          detailsTe: `కస్టమర్ "${custName.trim()}" (ఫోన్: ${custPhone.trim()}) సృష్టించబడింది`,
          performedByEmail: user.email || "",
          performedByName: user.displayName || user.email || "System/Merchant",
          performedByUid: user.uid,
        })
      ]);

      setCustName('');
      setCustPhone('');
      setCustEmail('');
      setCustVillage('');
      setCustMandal('');
      setShowAddCustomerModal(false);
      await loadLedgerData(user.uid, user.email);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAddingCustomer(false);
    }
  };

  const handleUpdateCustomerAction = async (customerId: string, name: string, phone: string, email: string, village?: string, mandal?: string) => {
    if (!user) return;
    const store = getStore(user.uid, user.email || undefined);
    await Promise.all([
      store.updateCustomer(customerId, name, phone, email, village, mandal),
      store.addAuditLog({
        actionType: 'UPDATE_CUSTOMER',
        itemType: 'Customer',
        itemId: customerId,
        itemDisplayName: name,
        details: `Updated details of customer "${name}"`,
        detailsTe: `కస్టమర్ "${name}" వివరాలు సవరించబడ్డాయి`,
        performedByEmail: user.email || "",
        performedByName: user.displayName || user.email || "System",
        performedByUid: user.uid
      })
    ]);
    await loadLedgerData(user.uid, user.email);
  };

  const handleDeleteCustomerAction = async (customerId: string) => {
    if (!user) return;
    const store = getStore(user.uid, user.email || undefined);
    const cust = customers.find(c => c.id === customerId);
    const custNameVal = cust ? cust.name : "Unknown/Deleted";
    await Promise.all([
      store.deleteCustomer(customerId),
      store.addAuditLog({
        actionType: 'DELETE_CUSTOMER',
        itemType: 'Customer',
        itemId: customerId,
        itemDisplayName: custNameVal,
        details: `Deleted customer "${custNameVal}"`,
        detailsTe: `కస్టమర్ "${custNameVal}" తొలగించబడింది`,
        performedByEmail: user.email || "",
        performedByName: user.displayName || user.email || "System",
        performedByUid: user.uid
      })
    ]);
    await loadLedgerData(user.uid, user.email);
  };

  const handleAddShopAction = async (name: string, phone: string, address: string) => {
    if (!user) return;
    const store = getStore(user.uid, user.email || undefined);
    const shopId = generateId();
    await Promise.all([
      store.addShop({
        id: shopId,
        name,
        phone,
        address
      }),
      store.addAuditLog({
        actionType: 'CREATE_SHOP',
        itemType: 'Shop',
        itemId: shopId,
        itemDisplayName: name,
        details: `Registered new shop "${name}" at "${address}"`,
        detailsTe: `కొత్త షాపు "${name}" (${address}) నమోదు చేయబడింది`,
        performedByEmail: user.email || "",
        performedByName: user.displayName || user.email || "System",
        performedByUid: user.uid
      })
    ]);
    await loadLedgerData(user.uid, user.email);
  };

  const handleUpdateShopAction = async (shopId: string, name: string, phone: string, address: string) => {
    if (!user) return;
    const store = getStore(user.uid, user.email || undefined);
    await Promise.all([
      store.updateShop(shopId, name, phone, address),
      store.addAuditLog({
        actionType: 'UPDATE_SHOP',
        itemType: 'Shop',
        itemId: shopId,
        itemDisplayName: name,
        details: `Updated details of shop "${name}"`,
        detailsTe: `షాపు "${name}" వివరాలు సవరించబడ్డాయి`,
        performedByEmail: user.email || "",
        performedByName: user.displayName || user.email || "System",
        performedByUid: user.uid
      })
    ]);
    await loadLedgerData(user.uid, user.email);
  };

  const handleDeleteShopAction = async (shopId: string) => {
    if (!user) return;
    const store = getStore(user.uid, user.email || undefined);
    const s = shops.find(sh => sh.id === shopId);
    const shopNameVal = s ? s.name : "Unknown/Deleted";
    await Promise.all([
      store.deleteShop(shopId),
      store.addAuditLog({
        actionType: 'DELETE_SHOP',
        itemType: 'Shop',
        itemId: shopId,
        itemDisplayName: shopNameVal,
        details: `Deleted shop "${shopNameVal}"`,
        detailsTe: `షాపు "${shopNameVal}" తొలగించబడింది`,
        performedByEmail: user.email || "",
        performedByName: user.displayName || user.email || "System",
        performedByUid: user.uid
      })
    ]);
    await loadLedgerData(user.uid, user.email);
  };

  const handleUpdateShopCollaboratorsAction = async (shopId: string, emails: string[], uids: string[]) => {
    if (!user) return;
    const store = getStore(user.uid, user.email || undefined);
    const s = shops.find(sh => sh.id === shopId);
    const shopNameVal = s ? s.name : "Unknown";
    await Promise.all([
      store.updateShopCollaborators(shopId, emails, uids),
      store.addAuditLog({
        actionType: 'COLLABORATOR_CHANGE',
        itemType: 'Shop',
        itemId: shopId,
        itemDisplayName: shopNameVal,
        details: `Updated collaborators of shop "${shopNameVal}" to [${emails.join(', ')}]`,
        detailsTe: `షాపు "${shopNameVal}" కొలాబరేటర్లు [${emails.join(', ')}] కి సవరించబడ్డాయి`,
        performedByEmail: user.email || "",
        performedByName: user.displayName || user.email || "System",
        performedByUid: user.uid
      })
    ]);
    await loadLedgerData(user.uid, user.email);
  };

  const handleGetMerchantByEmailAction = async (email: string) => {
    if (!user) return null;
    const store = getStore(user.uid, user.email || undefined);
    return await store.getMerchantByEmail(email);
  };

  const handleClearAllDatabaseDataAction = async () => {
    if (!user) return;
    const store = getStore(user.uid, user.email || undefined);
    await store.clearAllDatabaseData();
    await loadLedgerData(user.uid, user.email);
  };

  const handleAddTransactionAction = async (shopId: string, shopName: string, amount: number, notes: string) => {
    if (!user || !selectedCustomer) return;
    const store = getStore(user.uid, user.email || undefined);
    const txId = generateId();
    await Promise.all([
      store.addTransaction({
        id: txId,
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        shopId,
        shopName,
        amount,
        status: 'Unpaid',
        notes
      }),
      store.addAuditLog({
        actionType: 'CREATE_TX',
        itemType: 'Transaction',
        itemId: txId,
        itemDisplayName: selectedCustomer.name,
        details: `Created transaction of ₹${amount} for customer "${selectedCustomer.name}" at shop "${shopName}"`,
        detailsTe: `కస్టమర్ "${selectedCustomer.name}" కోసం ₹${amount} లావాదేవీ షాప్ "${shopName}" లో సృష్టించబడింది`,
        performedByEmail: user.email || "",
        performedByName: user.displayName || user.email || "System",
        performedByUid: user.uid
      })
    ]);
    await loadLedgerData(user.uid, user.email);
  };

  const handleUpdateTransactionAction = async (txId: string, updates: Partial<Pick<Transaction, 'amount' | 'status' | 'notes'>>) => {
    if (!user) return;
    const store = getStore(user.uid, user.email || undefined);
    const tx = transactions.find(t => t.id === txId);
    const customerNameVal = tx ? tx.customerName : "Unknown Client";
    const shopNameVal = tx ? tx.shopName : "Unknown Shop";
    
    let changeDetails = [];
    let changeDetailsTe = [];
    if (updates.amount !== undefined && tx && tx.amount !== updates.amount) {
      changeDetails.push(`amount updated from ₹${tx.amount} to ₹${updates.amount}`);
      changeDetailsTe.push(`మొత్తం ₹${tx.amount} నుండి ₹${updates.amount} కి సవరించబడింది`);
    }
    if (updates.status !== undefined && tx && tx.status !== updates.status) {
      changeDetails.push(`status updated from "${tx.status}" to "${updates.status}"`);
      changeDetailsTe.push(`స్థితి "${tx.status}" నుండి "${updates.status}" కి సవరించబడింది`);
    }
    if (updates.notes !== undefined && tx && tx.notes !== updates.notes) {
      changeDetails.push(`notes updated`);
      changeDetailsTe.push(`వివరాలు సవరించబడ్డాయి`);
    }
    const detailsStr = changeDetails.length > 0 ? `, ${changeDetails.join(' & ')}` : '';
    const detailsStrTe = changeDetailsTe.length > 0 ? `, ${changeDetailsTe.join(' & ')}` : '';

    await Promise.all([
      store.updateTransaction(txId, updates),
      store.addAuditLog({
        actionType: 'UPDATE_TX',
        itemType: 'Transaction',
        itemId: txId,
        itemDisplayName: customerNameVal,
        details: `Updated transaction of customer "${customerNameVal}" at shop "${shopNameVal}"${detailsStr}`,
        detailsTe: `షాప్ "${shopNameVal}" లో కస్టమర్ "${customerNameVal}" లావాదేవీ సవరించబడింది${detailsStrTe}`,
        performedByEmail: user.email || "",
        performedByName: user.displayName || user.email || "System",
        performedByUid: user.uid
      })
    ]);
    await loadLedgerData(user.uid, user.email);
  };

  const handleDeleteTransactionAction = async (txId: string) => {
    if (!user) return;
    const store = getStore(user.uid, user.email || undefined);
    const tx = transactions.find(t => t.id === txId);
    const customerNameVal = tx ? tx.customerName : "Unknown Client";
    const shopNameVal = tx ? tx.shopName : "Unknown Shop";
    const amountVal = tx ? tx.amount : 0;
    
    await Promise.all([
      store.deleteTransaction(txId),
      store.addAuditLog({
        actionType: 'DELETE_TX',
        itemType: 'Transaction',
        itemId: txId,
        itemDisplayName: customerNameVal,
        details: `Deleted transaction of ₹${amountVal} for customer "${customerNameVal}" from shop "${shopNameVal}"`,
        detailsTe: `కస్టమర్ "${customerNameVal}" యొక్క ₹${amountVal} లావాదేవీ షాప్ "${shopNameVal}" నుండి తొలగించబడింది`,
        performedByEmail: user.email || "",
        performedByName: user.displayName || user.email || "System",
        performedByUid: user.uid
      })
    ]);
    await loadLedgerData(user.uid, user.email);
  };

  const handleAddMonthlyLogAction = async (compiledLogs: string[]) => {
    if (!user) throw new Error(t.anonymousReject);
    const store = getStore(user.uid, user.email || undefined);
    const newLog = await store.addMonthlyLog({
      id: generateId(),
      compiledLogs
    });
    await loadLedgerData(user.uid, user.email);
    return newLog;
  };

  // Sync selectedCustomer reference on transaction/customer list updates to keep profile screen accurate
  const synchronizedSelectedCustomer = useMemo(() => {
    if (!selectedCustomer) return null;
    return customers.find(c => c.id === selectedCustomer.id) || selectedCustomer;
  }, [customers, selectedCustomer]);

  // 1. ACL Check: If they have no shop access AND not superuser, they can't see any customers
  const visibleCustomers = useMemo(() => {
    if (!user) return [];
    const isSuper = user.email === 'naveenkumar31343@gmail.com';
    if (isSuper) return customers;
    
    // Check if they have access to at least 1 shop
    if (shops.length === 0) {
      return [];
    }
    return customers;
  }, [customers, shops, user]);

  // 2. Customers added to their shop
  const customersAddedToMyShop = useMemo(() => {
    if (!user) return new Set<string>();
    const isSuper = user.email === 'naveenkumar31343@gmail.com';
    if (isSuper) {
      return new Set<string>(customers.map(c => c.id));
    }
    
    const myShopIds = new Set(shops.map(s => s.id));
    const addedCustomerIds = new Set<string>();
    
    // Any customer this user registered/owns:
    customers.forEach(c => {
      if (c.ownerId === user.uid) {
        addedCustomerIds.add(c.id);
      }
    });
    
    // Any customer that has at least one transaction in one of my shops:
    transactions.forEach(tx => {
      if (myShopIds.has(tx.shopId)) {
        addedCustomerIds.add(tx.customerId);
      }
    });
    
    return addedCustomerIds;
  }, [customers, transactions, shops, user]);

  // 3. Filtered transactions based on ACL (only transactions of customers added to my shop)
  const visibleTransactions = useMemo(() => {
    if (!user) return [];
    const isSuper = user.email === 'naveenkumar31343@gmail.com';
    if (isSuper) return transactions;
    
    return transactions.filter(tx => customersAddedToMyShop.has(tx.customerId));
  }, [transactions, customersAddedToMyShop, user]);

  // 4. Secure Shop-Specific Audit Trail Filter based on associated shops
  const visibleAuditLogs = useMemo(() => {
    if (!user) return [];
    const isSuper = user.email === 'naveenkumar31343@gmail.com';
    if (isSuper) return auditLogs;

    const myShopIds = new Set(shops.map(s => s.id));
    const allowedCustomerIds = customersAddedToMyShop;

    return auditLogs.filter(log => {
      // If it's a Shop log, it must be for one of my shops
      if (log.itemType === 'Shop') {
        return myShopIds.has(log.itemId);
      }
      // If it's a Transaction log, its associated transaction should be in one of my shops or belong to my customers
      if (log.itemType === 'Transaction') {
        const tx = transactions.find(t => t.id === log.itemId);
        if (tx) {
          return myShopIds.has(tx.shopId) || allowedCustomerIds.has(tx.customerId);
        }
        return log.performedById === user.uid;
      }
      // If it's a Customer log, it must be one of my allowed customers
      if (log.itemType === 'Customer') {
        return allowedCustomerIds.has(log.itemId);
      }
      return log.performedById === user.uid;
    });
  }, [auditLogs, shops, customersAddedToMyShop, transactions, user]);

  // Determine user role tag
  const userRoleTag = useMemo(() => {
    if (!user) return "";
    if (user.email === 'naveenkumar31343@gmail.com') {
      return t.superuserTag;
    }
    if (shops.length > 0) {
      return t.shopOwnerTag;
    }
    return t.normalUserTag;
  }, [user, shops]);

  if (authLoading) {
    return (
      <div id="auth-loading-screen" className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 gap-3">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        <span className="text-sm font-semibold text-gray-400 font-mono">{t.initializing}</span>
      </div>
    );
  }

  // LOGIN SCREEN (Required Google Sign-In)
  if (!user) {
    return (
      <div id="login-layout" className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-slate-800">
        <div id="login-card" className="bg-white border border-gray-150 rounded-3xl p-8 max-w-sm w-full shadow-xs space-y-8 animate-in fade-in zoom-in-95 duration-200 text-center">
          
          <div className="space-y-3">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 border border-emerald-100">
              <BookOpenCheck className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{t.title}</h1>
              <p className="text-xs text-slate-450 font-bold mt-1.5 leading-normal">
                {t.subtitle}
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-4">
            <button
               id="google-signin-btn"
               onClick={handleGoogleSignIn}
               className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2.5 transition cursor-pointer shadow-xs text-xs focus:outline-none focus:ring-4 focus:ring-emerald-100"
            >
              <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                <path d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C18.155 2.502 15.46 1 12.24 1c-6.075 0-11 4.925-11 11s4.925 11 11 11c6.34 0 10.55-4.435 10.55-10.715 0-.725-.075-1.275-.175-1.685H12.24z"/>
              </svg>
              <span>{t.logInGoogle}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MAIN DASHBOARD LAYOUT
  return (
    <div id="main-ledger-dashboard" className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      
      {/* Header Panel */}
      <header className="bg-white border-b border-gray-200 shrink-0 sticky top-0 z-[60] shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-xs">
              <BookOpenCheck className="w-5.5 h-5.5" />
            </div>
            <div>
              <span className="font-extrabold text-base text-slate-905 tracking-tight block">{t.title}</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block -mt-0.5">
                {t.subtitle}
              </span>
            </div>
          </div>

          {/* User profile & Sign Out */}
          <div className="flex items-center gap-3">
            {/* Language Switcher Toggle */}
            <button
              id="language-switcher-btn"
              onClick={toggleLanguage}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-lg text-xs font-semibold tracking-wide transition border border-gray-200 cursor-pointer shadow-2xs mr-1 leading-none"
            >
              <Languages className="w-3.5 h-3.5 text-emerald-650 shrink-0" />
              <span>{language === 'te' ? 'Switch to English' : 'Switch to Telugu'}</span>
            </button>

            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-extrabold text-slate-900 leading-none">{user.displayName || t.guestUser}</span>
              <span className="text-[10px] font-mono font-bold text-slate-400 mt-1 leading-none flex items-center gap-1 justify-end">
                <span>{user.email}</span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              </span>
            </div>

            {userRoleTag && (
              <span className="hidden md:inline-block text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-gray-200 px-2.5 py-1 rounded-md">
                {userRoleTag}
              </span>
            )}

            {user.photoURL ? (
              <img 
                referrerPolicy="no-referrer" 
                src={user.photoURL} 
                alt="Merchant Avatar" 
                className="w-8 h-8 rounded-full border border-gray-200" 
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold text-xs border border-emerald-100">
                U
              </div>
            )}

            <button
              id="ledger-signout-btn"
              onClick={handleSignOut}
              title={t.logOut}
              className="p-1.5 text-slate-400 hover:text-red-650 hover:bg-slate-50 rounded-lg transition shrink-0 cursor-pointer"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main dashboard content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Tab Selection */}
        {!synchronizedSelectedCustomer && (
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-gray-150 pb-2">
            <div className="flex gap-1.5 p-1 bg-gray-150/50 border border-gray-200 rounded-xl self-start">
              <button
                onClick={() => { setActiveTab('customers'); setSelectedCustomer(null); }}
                className={`px-4 py-2 rounded-lg text-xs font-black tracking-tight transition cursor-pointer flex items-center gap-2 ${
                  activeTab === 'customers' 
                    ? 'bg-white text-emerald-800 shadow-2xs border border-gray-200' 
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                {t.tabCustomers}
              </button>

              <button
                onClick={() => { setActiveTab('transactions'); setSelectedCustomer(null); }}
                className={`px-4 py-2 rounded-lg text-xs font-black tracking-tight transition cursor-pointer flex items-center gap-2 ${
                  activeTab === 'transactions' 
                    ? 'bg-white text-emerald-800 shadow-2xs border border-gray-200' 
                    : 'text-slate-500 hover:text-slate-905'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                {t.tabTransactions}
              </button>

              <button
                onClick={() => { setActiveTab('shops'); setSelectedCustomer(null); }}
                className={`px-4 py-2 rounded-lg text-xs font-black tracking-tight transition cursor-pointer flex items-center gap-2 ${
                  activeTab === 'shops' 
                    ? 'bg-white text-emerald-800 shadow-2xs border border-gray-200' 
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Store className="w-3.5 h-3.5 text-emerald-600" />
                {t.tabShops}
              </button>

              <button
                onClick={() => { setActiveTab('audit'); setSelectedCustomer(null); }}
                className={`px-4 py-2 rounded-lg text-xs font-black tracking-tight transition cursor-pointer flex items-center gap-2 ${
                  activeTab === 'audit' 
                    ? 'bg-white text-emerald-800 shadow-2xs border border-gray-200' 
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <History className="w-3.5 h-3.5 text-emerald-600" />
                {t.tabAudit}
              </button>
            </div>
            
            <div className="flex items-center gap-4 font-bold text-xs">
              {dataLoading && (
                <span className="text-xs font-mono font-medium text-slate-400 flex items-center gap-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                  {t.syncingDb}
                </span>
              )}

              <div className="flex items-center gap-3">
                {userRoleTag && (
                  <span className="inline-block md:hidden text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-gray-200 px-2 py-0.5 rounded">
                    {userRoleTag}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CORE RENDER DECISION PANEL */}
        <div id="content-screen-viewport">
          {dataLoading && customers.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
              <span className="text-sm font-semibold text-slate-450">{t.systemSyncing}</span>
            </div>
          ) : (
            <>
              {/* Conditional Router Tree */}
              {synchronizedSelectedCustomer ? (
                <CustomerProfile
                  customer={synchronizedSelectedCustomer}
                  transactions={visibleTransactions}
                  shops={shops}
                  currentUser={user}
                  auditLogs={visibleAuditLogs}
                  onBack={() => setSelectedCustomer(null)}
                  onAddTransaction={handleAddTransactionAction}
                  onUpdateTransaction={handleUpdateTransactionAction}
                  onDeleteTransaction={handleDeleteTransactionAction}
                  onUpdateCustomer={handleUpdateCustomerAction}
                />
              ) : (
                <>
                  {activeTab === 'customers' && (
                    <CustomerDirectory
                      customers={visibleCustomers}
                      transactions={visibleTransactions}
                      currentUser={user}
                      onSelectCustomer={setSelectedCustomer}
                      onAddCustomerClick={() => setShowAddCustomerModal(true)}
                      onUpdateCustomer={handleUpdateCustomerAction}
                      onDeleteCustomer={handleDeleteCustomerAction}
                    />
                  )}

                  {activeTab === 'transactions' && (
                    <MerchantTransactions
                      transactions={visibleTransactions}
                      customers={visibleCustomers}
                      shops={shops}
                      currentUser={user}
                      auditLogs={visibleAuditLogs}
                      onSelectCustomer={setSelectedCustomer}
                      onUpdateTransaction={handleUpdateTransactionAction}
                      onDeleteTransaction={handleDeleteTransactionAction}
                      initialSubTab="ledger"
                    />
                  )}

                  {activeTab === 'shops' && (
                    <ShopRegistry
                      shops={shops}
                      transactions={visibleTransactions}
                      auditLogs={visibleAuditLogs}
                      onAddShop={handleAddShopAction}
                      onUpdateShop={handleUpdateShopAction}
                      onDeleteShop={handleDeleteShopAction}
                      currentUserId={user.uid}
                      currentUserEmail={user.email || undefined}
                      onUpdateShopCollaborators={handleUpdateShopCollaboratorsAction}
                      onGetMerchantByEmail={handleGetMerchantByEmailAction}
                    />
                  )}

                  {activeTab === 'audit' && (
                    <MerchantTransactions
                      transactions={visibleTransactions}
                      customers={visibleCustomers}
                      shops={shops}
                      currentUser={user}
                      auditLogs={visibleAuditLogs}
                      onSelectCustomer={setSelectedCustomer}
                      onUpdateTransaction={handleUpdateTransactionAction}
                      onDeleteTransaction={handleDeleteTransactionAction}
                      initialSubTab="audit"
                    />
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>

      {/* Customer Registration Dialog overlay */}
      {showAddCustomerModal && (
        <div id="customer-modal-backdrop" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[80]">
          <div id="customer-modal-card" className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-150 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="font-bold text-slate-905 text-base flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-600" />
                {t.newCustomerTitle}
              </h3>
              <button 
                onClick={() => setShowAddCustomerModal(false)}
                className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
                disabled={isAddingCustomer}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddNewCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">{t.newCustomerNameLabel}</label>
                <input
                  id="new-cust-name"
                  type="text"
                  required
                  placeholder={t.placeholderName}
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">{t.newCustomerPhoneLabel}</label>
                <input
                  id="new-cust-phone"
                  type="text"
                  required
                  placeholder={t.placeholderPhone}
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">{t.newCustomerEmailLabel}</label>
                <input
                  id="new-cust-email"
                  type="email"
                  placeholder={t.placeholderEmail}
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">{t.customerVillageLabel}</label>
                  <input
                    id="new-cust-village"
                    type="text"
                    placeholder={t.customerVillagePlaceholder}
                    value={custVillage}
                    onChange={(e) => setCustVillage(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">{t.customerMandalLabel}</label>
                  <input
                    id="new-cust-mandal"
                    type="text"
                    placeholder={t.customerMandalPlaceholder}
                    value={custMandal}
                    onChange={(e) => setCustMandal(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  disabled={isAddingCustomer}
                  className="px-4 py-2 border border-gray-200 text-slate-700 rounded-lg hover:bg-gray-50 text-xs font-bold transition"
                >
                  {t.cancelBtn}
                </button>
                <button
                  id="new-cust-submit-btn"
                  type="submit"
                  disabled={isAddingCustomer}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                >
                  {isAddingCustomer && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t.saveCustomerBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
