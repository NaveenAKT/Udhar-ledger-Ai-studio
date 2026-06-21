/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Shop {
  id: string;
  name: string;
  phone: string;
  address: string;
  gstNumber?: string;
  ownerId: string;
  createdAt: string; // ISO string or Firestore raw sequence
  collaboratorIds?: string[];
  collaboratorEmails?: string[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  ownerId: string;
  createdAt: string;
  village?: string;
  mandal?: string;
}

export interface Transaction {
  id: string;
  customerId: string;
  customerName: string;
  shopId: string;
  shopName: string;
  amount: number;
  status: 'Paid' | 'Unpaid';
  notes: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  createdByEmail?: string;
  createdByName?: string;
  createdByUid?: string;
  updatedByEmail?: string;
  updatedByName?: string;
  updatedByUid?: string;
}

export interface MonthlyLog {
  id: string;
  runDate: string;
  compiledLogs: string[];
  ownerId: string;
}

export interface AuditLogEntry {
  id: string;
  actionType: 'CREATE_TX' | 'UPDATE_TX' | 'DELETE_TX' | 'CREATE_CUSTOMER' | 'UPDATE_CUSTOMER' | 'DELETE_CUSTOMER' | 'CREATE_SHOP' | 'UPDATE_SHOP' | 'DELETE_SHOP' | 'COLLABORATOR_CHANGE';
  itemType: 'Transaction' | 'Customer' | 'Shop';
  itemId: string;
  itemDisplayName: string;
  details: string;
  detailsTe: string;
  performedByEmail: string;
  performedByName: string;
  performedByUid: string;
  createdAt: string;
}

export interface Merchant {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: string;
}

export interface LedgerUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface LedgerStore {
  isFirebase: boolean;
  
  // Merchants / Users
  saveMerchant(merchant: Merchant): Promise<void>;
  getMerchantByEmail(email: string): Promise<Merchant | null>;
  
  // Shops
  getShops(userEmail?: string): Promise<Shop[]>;
  addShop(shop: Omit<Shop, 'ownerId' | 'createdAt' | 'collaboratorIds' | 'collaboratorEmails'>): Promise<Shop>;
  deleteShop(shopId: string): Promise<void>;
  updateShopCollaborators(shopId: string, emails: string[], uids: string[]): Promise<void>;
  
  // Customers
  getCustomers(associatedShopIds?: string[]): Promise<Customer[]>;
  addCustomer(customer: Omit<Customer, 'ownerId' | 'createdAt'>): Promise<Customer>;
  updateCustomer(customerId: string, name: string, phone: string, email: string, village?: string, mandal?: string): Promise<void>;
  deleteCustomer(customerId: string): Promise<void>;
  
  // Transactions
  getTransactions(associatedShopIds?: string[]): Promise<Transaction[]>;
  addTransaction(transaction: Omit<Transaction, 'ownerId' | 'createdAt' | 'updatedAt'>): Promise<Transaction>;
  updateTransaction(transactionId: string, updates: Partial<Pick<Transaction, 'amount' | 'status' | 'notes'>>): Promise<void>;
  deleteTransaction(transactionId: string): Promise<void>;
  
  // Logs
  getMonthlyLogs(): Promise<MonthlyLog[]>;
  addMonthlyLog(log: Omit<MonthlyLog, 'ownerId' | 'runDate'>): Promise<MonthlyLog>;
  
  // Merchants
  getMerchants(): Promise<Merchant[]>;
  updateMerchant(merchantId: string, updates: Partial<Pick<Merchant, 'displayName' | 'email' | 'photoURL'>>): Promise<void>;
  
  // Shops
  getShops(userEmail?: string): Promise<Shop[]>;
  addShop(shop: Omit<Shop, 'ownerId' | 'createdAt' | 'collaboratorIds' | 'collaboratorEmails'>): Promise<Shop>;
  updateShop(shopId: string, name: string, phone: string, address: string): Promise<void>;
  deleteShop(shopId: string): Promise<void>;
  updateShopCollaborators(shopId: string, emails: string[], uids: string[]): Promise<void>;
  
  // Universal DB Operations
  clearAllDatabaseData(): Promise<void>;

  // Audit Logs
  getAuditLogs(): Promise<AuditLogEntry[]>;
  addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>): Promise<AuditLogEntry>;
}
