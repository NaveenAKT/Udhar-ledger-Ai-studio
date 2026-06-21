/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Shop, Customer, Transaction, MonthlyLog, LedgerStore, Merchant, AuditLogEntry } from '../types';
import { db, auth, isFirebaseActive, handleFirestoreError, OperationType } from './firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  getDoc
} from 'firebase/firestore';

// Helper to generate a random web-safe ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// ==========================================
// 1. LOCAL STORAGE DRIVER (GRACEFUL FALLBACK)
// ==========================================
export class LocalLedgerStore implements LedgerStore {
  isFirebase = false;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  private getKey(prefix: string): string {
    return `udhar_ledger_${this.userId}_${prefix}`;
  }

  private getData<T>(prefix: string): T[] {
    const raw = localStorage.getItem(this.getKey(prefix));
    if (!raw) return [];
    try {
      return JSON.parse(raw) as T[];
    } catch {
      return [];
    }
  }

  private saveData<T>(prefix: string, data: T[]): void {
    localStorage.setItem(this.getKey(prefix), JSON.stringify(data));
  }

  // Merchant operations
  async saveMerchant(merchant: Merchant): Promise<void> {
    localStorage.setItem(`udhar_ledger_merchant_${merchant.uid}`, JSON.stringify(merchant));
  }

  async getMerchantByEmail(_email: string): Promise<Merchant | null> {
    return null;
  }

  // Shops
  async getShops(_userEmail?: string): Promise<Shop[]> {
    return this.getData<Shop>('shops');
  }

  async addShop(shop: Omit<Shop, 'ownerId' | 'createdAt' | 'collaboratorIds' | 'collaboratorEmails'>): Promise<Shop> {
    const shops = this.getData<Shop>('shops');
    const newShop: Shop = {
      ...shop,
      ownerId: this.userId,
      createdAt: new Date().toISOString(),
      collaboratorIds: [],
      collaboratorEmails: []
    };
    shops.push(newShop);
    this.saveData('shops', shops);
    return newShop;
  }

  async deleteShop(shopId: string): Promise<void> {
    const shops = this.getData<Shop>('shops');
    const filtered = shops.filter(s => s.id !== shopId);
    this.saveData('shops', filtered);
  }

  async updateShopCollaborators(shopId: string, emails: string[], uids: string[]): Promise<void> {
    const shops = this.getData<Shop>('shops');
    const idx = shops.findIndex(s => s.id === shopId);
    if (idx !== -1) {
      shops[idx] = {
        ...shops[idx],
        collaboratorEmails: emails,
        collaboratorIds: uids
      };
      this.saveData('shops', shops);
    }
  }

  // Customers
  async getCustomers(_associatedShopIds?: string[]): Promise<Customer[]> {
    return this.getData<Customer>('customers');
  }

  async addCustomer(customer: Omit<Customer, 'ownerId' | 'createdAt'>): Promise<Customer> {
    const customers = this.getData<Customer>('customers');
    const newCustomer: Customer = {
      ...customer,
      ownerId: this.userId,
      createdAt: new Date().toISOString(),
    };
    customers.push(newCustomer);
    this.saveData('customers', customers);
    return newCustomer;
  }

  async deleteCustomer(customerId: string): Promise<void> {
    const customers = this.getData<Customer>('customers');
    const filtered = customers.filter(c => c.id !== customerId);
    this.saveData('customers', filtered);
  }

  async updateCustomer(customerId: string, name: string, phone: string, email: string, village?: string, mandal?: string): Promise<void> {
    const customers = this.getData<Customer>('customers');
    const idx = customers.findIndex(c => c.id === customerId);
    if (idx !== -1) {
      customers[idx] = {
        ...customers[idx],
        name,
        phone,
        email,
        village,
        mandal
      };
      this.saveData('customers', customers);
    }
  }

  async getMerchants(): Promise<Merchant[]> {
    return [];
  }

