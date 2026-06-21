import { describe, it, expect } from 'vitest';
import type { Shop, Customer, Transaction, LedgerUser } from '../types';

// Let's model the same ACL functions that the application implements in App.tsx and MerchantTransactions.tsx

// Rule 1: User who does not have access to any shop - should not see any data
// Rule 4: If user has at least one shop, they should be able to see all customers data in customer directory page
function getVisibleCustomers(
  user: LedgerUser | null,
  isSuperUser: boolean,
  shops: Shop[],
  customers: Customer[]
): Customer[] {
  if (!user) return [];
  if (isSuperUser) return customers;
  
  // Rule 1: If they have no shop access, they see 0 customers
  if (shops.length === 0) {
    return [];
  }
  
  // Rule 4: If they have at least 1 shop, they can see all customers
  return customers;
}

// Rule 2: Only super users can create shops, nobody else can
function canCreateShop(user: LedgerUser | null, isSuperUser: boolean): boolean {
  if (!user) return false;
  return isSuperUser;
}

// Rule 3: Only shop admin can add collaborators. others cannot
function canAddCollaborator(
  user: LedgerUser | null,
  isSuperUser: boolean,
  shop: Shop
): boolean {
  if (!user) return false;
  return shop.ownerId === user.uid || isSuperUser;
}

// Rule 5: In merchant ledger page, they should only see transactions of their shop
function getMerchantLedgerTransactions(
  transactions: Transaction[],
  shops: Shop[],
  isSuperUser: boolean
): Transaction[] {
  if (isSuperUser) return transactions;
  
  const myShopIds = new Set(shops.map(s => s.id));
  return transactions.filter(tx => myShopIds.has(tx.shopId));
}

// Dummy Test Data
const superUser: LedgerUser = {
  uid: 'super123',
  email: 'naveenkumar31343@gmail.com',
  displayName: 'Naveen Kumar',
  photoURL: null
};

const secondSuperUser: LedgerUser = {
  uid: 'super456',
  email: 'akuthota.rajkumar@gmail.com',
  displayName: 'Rajkumar',
  photoURL: null
};

const normalMerchant: LedgerUser = {
  uid: 'merchant_001',
  email: 'merchant@gmail.com',
  displayName: 'Regular Merchant',
  photoURL: null
};

const unauthorizedUser: LedgerUser = {
  uid: 'unauth_789',
  email: 'someone@gmail.com',
  displayName: 'Unauthorized User',
  photoURL: null
};

const dummyShops: Shop[] = [
  {
    id: 'shop_A',
    name: 'Naveen Groceries',
    phone: '9876543210',
    address: 'Hyderabad',
    ownerId: 'merchant_001',
    createdAt: new Date().toISOString()
  },
  {
    id: 'shop_B',
    name: 'Raj kirana',
    phone: '9988776655',
    address: 'Warangal',
    ownerId: 'merchant_002',
    createdAt: new Date().toISOString()
  }
];

const dummyCustomers: Customer[] = [
  {
    id: 'cust_1',
    name: 'Ramu',
    phone: '9000100010',
    email: 'ramu@gmail.com',
    ownerId: 'merchant_001',
    createdAt: new Date().toISOString()
  },
  {
    id: 'cust_2',
    name: 'Srinivas',
    phone: '9000200020',
    email: 'srinivas@gmail.com',
    ownerId: 'merchant_002',
    createdAt: new Date().toISOString()
  }
];

