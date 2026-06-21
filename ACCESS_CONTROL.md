# Udhar Security Rules and Access Controls

This document details the security and access control mechanisms implemented in the **Udhar** application (Telugu: **ఉధార్**) to protect client records while maintaining transparent credit directories for shops and users.

---

## 1. Core Principles

1. **Transparent Customer Directory**: Anyone who is a registered and authenticated ledger user can view the entire Customer Directory list, including customer contact details and transaction history. There are **no read access controls** restricting visibility of customers or historic transactions. This promotes credit transparency across shops.
2. **Restricted Actions (Create/Edit/Delete)**:
   - **Adding Customer Directory Records**: Any verified merchant can register a customer.
   - **Modifying Custome Details**: Only the customer's *original registerer (owner)* or an administrative *Super User* can alter customer descriptions (Village, Mandal, Phone, etc.).
   - **Financial Logs (Transactions)**: Only users who have **approved access privileges to a specific Shop** are permitted to log, edit, or delete transactions for that shop.

---

## 2. Firestore Database Security Rules (`firestore.rules`)

The security architecture relies on Server-Authoritative Firestore rules to validate transactions and write operations before persisting them to the database.

### Helper Authorization Functions
- `isVerifiedUser()`: Validates that the active request originates from an authenticated user.
- `isSuperUser()`: Grants administrative privileges to system superusers (`naveenkumar31343@gmail.com`).
- `isOwner(resource)`: Confirms if the active user registered the customer or created the document.
- `hasShopAccess(shopId)`: Looks up the user's register or co-owner array list to verify that the active user possesses permission for that shop.

### Collection Access Schemas

#### A. `customers` Collection
- **Read Operations (`get`, `list`)**: Open to any `isVerifiedUser()`.
- **Create Operations (`create`)**: Open to any `isVerifiedUser()`.
- **Update Operations (`update`)**: Permitted if the user `isSuperUser()` **OR** `isOwner(resource)` (ensuring only the registering merchant or admins can modify contact details or locations like Village/Mandal).
- **Delete Operations (`delete`)**: Reserved exclusively for `isSuperUser()`.

#### B. `transactions` Collection
- **Read Operations (`get`, `list`)**: Open to any `isVerifiedUser()`. Users can inspect transactions across different shops of a customer.
- **Create Operations (`create`)**: Permitted if `isVerifiedUser()` **AND** the merchant `hasShopAccess(request.resource.data.shopId)` (restricts ledger entries to approved shops only).
- **Update Operations (`update`)**: Permitted if the user has `hasShopAccess(resource.data.shopId)` or `isSuperUser()`. Collaborator edits are perfectly allowed as long as they belong to the shop's access list.
- **Delete Operations (`delete`)**: Permitted if the user has `hasShopAccess(resource.data.shopId)` or `isSuperUser()`.

---

## 3. Frontend Component Level Controls

User views dynamically evaluate credentials to toggle buttons, dialogs, and actions cleanly:

### A. Customer Directory (`CustomerDirectory.tsx`)
- Search and filtering remain fully active for all users.
- The "Edit" and "Delete" buttons on customer cards are displayed only if `canEditCustomer` resolves to `true` (validating if the user is a Superuser or the customer's direct registerer).

### B. Customer Profile (`CustomerProfile.tsx`)
- All past credit history lines can be inspected by any logged-in user.
- The **"Log Debt (బకాయి నమోదు)"** button is available, but the submission form authorizes transaction entries **only** for shops the merchant has access to.
- Editing or deleting specific transactions requires validating `hasAccessToShop(tx.shopId)` on the frontend state, ensuring secure financial logs.
- The **"Back (వెనుకకు)"** button has been enlarged and made highly distinct to ensure smooth navigation.