  async updateMerchant(merchantId: string, updates: Partial<Pick<Merchant, 'displayName' | 'email' | 'photoURL'>>): Promise<void> {
    const raw = localStorage.getItem(`udhar_ledger_merchant_${merchantId}`);
    if (raw) {
      try {
        const merchant = JSON.parse(raw);
        localStorage.setItem(`udhar_ledger_merchant_${merchantId}`, JSON.stringify({ ...merchant, ...updates }));
      } catch {
        // ignore
      }
    }
  }

  async updateShop(shopId: string, name: string, phone: string, address: string): Promise<void> {
    const shops = this.getData<Shop>('shops');
    const idx = shops.findIndex(s => s.id === shopId);
    if (idx !== -1) {
      shops[idx] = {
        ...shops[idx],
        name,
        phone,
        address
      };
      this.saveData('shops', shops);
    }
  }

  // Transactions
  async getTransactions(_associatedShopIds?: string[]): Promise<Transaction[]> {
    return this.getData<Transaction>('transactions');
  }

  async addTransaction(tx: Omit<Transaction, 'ownerId' | 'createdAt' | 'updatedAt'>): Promise<Transaction> {
    const txs = this.getData<Transaction>('transactions');
    const now = new Date().toISOString();
    const newTx: Transaction = {
      ...tx,
      ownerId: this.userId,
      createdAt: now,
      updatedAt: now,
      createdByUid: this.userId,
      createdByEmail: "local@udhar.ledger",
      createdByName: "Local Merchant",
      updatedByUid: this.userId,
      updatedByEmail: "local@udhar.ledger",
      updatedByName: "Local Merchant",
    };
    txs.push(newTx);
    this.saveData('transactions', txs);
    return newTx;
  }

  async updateTransaction(transactionId: string, updates: Partial<Pick<Transaction, 'amount' | 'status' | 'notes'>>): Promise<void> {
    const txs = this.getData<Transaction>('transactions');
    const index = txs.findIndex(t => t.id === transactionId);
    if (index !== -1) {
      txs[index] = {
        ...txs[index],
        ...updates,
        updatedAt: new Date().toISOString(),
        updatedByUid: this.userId,
        updatedByEmail: "local@udhar.ledger",
        updatedByName: "Local Merchant",
      };
      this.saveData('transactions', txs);
    }
  }

  async deleteTransaction(transactionId: string): Promise<void> {
    const txs = this.getData<Transaction>('transactions');
    const filtered = txs.filter(t => t.id !== transactionId);
    this.saveData('transactions', filtered);
  }

  // Logs
  async getMonthlyLogs(): Promise<MonthlyLog[]> {
    return this.getData<MonthlyLog>('monthly_logs');
  }

  async addMonthlyLog(log: Omit<MonthlyLog, 'ownerId' | 'runDate'>): Promise<MonthlyLog> {
    const logs = this.getData<MonthlyLog>('monthly_logs');
    const newLog: MonthlyLog = {
      ...log,
      ownerId: this.userId,
      runDate: new Date().toISOString(),
    };
    logs.push(newLog);
    this.saveData('monthly_logs', logs);
    return newLog;
  }

  // Audit Logs
  async getAuditLogs(): Promise<AuditLogEntry[]> {
    const logs = this.getData<AuditLogEntry>('audit_logs');
    return logs.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  }

  async addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>): Promise<AuditLogEntry> {
    const logs = this.getData<AuditLogEntry>('audit_logs');
    const newEntry: AuditLogEntry = {
      ...entry,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    logs.push(newEntry);
    this.saveData('audit_logs', logs);
    return newEntry;
  }

  // Dangerous reset
  async clearAllDatabaseData(): Promise<void> {
    localStorage.removeItem(this.getKey('shops'));
    localStorage.removeItem(this.getKey('customers'));
    localStorage.removeItem(this.getKey('transactions'));
    localStorage.removeItem(this.getKey('monthly_logs'));
    localStorage.removeItem(this.getKey('audit_logs'));
  }
}

// ==========================================
// 2. FIRESTORE DRIVER (ENTERPRISE / REAL-TIME)
// ==========================================
export class FirebaseLedgerStore implements LedgerStore {
  isFirebase = true;
  private userId: string;
  private userEmail?: string;
  private isSuperUser: boolean;

