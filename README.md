# Udhar Ledger Application - Core Documentation & ACL Rules

Welcome to the **Udhar Ledger Application**, a highly secure, offline-first and cloud-synced double-entry bookkeeping platform designed for modern retail shops and merchants.

---

## 👥 App Personas & Access Levels

The application features granular, role-based access control (RBAC) to protect sensitive credit transactions:

### 1. 👑 Super User
*   **Designated Account:** `naveenkumar31343@gmail.com`
*   **Privileges:**
    *   Has unrestricted global bypass access to *all* merchant data, shops, customers, transactions, and audit logs.
    *   Can inspect and manage records across any registered shop in the entire database.

### 2. 🏪 Shop Owner
*   **Designated Account:** The creator of a specific Shop registry.
*   **Privileges:**
    *   Can add, update, or remove other merchants (collaborators/users) to their shop registry.
    *   Can record and view transactions within their own shop.
    *   Can view and manage customers assigned to their shop.

### 3. 💼 Merchant / Collaborator
*   **Designated Account:** Any user added as a co-owners or collaborators by a shop owner.
*   **Privileges:**
    *   Can view and manage customer metrics for the customers registered under their shop(s).
    *   Can view all transactions (across all shops) belonging *exclusively* to customers registered under their shop(s).

---

## 🔒 Strict Access Control Lists (ACLs)

Below are the exact programmatic security bounds implemented in both the frontend stores (`ledgerStore.ts`) and Firebase Firestore database security rules (`firestore.rules`):

1.  **Shop Access Protection:**
    *   A merchant can only view or manage transactions belonging to a shop where they are listed as an owner, co-owner, or registered collaborator.
2.  **Customer Directory Isolation:**
    *   **Rule:** When a user logs in, if they do not have access to at least one shop, **they will not be able to see any customers** in the customer directory.
3.  **Cross-Shop Transaction Visibility Rule:**
    *   **Rule:** Only if a customer is added to a merchant's shop, can the merchant see that customer's transactions (across *any* shop in the ecosystem). This allows collaborative visibility of total outstanding debts accrued by a common customer elsewhere, while maintaining strict privacy for unassociated accounts.
4.  **Shop User Onboarding:**
    *   **Rule:** Only the designated **Owner** of a shop is authorized to add other users (by email/UID) as co-owners or collaborators to their shop configuration.

---

## 🗄️ Database Table Schemas

The following represents the structure of records kept in offline `localStorage` or Firestore Document collections:

### 1. `Merchants` Collection
*   `uid` `(string)` - Unique authenticator ID
*   `email` `(string | null)` - Electronic mail address
*   `displayName` `(string | null)` - Display name
*   `photoURL` `(string | null)` - Avatar profile link
*   `createdAt` `(string)` - Profile registration timestamp

### 2. `Shops` Collection
*   `id` `(string)` - Unique shop identifier
*   `name` `(string)` - Shop registration name
*   `phone` `(string)` - Official mobile contact number
*   `address` `(string)` - Location physical address
*   `createdAt` `(string)` - Registry entry timestamp
*   `ownerId` `(string)` - UID of the Shop creator
*   `ownerEmail` `(string)` - Email of the Shop creator
*   `coOwners` `(string[])` - List of collaborator merchant UIDs
*   `coOwnerEmails` `(string[])` - List of collaborator merchant emails

### 3. `Customers` Collection
*   `id` `(string)` - Unique customer record identifier
*   `name` `(string)` - Full personal name of the customer
*   `phone` `(string)` - Primary contact number
*   `email` `(string)` - Optional email address
*   `village` `(string)` - Optional residential village
*   `mandal` `(string)` - Optional administrative mandal
*   `ownerId` `(string)` - UID of the merchant who registered this customer record
*   `createdAt` `(string)` - Registration timestamp

### 4. `Transactions` Collection
*   `id` `(string)` - Unique transaction ledger identifier
*   `customerId` `(string)` - Associated customer record identifier
*   `customerName` `(string)` - Cached name of the customer
*   `shopId` `(string)` - Associated shop identifier
*   `shopName` `(string)` - Cached name of the shop
*   `amount` `(number)` - Total monetary volume in INR (₹)
*   `status` `('Paid' | 'Unpaid')` - Debt reconciliation state
*   `notes` `(string)` - Hand-written transaction item details
*   `createdAt` `(string)` - Creation timestamp
*   `createdById` `(string)` - UID of creator merchant
*   `createdByName` `(string)` - Display name of creator merchant
*   `createdByEmail` `(string)` - Email of creator merchant
*   `updatedAt` `(string)` - Date last changed
*   `updatedById` `(string)` - UID of editor merchant
*   `updatedByName` `(string)` - Display name of editor merchant
*   `updatedByEmail` `(string)` - Email of editor merchant

### 5. `AuditLogs` Collection
*   `id` `(string)` - Unique log entry identifier
*   `itemType` `('Customer' | 'Transaction' | 'Shop')` - Source item type description
*   `itemId` `(string)` - ID of the element targeted by the action
*   `itemDisplayName` `(string)` - Display name of the document
*   `actionType` `(string)` - Descriptive code (e.g., `CREATE_TRANSACTION`, `UPDATE_CUSTOMER`, `UPDATE_SHOP_DETAILS`)
*   `details` `(string)` - Log statement in English
*   `detailsTe` `(string)` - Log statement in Telugu
*   `performedById` `(string)` - Performer UID
*   `performedByName` `(string)` - Performer name
*   `performedByEmail` `(string)` - Performer email
*   `createdAt` `(string)` - Change event timestamp

---

## 🛠️ Main App Functionalities

*   **⚡ Real-Time Hybrid Double-Entry Engine:** Tracks credit balances, partial settlements, and overdue invoices instantly with auto-computed metrics.
*   **🧭 Single-Page Navigable Dashboard:** Switch dynamically between Customers Directory, Transactions Ledger, and Shops Registry panels.
*   **🗣️ Auto-Toggled Bilingual Translation:** Localized thoroughly into **English** (primary default) and **Telugu** on demand.
*   **📝 Multi-Tiered Audit History Logs:**
    *   **Shops Registry:** Click on any shop name to review its configuration metadata changes history.
    *   **Customer Directory details page:** Includes an embedded timeline list displaying all edit logs performed on their details.
    *   **Ledger tables:** Click anywhere on the notes text or hit the inline "History" button on any row in the *Comprehensive Transactions Ledger* or *Debt and Settlement History* table to slide-open its transaction-specific audit history trail.