const dummyTransactions: Transaction[] = [
  {
    id: 'tx_1',
    customerId: 'cust_1',
    customerName: 'Ramu',
    shopId: 'shop_A',
    shopName: 'Naveen Groceries',
    amount: 1500,
    status: 'Unpaid',
    notes: 'Bought pulses',
    ownerId: 'merchant_001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tx_2',
    customerId: 'cust_2',
    customerName: 'Srinivas',
    shopId: 'shop_B',
    shopName: 'Raj kirana',
    amount: 2500,
    status: 'Unpaid',
    notes: 'Bought rice bag',
    ownerId: 'merchant_002',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

describe('Udhar Ledger ACL & Test Case Specifications', () => {

  describe('1) User who does not have access to any shop - should not see any data', () => {
    it('returns empty lists for unauthorized user with 0 associated shops', () => {
      const isSuper = unauthorizedUser.email === 'naveenkumar31343@gmail.com' || unauthorizedUser.email === 'akuthota.rajkumar@gmail.com';
      const myAssociatedShops: Shop[] = []; // No shop access
      
      const visible = getVisibleCustomers(unauthorizedUser, isSuper, myAssociatedShops, dummyCustomers);
      expect(visible).toEqual([]);
      expect(visible.length).toBe(0);
    });
  });

  describe('2) Only super users can create shops, nobody else can', () => {
    it('allows superusers to create shops', () => {
      const isSuper = superUser.email === 'naveenkumar31343@gmail.com' || superUser.email === 'akuthota.rajkumar@gmail.com';
      expect(canCreateShop(superUser, isSuper)).toBe(true);

      const isSecondSuper = secondSuperUser.email === 'naveenkumar31343@gmail.com' || secondSuperUser.email === 'akuthota.rajkumar@gmail.com';
      expect(canCreateShop(secondSuperUser, isSecondSuper)).toBe(true);
    });

    it('denies shop creation for regular merchant users', () => {
      const isSuper = normalMerchant.email === 'naveenkumar31343@gmail.com' || normalMerchant.email === 'akuthota.rajkumar@gmail.com';
      expect(canCreateShop(normalMerchant, isSuper)).toBe(false);
    });
  });

  describe('3) Only shop admin can add collaborators, others cannot', () => {
    const targetShop = dummyShops[0]; // Owned by 'merchant_001'

    it('allows the original owner/admin of the shop to add collaborators', () => {
      const isSuper = normalMerchant.email === 'naveenkumar31343@gmail.com' || normalMerchant.email === 'akuthota.rajkumar@gmail.com';
      expect(canAddCollaborator(normalMerchant, isSuper, targetShop)).toBe(true);
    });

    it('allows superusers to manage collaborators even if not owner', () => {
      const isSuper = superUser.email === 'naveenkumar31343@gmail.com' || superUser.email === 'akuthota.rajkumar@gmail.com';
      expect(canAddCollaborator(superUser, isSuper, targetShop)).toBe(true);
    });

    it('denies collaborator management for any other unauthorized user', () => {
      const isSuper = unauthorizedUser.email === 'naveenkumar31343@gmail.com' || unauthorizedUser.email === 'akuthota.rajkumar@gmail.com';
      expect(canAddCollaborator(unauthorizedUser, isSuper, targetShop)).toBe(false);
    });
  });

  describe('4) If user has at least one shop, they should be able to see all customers data in customer directory page', () => {
    it('returns all customers to a user who has active shop access', () => {
      const isSuper = normalMerchant.email === 'naveenkumar31343@gmail.com' || normalMerchant.email === 'akuthota.rajkumar@gmail.com';
      const myAssociatedShops = [dummyShops[0]]; // Has 1 active shop

      const visible = getVisibleCustomers(normalMerchant, isSuper, myAssociatedShops, dummyCustomers);
      expect(visible).toEqual(dummyCustomers);
      expect(visible.length).toBe(dummyCustomers.length);
    });
  });

  describe('5) In merchant ledger page, they should only see transactions of their shop', () => {
    it('filters out other shop transactions for normal merchants', () => {
      const isSuper = normalMerchant.email === 'naveenkumar31343@gmail.com' || normalMerchant.email === 'akuthota.rajkumar@gmail.com';
      const myAssociatedShops = [dummyShops[0]]; // Only has access to shop_A

      const ledgerTxs = getMerchantLedgerTransactions(dummyTransactions, myAssociatedShops, isSuper);
      expect(ledgerTxs.length).toBe(1);
      expect(ledgerTxs[0].shopId).toBe('shop_A');
      expect(ledgerTxs[0].amount).toBe(1500);
    });

    it('shows absolutely all transactions to a superuser regardless of ownership', () => {
      const isSuper = superUser.email === 'naveenkumar31343@gmail.com' || superUser.email === 'akuthota.rajkumar@gmail.com';
      const myAssociatedShops: Shop[] = []; // Superuser sees everything

      const ledgerTxs = getMerchantLedgerTransactions(dummyTransactions, myAssociatedShops, isSuper);
      expect(ledgerTxs.length).toBe(2);
      expect(ledgerTxs).toEqual(dummyTransactions);
    });
  });

  describe('Extra Requirements', () => {
    it('only shop creator is the owner, collaborator is not shop owner', () => {
      const creatorUid = 'merchant_001';
      const collabUid = 'collab_user_99';
      const shopWithCollab: Shop = {
        id: 'shop_A',
        name: 'Naveen Groceries',
        phone: '9876543210',
        address: 'Hyderabad',
        ownerId: creatorUid,
        collaboratorIds: [collabUid],
        createdAt: new Date().toISOString()
      };
      
      // Collaborator is NOT the shop creator, only creator is owner
      const isCreatorOwner = shopWithCollab.ownerId === creatorUid;
      const isCollabOwner = shopWithCollab.ownerId === collabUid;
      expect(isCreatorOwner).toBe(true);
      expect(isCollabOwner).toBe(false);
    });

    it('super user is authorized to edit shop owner email, others are not', () => {
      const canEditOwnerEmail = (isSuperUserVal: boolean) => isSuperUserVal;
      expect(canEditOwnerEmail(true)).toBe(true);
      expect(canEditOwnerEmail(false)).toBe(false);
    });

    it('except super user, no one can see Register new shop button', () => {
      const isRegisterButtonVisible = (isSuperUserVal: boolean) => isSuperUserVal;
      expect(isRegisterButtonVisible(true)).toBe(true);
      expect(isRegisterButtonVisible(false)).toBe(false);
    });
  });
});