  constructor(userId: string, userEmail?: string) {
    this.userId = userId;
    this.userEmail = userEmail;
    this.isSuperUser = userEmail === 'naveenkumar31343@gmail.com' || auth?.currentUser?.email === 'naveenkumar31343@gmail.com';
  }

  // Merchants / Users
  async saveMerchant(merchant: Merchant): Promise<void> {
    const path = `merchants/${merchant.uid}`;
    try {
      await setDoc(doc(db, 'merchants', merchant.uid), merchant, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  async getMerchantByEmail(email: string): Promise<Merchant | null> {
    try {
      const q = query(collection(db, 'merchants'), where('email', '==', email));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs[0].data() as Merchant;
       }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'merchants');
    }
  }

  // Shops
  async getShops(userEmail?: string): Promise<Shop[]> {
    try {
      const map = new Map<string, Shop>();
      
      const emailToCheck = userEmail || this.userEmail || auth?.currentUser?.email;
      const isSuper = emailToCheck === 'naveenkumar31343@gmail.com' || this.isSuperUser;

      if (isSuper) {
        const snapAll = await getDocs(collection(db, 'shops'));
        snapAll.forEach((d) => {
          const s = d.data() as Shop;
          map.set(s.id, s);
        });
        return Array.from(map.values());
      }
      
      // Query 1: Shops created/owned by general active user
      const qOwned = query(collection(db, 'shops'), where('ownerId', '==', this.userId));
      const snapOwned = await getDocs(qOwned);
      snapOwned.forEach((d) => {
        const s = d.data() as Shop;
        map.set(s.id, s);
      });

      // Query 2: Shops where user is colaborador by ID
      const qCollabId = query(collection(db, 'shops'), where('collaboratorIds', 'array-contains', this.userId));
      const snapCollabId = await getDocs(qCollabId);
      snapCollabId.forEach((d) => {
        const s = d.data() as Shop;
        map.set(s.id, s);
      });

      // Query 3: Shops where user is colaborador by Email
      if (userEmail) {
        const qCollabEmail = query(collection(db, 'shops'), where('collaboratorEmails', 'array-contains', userEmail));
        const snapCollabEmail = await getDocs(qCollabEmail);
        snapCollabEmail.forEach((d) => {
          const s = d.data() as Shop;
          map.set(s.id, s);
        });
      }

      return Array.from(map.values());
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'shops');
    }
  }

  async addShop(shop: Omit<Shop, 'ownerId' | 'createdAt' | 'collaboratorIds' | 'collaboratorEmails'>): Promise<Shop> {
    const path = `shops/${shop.id}`;
    try {
      const newShop: Shop = {
        ...shop,
        ownerId: this.userId,
        createdAt: new Date().toISOString(),
        collaboratorIds: [],
        collaboratorEmails: []
      };
      await setDoc(doc(db, 'shops', shop.id), newShop);
      return newShop;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  async deleteShop(shopId: string): Promise<void> {
    const path = `shops/${shopId}`;
    try {
      await deleteDoc(doc(db, 'shops', shopId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  async updateShopCollaborators(shopId: string, emails: string[], uids: string[]): Promise<void> {
    const path = `shops/${shopId}`;
    try {
      const docRef = doc(db, 'shops', shopId);
      await updateDoc(docRef, {
        collaboratorEmails: emails,
        collaboratorIds: uids
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  // Customers
  async getCustomers(associatedShopIds?: string[]): Promise<Customer[]> {
    try {
      const map = new Map<string, Customer>();
      
      const snapAll = await getDocs(collection(db, 'customers'));
      snapAll.forEach((d) => {
        const c = d.data() as Customer;
        map.set(c.id, c);
      });
      return Array.from(map.values());
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'customers');
    }
  }

  async addCustomer(customer: Omit<Customer, 'ownerId' | 'createdAt'>): Promise<Customer> {
    const path = `customers/${customer.id}`;
    try {
      const newCustomer: Customer = {
        ...customer,
        ownerId: this.userId,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'customers', customer.id), newCustomer);
      return newCustomer;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  async deleteCustomer(customerId: string): Promise<void> {
    const path = `customers/${customerId}`;
    try {
      await deleteDoc(doc(db, 'customers', customerId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  async updateCustomer(customerId: string, name: string, phone: string, email: string, village?: string, mandal?: string): Promise<void> {
    const path = `customers/${customerId}`;
    try {
      const docRef = doc(db, 'customers', customerId);
      await updateDoc(docRef, { name, phone, email, village: village || "", mandal: mandal || "" });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async getMerchants(): Promise<Merchant[]> {
    try {
      const snap = await getDocs(collection(db, 'merchants'));
      const list: Merchant[] = [];
      snap.forEach((d) => {
        list.push(d.data() as Merchant);
      });
      return list;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'merchants');
    }
  }

  async updateMerchant(merchantId: string, updates: Partial<Pick<Merchant, 'displayName' | 'email' | 'photoURL'>>): Promise<void> {
    const path = `merchants/${merchantId}`;
    try {
      const docRef = doc(db, 'merchants', merchantId);
      await updateDoc(docRef, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async updateShop(shopId: string, name: string, phone: string, address: string): Promise<void> {
    const path = `shops/${shopId}`;
    try {
      const docRef = doc(db, 'shops', shopId);
      await updateDoc(docRef, { name, phone, address });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  // Transactions
  async getTransactions(associatedShopIds?: string[]): Promise<Transaction[]> {
    try {
      const map = new Map<string, Transaction>();
      
      const snapAll = await getDocs(collection(db, 'transactions'));
      snapAll.forEach((d) => {
        const tx = d.data() as Transaction;
        map.set(tx.id, tx);
      });
      return Array.from(map.values());
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    }
  }

  async addTransaction(tx: Omit<Transaction, 'ownerId' | 'createdAt' | 'updatedAt'>): Promise<Transaction> {
    const path = `transactions/${tx.id}`;
    try {
      const now = new Date().toISOString();
      const currentUser = auth?.currentUser;
      const newTx: Transaction = {
        ...tx,
        ownerId: this.userId,
        createdAt: now,
        updatedAt: now,
        createdByUid: currentUser?.uid || this.userId,
        createdByEmail: currentUser?.email || this.userEmail || "",
        createdByName: currentUser?.displayName || currentUser?.email || "System/Merchant",
        updatedByUid: currentUser?.uid || this.userId,
        updatedByEmail: currentUser?.email || this.userEmail || "",
        updatedByName: currentUser?.displayName || currentUser?.email || "System/Merchant",
      };
      await setDoc(doc(db, 'transactions', tx.id), newTx);
      return newTx;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  async updateTransaction(transactionId: string, updates: Partial<Pick<Transaction, 'amount' | 'status' | 'notes'>>): Promise<void> {
    const path = `transactions/${transactionId}`;
    try {
      const docRef = doc(db, 'transactions', transactionId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const currentData = snap.data() as Transaction;
        const currentUser = auth?.currentUser;
        const finalUpdates = {
          ...currentData,
          ...updates,
          updatedAt: new Date().toISOString(),
          updatedByUid: currentUser?.uid || this.userId,
          updatedByEmail: currentUser?.email || this.userEmail || "",
          updatedByName: currentUser?.displayName || currentUser?.email || "System/Merchant",
        };
        await setDoc(docRef, finalUpdates);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async deleteTransaction(transactionId: string): Promise<void> {
    const path = `transactions/${transactionId}`;
    try {
      await deleteDoc(doc(db, 'transactions', transactionId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  // Logs
  async getMonthlyLogs(): Promise<MonthlyLog[]> {
    try {
      const isSuper = this.isSuperUser || auth?.currentUser?.email === 'naveenkumar31343@gmail.com';

      if (isSuper) {
        const snap = await getDocs(collection(db, 'monthly_logs'));
        const res: MonthlyLog[] = [];
        snap.forEach((d) => {
          res.push(d.data() as MonthlyLog);
        });
        return res;
      }

      const q = query(collection(db, 'monthly_logs'), where('ownerId', '==', this.userId));
      const snap = await getDocs(q);
      const res: MonthlyLog[] = [];
      snap.forEach((d) => {
        res.push(d.data() as MonthlyLog);
      });
      return res;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'monthly_logs');
    }
  }

  async addMonthlyLog(log: Omit<MonthlyLog, 'ownerId' | 'runDate'>): Promise<MonthlyLog> {
    const path = `monthly_logs/${log.id}`;
    try {
      const newLog: MonthlyLog = {
        ...log,
        ownerId: this.userId,
        runDate: new Date().toISOString(),
      };
      await setDoc(doc(db, 'monthly_logs', log.id), newLog);
      return newLog;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  // Audit Logs
  async getAuditLogs(): Promise<AuditLogEntry[]> {
    try {
      const snap = await getDocs(collection(db, 'audit_logs'));
      const list: AuditLogEntry[] = [];
      snap.forEach((d) => {
        list.push(d.data() as AuditLogEntry);
      });
      return list.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'audit_logs');
    }
  }

  async addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>): Promise<AuditLogEntry> {
    const id = generateId();
    const path = `audit_logs/${id}`;
    try {
      const newEntry: AuditLogEntry = {
        ...entry,
        id,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'audit_logs', id), newEntry);
      return newEntry;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  // Delete all data in the project for a complete clean slate
  async clearAllDatabaseData(): Promise<void> {
    try {
      const emailToCheck = this.userEmail || auth?.currentUser?.email;
      const isSuper = emailToCheck === 'naveenkumar31343@gmail.com' || this.isSuperUser;

      if (isSuper) {
        // Superuser deletes EVERYTHING in all collections
        const collectionsToClear = ['shops', 'customers', 'transactions', 'monthly_logs', 'merchants', 'audit_logs'];
        for (const colName of collectionsToClear) {
          const snap = await getDocs(collection(db, colName));
          for (const d of snap.docs) {
            await deleteDoc(doc(db, colName, d.id));
          }
        }
      } else {
        // Regular user only deletes their own owned documents
        const ownedShops = query(collection(db, 'shops'), where('ownerId', '==', this.userId));
        const shopsSnap = await getDocs(ownedShops);
        for (const d of shopsSnap.docs) {
          await deleteDoc(doc(db, 'shops', d.id));
        }

        // Clear customers listed
        const ownedCusts = query(collection(db, 'customers'), where('ownerId', '==', this.userId));
        const custsSnap = await getDocs(ownedCusts);
        for (const d of custsSnap.docs) {
          await deleteDoc(doc(db, 'customers', d.id));
        }

        // Clear transactions listed
        const ownedTxs = query(collection(db, 'transactions'), where('ownerId', '==', this.userId));
        const txSnap = await getDocs(ownedTxs);
        for (const d of txSnap.docs) {
          await deleteDoc(doc(db, 'transactions', d.id));
        }

        // Clear logs
        const ownedLogs = query(collection(db, 'monthly_logs'), where('ownerId', '==', this.userId));
        const logsSnap = await getDocs(ownedLogs);
        for (const d of logsSnap.docs) {
          await deleteDoc(doc(db, 'monthly_logs', d.id));
        }

        // Clear audit logs performed by this user
        const ownedAuditLogs = query(collection(db, 'audit_logs'), where('performedByUid', '==', this.userId));
        const auditSnap = await getDocs(ownedAuditLogs);
        for (const d of auditSnap.docs) {
          await deleteDoc(doc(db, 'audit_logs', d.id));
        }

        // Also remove logged profile record
        await deleteDoc(doc(db, 'merchants', this.userId));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'merchants');
    }
  }
}

// Factory to initialize the proper store based on state
export function getStore(userId: string, userEmail?: string): LedgerStore {
  if (isFirebaseActive && userId) {
    return new FirebaseLedgerStore(userId, userEmail);
  }
  return new LocalLedgerStore(userId || 'default-guest-merchant');
}
