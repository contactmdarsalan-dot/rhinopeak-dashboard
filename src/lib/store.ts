import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  createCustomerInBackend,
  createCreditEntryInBackend,
  createCashBankAccountInBackend,
  createDocumentInBackend,
  createExpenseInBackend,
  createExpenseCategoryInBackend,
  createInventoryCategoryInBackend,
  createMovementInBackend,
  createMoneyMovementInBackend,
  createPartyInBackend,
  createPartyLedgerEntryInBackend,
  createProductInBackend,
  createPurchaseInBackend,
  createReminderLogInBackend,
  createReminderTemplateInBackend,
  createReportInBackend,
  createRoleInBackend,
  createSaleInBackend,
  createSupplierInBackend,
  deleteCashBankAccountInBackend,
  deleteCreditEntryInBackend,
  deleteCustomerInBackend,
  deleteDocumentInBackend,
  deleteExpenseInBackend,
  deleteExpenseCategoryInBackend,
  deletePartyInBackend,
  deleteProductInBackend,
  deletePurchaseInBackend,
  deleteRoleInBackend,
  deleteInventoryCategoryInBackend,
  deleteMovementInBackend,
  deleteMoneyMovementInBackend,
  deleteReminderLogInBackend,
  deleteReminderTemplateInBackend,
  deleteReportInBackend,
  deleteSyncOperationInBackend,
  deleteSaleInBackend,
  deleteSupplierInBackend,
  inviteUserInBackend,
  logoutFromBackend,
  patchBillingPlanInBackend,
  patchCashBankAccountInBackend,
  patchCustomerInBackend,
  patchCreditEntryInBackend,
  patchDocumentInBackend,
  patchExpenseInBackend,
  patchExpenseCategoryInBackend,
  patchInventoryCategoryInBackend,
  patchMoneyMovementInBackend,
  patchMovementInBackend,
  patchPartyInBackend,
  patchProductInBackend,
  patchPurchaseInBackend,
  patchReminderLogInBackend,
  patchReminderTemplateInBackend,
  patchReportInBackend,
  patchRoleInBackend,
  patchSaleInBackend,
  patchSettingsInBackend,
  patchSupplierInBackend,
  patchSyncOperationInBackend,
  patchUserRoleInBackend,
  type BackendBootstrap,
} from '@/lib/api';
import {
  emptySettings,
  planLimits,
  systemWorkspaceRoles,
  type AppLanguage,
  type Account,
  type AuditLog,
  type BillScan,
  type BillingRecord,
  type Business,
  type CashBankAccount,
  type CashBankAccountType,
  type Customer,
  type CreditLedgerEntry,
  type CustomerSegment,
  type DocumentAttachment,
  type Expense,
  type GeneratedReport,
  type InventoryMovement,
  type InventoryProduct,
  type InvoiceTemplate,
  type JournalEntry,
  type MoneyMovement,
  type MoneyMovementType,
  type MovementReason,
  type Party,
  type PartyLedgerDirection,
  type PartyLedgerEntry,
  type PartyLedgerType,
  type PartyType,
  type PaymentMethod,
  type FeatureFlag,
  type PermissionKey,
  type PlanType,
  type PlatformOrganization,
  type Purchase,
  type PurchaseLineItem,
  type PurchaseStatus,
  type ReminderLog,
  type ReminderTemplate,
  type ReportTemplate,
  type Sale,
  type SaleLineItem,
  type SaleStatus,
  type StockStatus,
  type SupportTicket,
  type Supplier,
  type SyncOperation,
  type TeamMember,
  type UserRole,
  type WorkspaceRole,
} from '@/lib/domain';
import { daysBetween } from '@/lib/utils';

export type Theme = 'dark' | 'light';
export type BackendStatus = 'idle' | 'online' | 'offline';
export type ActivePage =
  | 'dashboard'
  | 'quick-add'
  | 'scan-bill'
  | 'sales'
  | 'purchases'
  | 'expenses'
  | 'analytics'
  | 'parties'
  | 'customers'
  | 'inventory'
  | 'cash-bank'
  | 'accounting'
  | 'documents'
  | 'reminders'
  | 'reports'
  | 'team'
  | 'billing'
  | 'settings';

export interface UserSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface NewSaleInput {
  customerId?: string;
  customerName: string;
  customerContact: string;
  date: string;
  payment: PaymentMethod;
  status: SaleStatus;
  invoiceType?: Sale['invoiceType'];
  buyerPan?: string;
  creditDueDate?: string;
  notes?: string;
  items: Array<{
    productId: string;
    quantity: number;
    discount: number;
    tax: number;
  }>;
}

export interface NewCustomerInput {
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  tags: string[];
}

export interface PartyInput {
  name: string;
  type: PartyType;
  phone: string;
  email: string;
  address: string;
  pan: string;
  openingBalance: number;
  creditLimit: number;
  dueDays: number;
  notes: string;
}

export interface SupplierInput {
  name: string;
  phone: string;
  email: string;
  address: string;
  pan: string;
  contactPerson: string;
  payableBalance: number;
  notes: string;
}

export interface NewInventoryInput {
  name: string;
  sku: string;
  category: string;
  unit: string;
  stock: number;
  reorderLevel: number;
  price: number;
  costPrice: number;
  supplier: string;
}

export interface StockMovementInput {
  productId: string;
  delta: number;
  reason: MovementReason;
  note: string;
}

export interface NewPurchaseInput {
  supplierId?: string;
  supplierName: string;
  billNo: string;
  date: string;
  dueDate: string;
  payment: PaymentMethod;
  status: PurchaseStatus;
  notes: string;
  items: Array<{
    productId: string;
    productName?: string;
    quantity: number;
    unitCost: number;
    discount: number;
    tax: number;
  }>;
}

export interface NewExpenseInput {
  category: string;
  vendor: string;
  amount: number;
  taxAmount: number;
  paymentAccountId: string;
  paymentMethod: PaymentMethod;
  date: string;
  recurring: boolean;
  note: string;
}

export interface CashBankAccountInput {
  name: string;
  type: CashBankAccountType;
  institution: string;
  accountNumber: string;
  openingBalance: number;
}

export interface MoneyMovementInput {
  accountId: string;
  type: MoneyMovementType;
  amount: number;
  date: string;
  partyId?: string;
  partyName?: string;
  referenceId?: string;
  note: string;
}

export interface DocumentInput {
  name: string;
  recordType: DocumentAttachment['recordType'];
  recordId: string;
  fileName: string;
  mimeType: string;
  size: number;
  dataUrl?: string;
}

export interface ReportInput {
  title: string;
  type: GeneratedReport['type'];
  template: ReportTemplate;
  range: string;
  scheduled?: boolean;
}

export interface RoleInput {
  name: string;
  description: string;
  permissions: PermissionKey[];
}

export interface AppSettings {
  businessName: string;
  panVatNumber: string;
  currency: 'NPR' | 'USD' | 'EUR';
  language: AppLanguage;
  timezone: string;
  fiscalYearStart: 'January' | 'April' | 'July' | 'October';
  dateFormat: string;
  numberFormat: string;
  taxRate: number;
  invoicePrefix: string;
  receiptFooter: string;
  defaultPaymentMethod: PaymentMethod;
  compactTables: boolean;
  lowStockAlerts: boolean;
  dailySalesSummary: boolean;
  newCustomerSignup: boolean;
  twoFactorEnabled: boolean;
  scheduledReports: boolean;
}

export const pagePermissionMap: Record<ActivePage, PermissionKey> = {
  dashboard: 'dashboard.view',
  'quick-add': 'sales.create',
  'scan-bill': 'expenses.view',
  sales: 'sales.view',
  purchases: 'purchases.view',
  expenses: 'expenses.view',
  analytics: 'analytics.view',
  parties: 'parties.view',
  customers: 'customers.view',
  inventory: 'inventory.view',
  'cash-bank': 'cashbank.view',
  accounting: 'accounting.view',
  documents: 'documents.view',
  reminders: 'reminders.manage',
  reports: 'reports.view',
  team: 'team.view',
  billing: 'billing.manage',
  settings: 'settings.manage',
};

interface AppState {
  theme: Theme;
  toggleTheme: () => void;
  activePage: ActivePage;
  setActivePage: (page: ActivePage) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  globalSearch: string;
  setGlobalSearch: (value: string) => void;

  isAuthenticated: boolean;
  currentUser: CurrentUser;
  session: UserSession | null;
  completeAuth: (user: CurrentUser, session: UserSession, bootstrap: BackendBootstrap, notice?: string) => void;
  logout: () => void;
  deleteAccount: () => void;

  plan: PlanType;
  billingCycle: 'monthly' | 'annual';
  trialEndsAt: string;
  businesses: Business[];
  activeBusinessId: string;
  switchBusiness: (businessId: string) => void;
  addBusiness: (name: string, category: string, address: string) => boolean;

  teamMembers: TeamMember[];
  roleDefinitions: WorkspaceRole[];
  sales: Sale[];
  parties: Party[];
  partyLedger: PartyLedgerEntry[];
  purchases: Purchase[];
  expenses: Expense[];
  expenseCategories: string[];
  cashBankAccounts: CashBankAccount[];
  moneyMovements: MoneyMovement[];
  journalEntries: JournalEntry[];
  accounts: Account[];
  invoiceTemplates: InvoiceTemplate[];
  documents: DocumentAttachment[];
  billScans: BillScan[];
  reminderTemplates: ReminderTemplate[];
  reminderLogs: ReminderLog[];
  syncOperations: SyncOperation[];
  customers: Customer[];
  suppliers: Supplier[];
  creditLedger: CreditLedgerEntry[];
  inventory: InventoryProduct[];
  inventoryCategories: string[];
  inventoryMovements: InventoryMovement[];
  reports: GeneratedReport[];
  auditLogs: AuditLog[];
  billingHistory: BillingRecord[];
  platformOrganizations: PlatformOrganization[];
  featureFlags: FeatureFlag[];
  supportTickets: SupportTicket[];
  settings: AppSettings;
  lastNotice: string | null;
  backendStatus: BackendStatus;
  backendMessage: string;
  clearNotice: () => void;
  hydrateFromBackend: (payload: BackendBootstrap) => void;
  markBackendOffline: (message: string) => void;
  hasPermission: (permission: PermissionKey) => boolean;
  canAccessPage: (page: ActivePage) => boolean;

  addSale: (input: NewSaleInput) => boolean;
  updateSale: (saleId: string, patch: Partial<Sale>) => void;
  updateSaleStatus: (saleId: string, status: SaleStatus) => boolean;
  softDeleteSale: (saleId: string) => boolean;
  importSales: (sales: Sale[]) => void;
  addParty: (input: PartyInput) => boolean;
  updateParty: (partyId: string, patch: Partial<Party>) => void;
  deleteParty: (partyId: string) => boolean;
  recordPartyLedgerEntry: (partyId: string, type: PartyLedgerType, direction: PartyLedgerDirection, amount: number, note: string) => boolean;
  addPurchase: (input: NewPurchaseInput) => boolean;
  updatePurchase: (purchaseId: string, patch: Partial<Purchase>) => void;
  deletePurchase: (purchaseId: string) => boolean;
  recordSupplierPayment: (supplierId: string, amount: number, paymentMethod: PaymentMethod, note: string) => boolean;
  addExpense: (input: NewExpenseInput) => boolean;
  updateExpense: (expenseId: string, patch: Partial<Expense>) => void;
  deleteExpense: (expenseId: string) => boolean;
  addExpenseCategory: (name: string) => boolean;
  renameExpenseCategory: (oldName: string, newName: string) => boolean;
  deleteExpenseCategory: (name: string) => boolean;
  addCashBankAccount: (input: CashBankAccountInput) => boolean;
  updateCashBankAccount: (accountId: string, patch: Partial<CashBankAccount>) => void;
  deleteCashBankAccount: (accountId: string) => boolean;
  recordMoneyMovement: (input: MoneyMovementInput) => boolean;
  updateMoneyMovement: (movementId: string, patch: Partial<MoneyMovement>) => void;
  deleteMoneyMovement: (movementId: string) => boolean;
  addDocument: (input: DocumentInput) => boolean;
  updateDocument: (documentId: string, patch: Partial<DocumentAttachment>) => void;
  deleteDocument: (documentId: string) => boolean;
  createReminderTemplate: (template: Omit<ReminderTemplate, 'id'>) => boolean;
  updateReminderTemplate: (templateId: string, patch: Partial<ReminderTemplate>) => void;
  deleteReminderTemplate: (templateId: string) => boolean;
  sendReminder: (partyId: string, channel: ReminderLog['channel'], message: string, amount: number, dueDate: string) => boolean;
  updateReminderLog: (logId: string, patch: Partial<ReminderLog>) => void;
  deleteReminderLog: (logId: string) => boolean;
  queueSyncOperation: (operation: Omit<SyncOperation, 'id' | 'createdAt' | 'status'>) => void;
  updateSyncOperation: (operationId: string, patch: Partial<SyncOperation>) => void;
  deleteSyncOperation: (operationId: string) => boolean;
  addCustomer: (input: NewCustomerInput) => boolean;
  updateCustomer: (customerId: string, patch: Partial<Customer>) => void;
  deleteCustomer: (customerId: string) => boolean;
  addSupplier: (input: SupplierInput) => boolean;
  updateSupplier: (supplierId: string, patch: Partial<Supplier>) => void;
  deleteSupplier: (supplierId: string) => boolean;
  recordCreditPayment: (customerId: string, amount: number, paymentMethod: PaymentMethod, note: string) => boolean;
  updateCreditEntry: (entryId: string, patch: Partial<CreditLedgerEntry>) => void;
  deleteCreditEntry: (entryId: string) => boolean;
  addInventoryProduct: (input: NewInventoryInput) => boolean;
  updateInventoryProduct: (productId: string, patch: Partial<InventoryProduct>) => void;
  deleteInventoryProduct: (productId: string) => boolean;
  addInventoryCategory: (name: string) => boolean;
  renameInventoryCategory: (oldName: string, newName: string) => boolean;
  deleteInventoryCategory: (name: string) => boolean;
  recordStockMovement: (input: StockMovementInput) => boolean;
  updateStockMovement: (movementId: string, patch: Partial<InventoryMovement>) => void;
  deleteStockMovement: (movementId: string) => boolean;
  generateReport: (input: ReportInput) => boolean;
  updateReport: (reportId: string, patch: Partial<GeneratedReport>) => void;
  deleteReport: (reportId: string) => boolean;
  upgradePlan: (gateway: BillingRecord['gateway'], cycle: 'monthly' | 'annual') => void;
  downgradePlan: () => void;
  inviteUser: (name: string, email: string, role: UserRole) => boolean;
  updateUserRole: (userId: string, role: UserRole) => void;
  removeUser: (userId: string) => void;
  createRole: (input: RoleInput) => boolean;
  updateRole: (roleId: string, patch: Partial<WorkspaceRole>) => void;
  deleteRole: (roleId: string) => boolean;
  updateSettings: (patch: Partial<AppSettings>) => void;
  setLanguage: (language: AppLanguage) => void;
}

export const paymentMethods: PaymentMethod[] = ['Cash', 'Card', 'eSewa', 'FonePay', 'Khalti', 'Bank', 'Credit'];
export const saleStatuses: SaleStatus[] = ['Completed', 'Pending', 'Refunded'];
export const userRoles: UserRole[] = systemWorkspaceRoles.map((role) => role.name);
export const reportTemplates: ReportTemplate[] = ['Minimal', 'Detailed', 'Executive'];
const defaultInventoryCategories = ['General', 'Dairy', 'Grocery', 'Beverage', 'Household'];
export const defaultExpenseCategories = ['Rent', 'Salary', 'Transport', 'Utilities', 'Marketing', 'Repair', 'Miscellaneous'];

const seedAccounts = [
  { id: 'acct-cash', code: '1000', name: 'Cash', type: 'Asset' as const, system: true, active: true },
  { id: 'acct-bank', code: '1010', name: 'Bank', type: 'Asset' as const, system: true, active: true },
  { id: 'acct-ar', code: '1100', name: 'Accounts Receivable', type: 'Asset' as const, system: true, active: true },
  { id: 'acct-inventory', code: '1200', name: 'Inventory', type: 'Asset' as const, system: true, active: true },
  { id: 'acct-ap', code: '2000', name: 'Accounts Payable', type: 'Liability' as const, system: true, active: true },
  { id: 'acct-vat', code: '2100', name: 'VAT Payable', type: 'Liability' as const, system: true, active: true },
  { id: 'acct-capital', code: '3000', name: 'Capital', type: 'Equity' as const, system: true, active: true },
  { id: 'acct-sales', code: '4000', name: 'Sales Revenue', type: 'Income' as const, system: true, active: true },
  { id: 'acct-purchases', code: '5000', name: 'Purchases', type: 'Expense' as const, system: true, active: true },
  { id: 'acct-expenses', code: '5100', name: 'Operating Expenses', type: 'Expense' as const, system: true, active: true },
];

function inventoryCategoriesFrom(categories: string[], inventory: InventoryProduct[] = []) {
  const names = [...defaultInventoryCategories, ...categories, ...inventory.map((product) => product.category)]
    .map((name) => name.trim())
    .filter(Boolean);
  return Array.from(new Map(names.map((name) => [name.toLowerCase(), name])).values())
    .sort((a, b) => a.localeCompare(b));
}

function expenseCategoriesFrom(categories: string[], expenses: Expense[] = []) {
  const names = [...defaultExpenseCategories, ...categories, ...expenses.map((expense) => expense.category)]
    .map((name) => name.trim())
    .filter(Boolean);
  return Array.from(new Map(names.map((name) => [name.toLowerCase(), name])).values())
    .sort((a, b) => a.localeCompare(b));
}

export function getStockStatus(stock: number, reorderLevel: number): StockStatus {
  if (stock <= 0) return 'Out of Stock';
  if (stock <= reorderLevel) return 'Low Stock';
  return 'In Stock';
}

export function canUseProFeature(plan: PlanType): boolean {
  return plan === 'pro';
}

export function permissionsForRole(roleDefinitions: WorkspaceRole[], roleName: UserRole): PermissionKey[] {
  const role = roleDefinitions.find((item) => item.name === roleName);
  return role?.permissions ?? [];
}

export function roleCan(roleDefinitions: WorkspaceRole[], roleName: UserRole, permission: PermissionKey): boolean {
  if (roleName === 'Owner') return true;
  return permissionsForRole(roleDefinitions, roleName).includes(permission);
}

function nowStamp() {
  return new Date().toLocaleString('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString().slice(-6)}`;
}

function saleTotal(items: SaleLineItem[], status: SaleStatus) {
  if (status === 'Refunded') return 0;
  return items.reduce((sum, item) => {
    return sum + item.quantity * item.unitPrice - item.discount + item.tax;
  }, 0);
}

function addAudit(state: AppState, action: string, module: string, detail: string): AuditLog[] {
  return [
    {
      id: makeId('AUD'),
      user: state.currentUser.name,
      action,
      module,
      detail,
      createdAt: nowStamp(),
    },
    ...state.auditLogs,
  ].slice(0, 100);
}

function segmentCustomer(totalSpent: number, orders: number, lastOrder: string): CustomerSegment {
  if (totalSpent >= 200000 || orders >= 6) return 'VIP';
  if (daysBetween(lastOrder, today()) > 21) return 'At-Risk';
  if (orders >= 3) return 'Regular';
  return 'Occasional';
}

function recalculateCustomers(customers: Customer[], sales: Sale[]): Customer[] {
  const completed = sales.filter((sale) => !sale.deletedAt && sale.status === 'Completed');

  return customers.map((customer) => {
    const customerSales = completed.filter((sale) => sale.customerId === customer.id);
    if (!customerSales.length) return customer;

    const totalSpent = customerSales.reduce((sum, sale) => sum + sale.amount, 0);
    const orders = customerSales.length;
    const lastOrder = customerSales
      .map((sale) => sale.date)
      .sort()
      .at(-1) ?? customer.lastOrder;

    return {
      ...customer,
      totalSpent,
      orders,
      lastOrder,
      segment: segmentCustomer(totalSpent, orders, lastOrder),
    };
  });
}

function creditBalanceFor(customerId: string, ledger: CreditLedgerEntry[]) {
  return ledger
    .filter((entry) => entry.customerId === customerId)
    .reduce((sum, entry) => {
      if (entry.type === 'Payment Received') return sum - entry.amount;
      return sum + entry.amount;
    }, 0);
}

function applyCreditBalances(customers: Customer[], ledger: CreditLedgerEntry[]): Customer[] {
  return customers.map((customer) => ({
    ...customer,
    balance: Math.max(0, creditBalanceFor(customer.id, ledger)),
  }));
}

function partyBalanceFor(partyId: string, ledger: PartyLedgerEntry[]) {
  return ledger
    .filter((entry) => entry.partyId === partyId)
    .reduce((sum, entry) => {
      const signed = entry.type === 'Payment Received' || entry.type === 'Payment Paid'
        ? -entry.amount
        : entry.amount;
      return sum + signed;
    }, 0);
}

function applyPartyBalances(parties: Party[], ledger: PartyLedgerEntry[]): Party[] {
  return parties.map((party) => ({
    ...party,
    balance: Math.max(0, party.openingBalance + partyBalanceFor(party.id, ledger)),
  }));
}

function applyCashBankBalance(accounts: CashBankAccount[], movement: MoneyMovement): CashBankAccount[] {
  return accounts.map((account) => {
    if (account.id !== movement.accountId) return account;
    const positive = movement.type === 'Receipt' || movement.type === 'Deposit';
    const negative = movement.type === 'Payment' || movement.type === 'Withdrawal';
    const delta = positive ? movement.amount : negative ? -movement.amount : 0;
    return { ...account, balance: Math.max(0, account.balance + delta), updatedAt: nowStamp() };
  });
}

function journalFromSale(sale: Sale): JournalEntry {
  const paid = sale.payment !== 'Credit';
  return {
    id: makeId('JRN'),
    date: sale.date,
    source: 'Sale',
    sourceId: sale.id,
    memo: `${sale.invoiceNo ?? sale.id} - ${sale.customer}`,
    locked: false,
    createdBy: sale.createdBy,
    createdAt: nowStamp(),
    lines: [
      { accountId: paid ? 'acct-cash' : 'acct-ar', accountName: paid ? 'Cash / Bank' : 'Accounts Receivable', debit: sale.amount, credit: 0 },
      { accountId: 'acct-sales', accountName: 'Sales Revenue', debit: 0, credit: Math.max(0, sale.amount - (sale.vatAmount ?? sale.taxTotal ?? 0)) },
      { accountId: 'acct-vat', accountName: 'VAT Payable', debit: 0, credit: sale.vatAmount ?? sale.taxTotal ?? 0 },
    ],
  };
}

function journalFromPurchase(purchase: Purchase): JournalEntry {
  return {
    id: makeId('JRN'),
    date: purchase.date,
    source: 'Purchase',
    sourceId: purchase.id,
    memo: `${purchase.billNo} - ${purchase.supplierName}`,
    locked: false,
    createdBy: purchase.createdBy,
    createdAt: nowStamp(),
    lines: [
      { accountId: 'acct-purchases', accountName: 'Purchases / Inventory', debit: Math.max(0, purchase.amount - purchase.taxTotal), credit: 0 },
      { accountId: 'acct-vat', accountName: 'VAT Input', debit: purchase.taxTotal, credit: 0 },
      { accountId: purchase.payment === 'Credit' ? 'acct-ap' : 'acct-cash', accountName: purchase.payment === 'Credit' ? 'Accounts Payable' : 'Cash / Bank', debit: 0, credit: purchase.amount },
    ],
  };
}

function journalFromExpense(expense: Expense): JournalEntry {
  return {
    id: makeId('JRN'),
    date: expense.date,
    source: 'Expense',
    sourceId: expense.id,
    memo: `${expense.category} - ${expense.vendor || 'Expense'}`,
    locked: false,
    createdBy: expense.createdBy,
    createdAt: nowStamp(),
    lines: [
      { accountId: 'acct-expenses', accountName: 'Operating Expenses', debit: Math.max(0, expense.amount - expense.taxAmount), credit: 0 },
      { accountId: 'acct-vat', accountName: 'VAT Input', debit: expense.taxAmount, credit: 0 },
      { accountId: 'acct-cash', accountName: 'Cash / Bank', debit: 0, credit: expense.amount },
    ],
  };
}

function applyInventoryDelta(inventory: InventoryProduct[], productId: string, delta: number): InventoryProduct[] {
  return inventory.map((product) => {
    if (product.id !== productId) return product;
    const stock = Math.max(0, product.stock + delta);
    return {
      ...product,
      stock,
      status: getStockStatus(stock, product.reorderLevel),
    };
  });
}

function activeMonthSalesCount(sales: Sale[]) {
  const month = today().slice(0, 7);
  return sales.filter((sale) => !sale.deletedAt && sale.date.startsWith(month)).length;
}

const ownerUser: CurrentUser = {
  id: '',
  name: '',
  email: '',
  role: 'Owner',
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      activePage: 'dashboard',
      setActivePage: (page) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, pagePermissionMap[page])) {
          set({ lastNotice: 'You do not have permission to open that module.' });
          return;
        }
        set({ activePage: page });
      },
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      globalSearch: '',
      setGlobalSearch: (value) => set({ globalSearch: value }),

      isAuthenticated: false,
      currentUser: ownerUser,
      session: null,

      plan: 'free',
      billingCycle: 'monthly',
      trialEndsAt: '',
      businesses: [],
      activeBusinessId: '',

      teamMembers: [],
      roleDefinitions: systemWorkspaceRoles,
      sales: [],
      parties: [],
      partyLedger: [],
      purchases: [],
      expenses: [],
      expenseCategories: defaultExpenseCategories,
      cashBankAccounts: [
        {
          id: 'cash-main',
          name: 'Shop cash',
          type: 'Cash',
          institution: '',
          accountNumber: '',
          openingBalance: 0,
          balance: 0,
          active: true,
          createdAt: nowStamp(),
        },
      ],
      moneyMovements: [],
      journalEntries: [],
      accounts: seedAccounts,
      invoiceTemplates: [
        {
          id: 'tpl-a4',
          name: 'Nepal A4 bill',
          format: 'A4',
          showLogo: true,
          footer: emptySettings.receiptFooter,
          terms: 'Goods once sold can be returned only with bill.',
          isDefault: true,
        },
        {
          id: 'tpl-thermal',
          name: 'Thermal receipt',
          format: 'Thermal',
          showLogo: false,
          footer: emptySettings.receiptFooter,
          terms: '',
          isDefault: false,
        },
      ],
      documents: [],
      billScans: [],
      reminderTemplates: [],
      reminderLogs: [],
      syncOperations: [],
      customers: [],
      suppliers: [],
      creditLedger: [],
      inventory: [],
      inventoryCategories: defaultInventoryCategories,
      inventoryMovements: [],
      reports: [],
      auditLogs: [],
      billingHistory: [],
      platformOrganizations: [],
      featureFlags: [],
      supportTickets: [],
      settings: emptySettings,
      lastNotice: null,
      backendStatus: 'idle',
      backendMessage: 'Backend has not been checked yet.',
      clearNotice: () => set({ lastNotice: null }),
      hydrateFromBackend: (payload) => set((state) => {
        const syncedMember = payload.teamMembers.find((member) => member.email.toLowerCase() === state.currentUser.email.toLowerCase());
        return {
          plan: payload.plan ?? state.plan,
          billingCycle: payload.billingCycle ?? state.billingCycle,
          trialEndsAt: payload.trialEndsAt ?? state.trialEndsAt,
          businesses: payload.businesses.length ? payload.businesses : state.businesses,
          activeBusinessId: payload.activeBusinessId || payload.businesses[0]?.id || state.activeBusinessId,
          teamMembers: payload.teamMembers.length ? payload.teamMembers : state.teamMembers,
          roleDefinitions: payload.roleDefinitions?.length ? payload.roleDefinitions : state.roleDefinitions,
          currentUser: syncedMember
            ? {
                id: syncedMember.id,
                name: syncedMember.name,
                email: syncedMember.email,
                role: syncedMember.role,
              }
            : state.currentUser,
          sales: payload.sales,
          parties: applyPartyBalances(payload.parties ?? state.parties, payload.partyLedger ?? state.partyLedger),
          partyLedger: payload.partyLedger ?? state.partyLedger,
          purchases: payload.purchases ?? state.purchases,
          expenses: payload.expenses ?? state.expenses,
          expenseCategories: expenseCategoriesFrom([...(state.expenseCategories ?? []), ...(payload.expenseCategories ?? [])], payload.expenses ?? state.expenses),
          cashBankAccounts: payload.cashBankAccounts ?? state.cashBankAccounts,
          moneyMovements: payload.moneyMovements ?? state.moneyMovements,
          journalEntries: payload.journalEntries ?? state.journalEntries,
          documents: payload.documents ?? state.documents,
          billScans: payload.billScans ?? state.billScans,
          reminderTemplates: payload.reminderTemplates ?? state.reminderTemplates,
          reminderLogs: payload.reminderLogs ?? state.reminderLogs,
          syncOperations: payload.syncOperations ?? state.syncOperations,
          customers: applyCreditBalances(payload.customers, payload.creditLedger ?? state.creditLedger),
          suppliers: payload.suppliers ?? state.suppliers,
          creditLedger: payload.creditLedger ?? state.creditLedger,
          inventory: payload.inventory,
          inventoryCategories: inventoryCategoriesFrom([...(state.inventoryCategories ?? []), ...(payload.inventoryCategories ?? [])], payload.inventory),
          inventoryMovements: payload.inventoryMovements,
          reports: payload.reports,
          auditLogs: payload.auditLogs,
          billingHistory: payload.billingHistory,
          platformOrganizations: payload.platformOrganizations,
          featureFlags: payload.featureFlags,
          supportTickets: payload.supportTickets,
          settings: payload.settings,
          backendStatus: 'online',
          backendMessage: 'Connected to MongoDB API at http://localhost:8000/api.',
        };
      }),
      completeAuth: (user, session, bootstrap, notice) => set((state) => {
        const syncedMember = bootstrap.teamMembers.find((member) => member.email.toLowerCase() === user.email.toLowerCase());
        return {
          isAuthenticated: true,
          currentUser: {
            id: syncedMember?.id ?? user.id,
            name: syncedMember?.name ?? user.name,
            email: syncedMember?.email ?? user.email,
            role: syncedMember?.role ?? user.role,
          },
          session,
          plan: bootstrap.plan ?? state.plan,
          billingCycle: bootstrap.billingCycle ?? state.billingCycle,
          trialEndsAt: bootstrap.trialEndsAt ?? state.trialEndsAt,
          businesses: bootstrap.businesses,
          activeBusinessId: bootstrap.activeBusinessId || bootstrap.businesses[0]?.id || '',
          teamMembers: bootstrap.teamMembers,
          roleDefinitions: bootstrap.roleDefinitions?.length ? bootstrap.roleDefinitions : systemWorkspaceRoles,
          sales: bootstrap.sales,
          parties: applyPartyBalances(bootstrap.parties ?? [], bootstrap.partyLedger ?? []),
          partyLedger: bootstrap.partyLedger ?? [],
          purchases: bootstrap.purchases ?? [],
          expenses: bootstrap.expenses ?? [],
          expenseCategories: expenseCategoriesFrom([...(state.expenseCategories ?? []), ...(bootstrap.expenseCategories ?? [])], bootstrap.expenses ?? []),
          cashBankAccounts: bootstrap.cashBankAccounts?.length ? bootstrap.cashBankAccounts : state.cashBankAccounts,
          moneyMovements: bootstrap.moneyMovements ?? [],
          journalEntries: bootstrap.journalEntries ?? [],
          documents: bootstrap.documents ?? [],
          billScans: bootstrap.billScans ?? [],
          reminderTemplates: bootstrap.reminderTemplates ?? [],
          reminderLogs: bootstrap.reminderLogs ?? [],
          syncOperations: bootstrap.syncOperations ?? [],
          customers: applyCreditBalances(bootstrap.customers, bootstrap.creditLedger ?? []),
          suppliers: bootstrap.suppliers ?? [],
          creditLedger: bootstrap.creditLedger ?? [],
          inventory: bootstrap.inventory,
          inventoryCategories: inventoryCategoriesFrom([...(state.inventoryCategories ?? []), ...(bootstrap.inventoryCategories ?? [])], bootstrap.inventory),
          inventoryMovements: bootstrap.inventoryMovements,
          reports: bootstrap.reports,
          auditLogs: bootstrap.auditLogs,
          billingHistory: bootstrap.billingHistory,
          platformOrganizations: bootstrap.platformOrganizations,
          featureFlags: bootstrap.featureFlags,
          supportTickets: bootstrap.supportTickets,
          settings: bootstrap.settings,
          activePage: 'dashboard',
          backendStatus: 'online',
          backendMessage: 'Connected to backend API.',
          lastNotice: notice ?? `Welcome, ${syncedMember?.name ?? user.name}.`,
        };
      }),
      markBackendOffline: (message) => set({
        backendStatus: 'offline',
        backendMessage: message,
      }),
      hasPermission: (permission) => {
        const state = get();
        return roleCan(state.roleDefinitions, state.currentUser.role, permission);
      },
      canAccessPage: (page) => {
        const state = get();
        return roleCan(state.roleDefinitions, state.currentUser.role, pagePermissionMap[page]);
      },

      logout: () => {
        const session = get().session;
        void logoutFromBackend(session?.refreshToken).catch(() => undefined);
        set((state) => ({
          isAuthenticated: false,
          session: null,
          auditLogs: addAudit(state, 'Logged out', 'Auth', `${state.currentUser.email} ended the session.`),
          lastNotice: 'You have been logged out.',
        }));
      },

      deleteAccount: () => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'account.delete')) {
          set({ lastNotice: 'You need Delete account permission for this action.' });
          return;
        }
        set((current) => ({
          isAuthenticated: false,
          session: null,
          plan: 'free',
          sales: [],
          parties: [],
          partyLedger: [],
          purchases: [],
          expenses: [],
          expenseCategories: defaultExpenseCategories,
          moneyMovements: [],
          journalEntries: [],
          documents: [],
          billScans: [],
          reminderTemplates: [],
          reminderLogs: [],
          syncOperations: [],
          customers: [],
          suppliers: [],
          creditLedger: [],
          inventory: [],
          inventoryCategories: defaultInventoryCategories,
          reports: [],
          inventoryMovements: [],
          auditLogs: addAudit(current, 'Deleted account data', 'Settings', 'Workspace data cleared.'),
          lastNotice: 'Workspace data cleared.',
        }));
      },

      switchBusiness: (businessId) => set((state) => {
        const business = state.businesses.find((item) => item.id === businessId);
        return {
          activeBusinessId: businessId,
          settings: business ? { ...state.settings, businessName: business.name } : state.settings,
          lastNotice: business ? `Switched to ${business.name}.` : null,
        };
      }),

      addBusiness: (name, category, address) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'settings.manage')) {
          set({ lastNotice: 'You need Manage settings permission to add businesses.' });
          return false;
        }
        if (state.plan !== 'pro') {
          set({ lastNotice: 'Multi-business accounts are available on Pro.' });
          return false;
        }

        set((state) => ({
          businesses: [
            ...state.businesses,
            {
              id: makeId('BIZ'),
              name: name.trim(),
              category: category.trim() || 'Retail',
              address: address.trim() || 'Nepal',
            },
          ],
          auditLogs: addAudit(state, 'Added business', 'Settings', `${name} was added to the account.`),
          lastNotice: `${name} added.`,
        }));
        return true;
      },

      addSale: (input) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'sales.create')) {
          set({ lastNotice: 'You need Create sales permission to record sales.' });
          return false;
        }
        if (state.plan === 'free' && activeMonthSalesCount(state.sales) >= planLimits.salesEntries) {
          set({ lastNotice: 'Free plan limit reached: 100 sales entries this month. Upgrade to Pro for unlimited sales.' });
          return false;
        }

        const lineItems = input.items
          .map((item) => {
            const product = state.inventory.find((entry) => entry.id === item.productId);
            if (!product) return null;
            return {
              productId: product.id,
              productName: product.name,
              quantity: Math.max(0.01, item.quantity),
              unitPrice: product.price,
              discount: Math.max(0, item.discount),
              tax: Math.max(0, item.tax),
              sku: product.sku,
              unit: product.unit ?? 'pcs',
              costPrice: product.costPrice,
            };
          })
          .filter(Boolean) as SaleLineItem[];

        if (!lineItems.length) {
          set({ lastNotice: 'Add at least one product before confirming the sale.' });
          return false;
        }

        const existingCustomer = input.customerId
          ? state.customers.find((customer) => customer.id === input.customerId)
          : state.customers.find((customer) => customer.name.toLowerCase() === input.customerName.trim().toLowerCase());

        if (!existingCustomer && state.plan === 'free' && state.customers.length >= planLimits.customerProfiles) {
          set({ lastNotice: 'Free plan limit reached: 50 customer profiles. Upgrade to Pro for unlimited CRM.' });
          return false;
        }

        const customer: Customer = existingCustomer ?? {
          id: makeId('CUST'),
          name: input.customerName.trim(),
          email: input.customerContact.includes('@') ? input.customerContact.trim() : '',
          phone: input.customerContact.includes('@') ? '' : input.customerContact.trim(),
          address: '',
          notes: 'Created from sale entry.',
          tags: ['new'],
          totalSpent: 0,
          orders: 0,
          lastOrder: input.date,
          segment: 'Occasional',
          birthday: '',
        };

        const sale: Sale = {
          id: makeId('ORD'),
          customerId: customer.id,
          customer: customer.name,
          products: lineItems.map((item) => `${item.productName} x ${item.quantity}${item.unit ? ` ${item.unit}` : ''}`).join(', '),
          items: lineItems,
          amount: saleTotal(lineItems, input.status),
          payment: input.payment,
          status: input.status,
          date: input.date,
          createdBy: state.currentUser.name,
          invoiceNo: `${state.settings.invoicePrefix || 'RP'}-${Date.now().toString().slice(-6)}`,
          invoiceType: input.invoiceType ?? 'Tax Invoice',
          buyerPan: input.buyerPan?.trim() ?? '',
          creditDueDate: input.payment === 'Credit' ? input.creditDueDate : undefined,
          notes: input.notes?.trim() ?? '',
          subtotal: lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
          discountTotal: lineItems.reduce((sum, item) => sum + item.discount, 0),
          taxTotal: lineItems.reduce((sum, item) => sum + item.tax, 0),
          taxableAmount: lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice - item.discount, 0),
          vatAmount: lineItems.reduce((sum, item) => sum + item.tax, 0),
          auditTrail: [`Created by ${state.currentUser.name} on ${nowStamp()}`],
        };

        let inventory = state.inventory;
        let inventoryMovements = state.inventoryMovements;
        if (input.status !== 'Refunded') {
          lineItems.forEach((item) => {
            inventory = applyInventoryDelta(inventory, item.productId, -item.quantity);
            inventoryMovements = [
              {
                id: makeId('MOV'),
                productId: item.productId,
                productName: item.productName,
                delta: -item.quantity,
                reason: 'Sale',
                note: sale.id,
                user: state.currentUser.name,
                createdAt: nowStamp(),
              },
              ...inventoryMovements,
            ];
          });
        }

        const creditEntry: CreditLedgerEntry | null = input.payment === 'Credit' && sale.status !== 'Refunded'
          ? {
              id: makeId('CRD'),
              customerId: customer.id,
              customerName: customer.name,
              saleId: sale.id,
              invoiceNo: sale.invoiceNo,
              type: 'Credit Sale',
              amount: sale.amount,
              date: input.date,
              dueDate: input.creditDueDate,
              paymentMethod: 'Credit',
              note: sale.products,
              createdBy: state.currentUser.name,
              createdAt: nowStamp(),
            }
          : null;

        const sales = [sale, ...state.sales];
        const creditLedger = creditEntry ? [creditEntry, ...state.creditLedger] : state.creditLedger;
        const customers = applyCreditBalances(recalculateCustomers(
          existingCustomer ? state.customers : [customer, ...state.customers],
          sales
        ), creditLedger);

        set({
          sales,
          customers,
          creditLedger,
          inventory,
          inventoryMovements,
          journalEntries: [journalFromSale(sale), ...state.journalEntries],
          auditLogs: addAudit(state, 'Created sale', 'Sales', `${sale.id} for ${customer.name}.`),
          lastNotice: `${sale.id} recorded successfully.`,
        });
        void createSaleInBackend(sale)
          .then((response) => set({
            inventory: response.bootstrap.inventory,
            customers: response.bootstrap.customers,
            creditLedger: response.bootstrap.creditLedger ?? get().creditLedger,
            journalEntries: response.bootstrap.journalEntries ?? get().journalEntries,
            backendStatus: 'online',
            backendMessage: 'Sale synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Sale is saved locally; backend sync failed.',
          }));
        return true;
      },

      updateSale: (saleId, patch) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'sales.update')) {
          set({ lastNotice: 'You need Update sales permission to edit sales.' });
          return;
        }
        const sale = state.sales.find((entry) => entry.id === saleId);
        if (!sale) return;
        const nextPatch = {
          ...patch,
          auditTrail: [`Edited by ${state.currentUser.name} on ${nowStamp()}`, ...sale.auditTrail],
          updatedAt: nowStamp(),
        };
        const sales = state.sales.map((entry) => (
          entry.id === saleId ? { ...entry, ...nextPatch } : entry
        ));
        set({
          sales,
          customers: recalculateCustomers(state.customers, sales),
          auditLogs: addAudit(state, 'Updated sale', 'Sales', `${saleId} edited.`),
          lastNotice: `${saleId} updated.`,
        });
        void patchSaleInBackend(saleId, nextPatch)
          .then(() => set({
            backendStatus: 'online',
            backendMessage: 'Sale update synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Sale update is saved locally; backend sync failed.',
          }));
      },

      addParty: (input) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'parties.manage')) {
          set({ lastNotice: 'You need Manage parties permission to add parties.' });
          return false;
        }
        const party: Party = {
          id: makeId('PTY'),
          name: input.name.trim() || 'Party',
          type: input.type,
          phone: input.phone.trim(),
          email: input.email.trim(),
          address: input.address.trim(),
          pan: input.pan.trim(),
          openingBalance: Math.max(0, input.openingBalance),
          creditLimit: Math.max(0, input.creditLimit),
          dueDays: Math.max(0, input.dueDays),
          notes: input.notes.trim(),
          balance: Math.max(0, input.openingBalance),
          createdAt: nowStamp(),
        };
        set((current) => ({
          parties: applyPartyBalances([party, ...current.parties], current.partyLedger),
          auditLogs: addAudit(current, 'Created party', 'Parties', `${party.name} added as ${party.type}.`),
          lastNotice: `${party.name} added.`,
        }));
        void createPartyInBackend(party)
          .then((response) => set({
            parties: applyPartyBalances(response.bootstrap.parties ?? get().parties, response.bootstrap.partyLedger ?? get().partyLedger),
            partyLedger: response.bootstrap.partyLedger ?? get().partyLedger,
            backendStatus: 'online',
            backendMessage: 'Party synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Party is saved locally; backend sync failed.',
          }));
        return true;
      },

      updateParty: (partyId, patch) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'parties.manage')) {
          set({ lastNotice: 'You need Manage parties permission to edit parties.' });
          return;
        }
        set((current) => ({
          parties: applyPartyBalances(
            current.parties.map((party) => party.id === partyId ? { ...party, ...patch, updatedAt: nowStamp() } : party),
            current.partyLedger
          ),
          auditLogs: addAudit(current, 'Updated party', 'Parties', `${partyId} changed.`),
          lastNotice: 'Party updated.',
        }));
        void patchPartyInBackend(partyId, patch)
          .then((response) => set({
            parties: applyPartyBalances(response.bootstrap.parties ?? get().parties, response.bootstrap.partyLedger ?? get().partyLedger),
            partyLedger: response.bootstrap.partyLedger ?? get().partyLedger,
            backendStatus: 'online',
            backendMessage: 'Party update synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Party update is saved locally; backend sync failed.',
          }));
      },

      deleteParty: (partyId) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'parties.manage')) {
          set({ lastNotice: 'You need Manage parties permission to delete parties.' });
          return false;
        }
        set((current) => ({
          parties: current.parties.filter((party) => party.id !== partyId),
          partyLedger: current.partyLedger.filter((entry) => entry.partyId !== partyId),
          auditLogs: addAudit(current, 'Deleted party', 'Parties', partyId),
          lastNotice: 'Party deleted.',
        }));
        void deletePartyInBackend(partyId)
          .then((response) => set({
            parties: response.bootstrap.parties ?? get().parties,
            partyLedger: response.bootstrap.partyLedger ?? get().partyLedger,
            backendStatus: 'online',
            backendMessage: 'Party deletion synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Party deletion is saved locally; backend sync failed.',
          }));
        return true;
      },

      recordPartyLedgerEntry: (partyId, type, direction, amount, note) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'parties.manage')) {
          set({ lastNotice: 'You need Manage parties permission to record ledger entries.' });
          return false;
        }
        const party = state.parties.find((item) => item.id === partyId);
        if (!party || amount <= 0) return false;
        const entry: PartyLedgerEntry = {
          id: makeId('PLG'),
          partyId,
          partyName: party.name,
          direction,
          type,
          amount,
          date: today(),
          note,
          createdBy: state.currentUser.name,
          createdAt: nowStamp(),
        };
        set((current) => {
          const ledger = [entry, ...current.partyLedger];
          return {
            partyLedger: ledger,
            parties: applyPartyBalances(current.parties, ledger),
            auditLogs: addAudit(current, 'Recorded party ledger', 'Parties', `${party.name}: ${type} ${amount}.`),
            lastNotice: 'Party ledger updated.',
          };
        });
        void createPartyLedgerEntryInBackend(entry)
          .then((response) => set({
            parties: applyPartyBalances(response.bootstrap.parties ?? get().parties, response.bootstrap.partyLedger ?? get().partyLedger),
            partyLedger: response.bootstrap.partyLedger ?? get().partyLedger,
            backendStatus: 'online',
            backendMessage: 'Party ledger synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Party ledger is saved locally; backend sync failed.',
          }));
        return true;
      },

      addPurchase: (input) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'purchases.manage')) {
          set({ lastNotice: 'You need Manage purchases permission to add purchases.' });
          return false;
        }
        const supplier = input.supplierId ? state.suppliers.find((item) => item.id === input.supplierId) : undefined;
        const items = input.items.map((item) => {
          const product = state.inventory.find((entry) => entry.id === item.productId);
          const quantity = Math.max(0.01, item.quantity);
          const unitCost = Math.max(0, item.unitCost);
          const discount = Math.max(0, item.discount);
          const tax = Math.max(0, item.tax);
          return {
            productId: product?.id ?? item.productId,
            productName: product?.name ?? item.productName ?? 'Purchase item',
            quantity,
            unit: product?.unit ?? 'pcs',
            unitCost,
            discount,
            tax,
            lineTotal: quantity * unitCost - discount + tax,
          };
        }) as PurchaseLineItem[];
        if (!items.length) {
          set({ lastNotice: 'Add at least one purchase item.' });
          return false;
        }
        const purchase: Purchase = {
          id: makeId('PUR'),
          supplierId: supplier?.id ?? input.supplierId ?? '',
          supplierName: (supplier?.name ?? input.supplierName.trim()) || 'Supplier',
          billNo: input.billNo.trim() || `PB-${Date.now().toString().slice(-6)}`,
          date: input.date,
          dueDate: input.dueDate,
          items,
          subtotal: items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0),
          discountTotal: items.reduce((sum, item) => sum + item.discount, 0),
          taxTotal: items.reduce((sum, item) => sum + item.tax, 0),
          amount: items.reduce((sum, item) => sum + item.lineTotal, 0),
          payment: input.payment,
          status: input.status,
          notes: input.notes.trim(),
          attachmentIds: [],
          createdBy: state.currentUser.name,
          createdAt: nowStamp(),
        };
        let inventory = state.inventory;
        let inventoryMovements = state.inventoryMovements;
        if (purchase.status === 'Received') {
          items.forEach((item) => {
            inventory = applyInventoryDelta(inventory, item.productId, item.quantity);
            inventoryMovements = [{
              id: makeId('MOV'),
              productId: item.productId,
              productName: item.productName,
              delta: item.quantity,
              reason: 'Purchase',
              note: purchase.billNo,
              user: state.currentUser.name,
              createdAt: nowStamp(),
              referenceId: purchase.id,
            }, ...inventoryMovements];
          });
        }
        const supplierPayable = purchase.payment === 'Credit' ? purchase.amount : 0;
        set((current) => ({
          purchases: [purchase, ...current.purchases],
          suppliers: supplierPayable && purchase.supplierId
            ? current.suppliers.map((item) => item.id === purchase.supplierId ? { ...item, payableBalance: item.payableBalance + supplierPayable } : item)
            : current.suppliers,
          inventory,
          inventoryMovements,
          journalEntries: [journalFromPurchase(purchase), ...current.journalEntries],
          auditLogs: addAudit(current, 'Created purchase', 'Purchases', `${purchase.billNo} for ${purchase.supplierName}.`),
          lastNotice: `${purchase.billNo} saved.`,
        }));
        void createPurchaseInBackend(purchase)
          .then((response) => set({
            purchases: response.bootstrap.purchases ?? get().purchases,
            suppliers: response.bootstrap.suppliers ?? get().suppliers,
            inventory: response.bootstrap.inventory,
            inventoryMovements: response.bootstrap.inventoryMovements,
            journalEntries: response.bootstrap.journalEntries ?? get().journalEntries,
            backendStatus: 'online',
            backendMessage: 'Purchase synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Purchase is saved locally; backend sync failed.',
          }));
        return true;
      },

      updatePurchase: (purchaseId, patch) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'purchases.manage')) {
          set({ lastNotice: 'You need Manage purchases permission to edit purchases.' });
          return;
        }
        set((current) => ({
          purchases: current.purchases.map((purchase) => purchase.id === purchaseId ? { ...purchase, ...patch, updatedAt: nowStamp() } : purchase),
          auditLogs: addAudit(current, 'Updated purchase', 'Purchases', purchaseId),
          lastNotice: 'Purchase updated.',
        }));
        void patchPurchaseInBackend(purchaseId, patch)
          .then((response) => set({
            purchases: response.bootstrap.purchases ?? get().purchases,
            backendStatus: 'online',
            backendMessage: 'Purchase update synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Purchase update is saved locally; backend sync failed.',
          }));
      },

      deletePurchase: (purchaseId) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'purchases.manage')) {
          set({ lastNotice: 'You need Manage purchases permission to delete purchases.' });
          return false;
        }
        set((current) => ({
          purchases: current.purchases.filter((purchase) => purchase.id !== purchaseId),
          auditLogs: addAudit(current, 'Deleted purchase', 'Purchases', purchaseId),
          lastNotice: 'Purchase deleted.',
        }));
        void deletePurchaseInBackend(purchaseId).catch(() => set({ backendStatus: 'offline', backendMessage: 'Purchase deletion is saved locally; backend sync failed.' }));
        return true;
      },

      recordSupplierPayment: (supplierId, amount, paymentMethod, note) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'purchases.manage')) {
          set({ lastNotice: 'You need Manage purchases permission to pay suppliers.' });
          return false;
        }
        const supplier = state.suppliers.find((item) => item.id === supplierId);
        if (!supplier || amount <= 0) return false;
        set((current) => ({
          suppliers: current.suppliers.map((item) => item.id === supplierId ? { ...item, payableBalance: Math.max(0, item.payableBalance - amount) } : item),
          auditLogs: addAudit(current, 'Paid supplier', 'Purchases', `${supplier.name}: ${amount} by ${paymentMethod}.`),
          lastNotice: 'Supplier payment saved.',
        }));
        void patchSupplierInBackend(supplierId, { payableBalance: Math.max(0, supplier.payableBalance - amount), notes: note || supplier.notes })
          .then(() => set({ backendStatus: 'online', backendMessage: 'Supplier payment synced to the backend database.' }))
          .catch(() => set({ backendStatus: 'offline', backendMessage: 'Supplier payment is saved locally; backend sync failed.' }));
        return true;
      },

      addExpense: (input) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'expenses.manage')) {
          set({ lastNotice: 'You need Manage expenses permission to add expenses.' });
          return false;
        }
        const account = state.cashBankAccounts.find((item) => item.id === input.paymentAccountId) ?? state.cashBankAccounts[0];
        const expense: Expense = {
          id: makeId('EXP'),
          category: input.category.trim() || 'Miscellaneous',
          vendor: input.vendor.trim(),
          amount: Math.max(0, input.amount),
          taxAmount: Math.max(0, input.taxAmount),
          paymentAccountId: account?.id ?? '',
          paymentMethod: input.paymentMethod,
          date: input.date,
          recurring: input.recurring,
          note: input.note.trim(),
          attachmentIds: [],
          createdBy: state.currentUser.name,
          createdAt: nowStamp(),
        };
        const movement: MoneyMovement | null = account ? {
          id: makeId('MOVM'),
          accountId: account.id,
          accountName: account.name,
          type: 'Payment',
          amount: expense.amount,
          date: expense.date,
          referenceId: expense.id,
          note: `${expense.category} ${expense.vendor}`.trim(),
          createdBy: state.currentUser.name,
          createdAt: nowStamp(),
        } : null;
        set((current) => ({
          expenses: [expense, ...current.expenses],
          moneyMovements: movement ? [movement, ...current.moneyMovements] : current.moneyMovements,
          cashBankAccounts: movement ? applyCashBankBalance(current.cashBankAccounts, movement) : current.cashBankAccounts,
          journalEntries: [journalFromExpense(expense), ...current.journalEntries],
          auditLogs: addAudit(current, 'Created expense', 'Expenses', `${expense.category}: ${expense.amount}.`),
          lastNotice: 'Expense saved.',
        }));
        void createExpenseInBackend(expense)
          .then((response) => set({
            expenses: response.bootstrap.expenses ?? get().expenses,
            moneyMovements: response.bootstrap.moneyMovements ?? get().moneyMovements,
            cashBankAccounts: response.bootstrap.cashBankAccounts ?? get().cashBankAccounts,
            journalEntries: response.bootstrap.journalEntries ?? get().journalEntries,
            backendStatus: 'online',
            backendMessage: 'Expense synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Expense is saved locally; backend sync failed.',
          }));
        return true;
      },

      updateExpense: (expenseId, patch) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'expenses.manage')) {
          set({ lastNotice: 'You need Manage expenses permission to edit expenses.' });
          return;
        }
        set((current) => ({
          expenses: current.expenses.map((expense) => expense.id === expenseId ? { ...expense, ...patch, updatedAt: nowStamp() } : expense),
          auditLogs: addAudit(current, 'Updated expense', 'Expenses', expenseId),
          lastNotice: 'Expense updated.',
        }));
        void patchExpenseInBackend(expenseId, patch).catch(() => set({ backendStatus: 'offline', backendMessage: 'Expense update is saved locally; backend sync failed.' }));
      },

      deleteExpense: (expenseId) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'expenses.manage')) {
          set({ lastNotice: 'You need Manage expenses permission to delete expenses.' });
          return false;
        }
        set((current) => ({
          expenses: current.expenses.filter((expense) => expense.id !== expenseId),
          auditLogs: addAudit(current, 'Deleted expense', 'Expenses', expenseId),
          lastNotice: 'Expense deleted.',
        }));
        void deleteExpenseInBackend(expenseId).catch(() => set({ backendStatus: 'offline', backendMessage: 'Expense deletion is saved locally; backend sync failed.' }));
        return true;
      },

      addExpenseCategory: (name) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'expenses.manage')) {
          set({ lastNotice: 'You need Manage expenses permission to edit categories.' });
          return false;
        }
        const cleanName = name.trim();
        if (!cleanName) {
          set({ lastNotice: 'Category name is required.' });
          return false;
        }
        if (state.expenseCategories.some((category) => category.toLowerCase() === cleanName.toLowerCase())) {
          set({ lastNotice: 'That expense category already exists.' });
          return false;
        }
        set((current) => ({
          expenseCategories: expenseCategoriesFrom([...current.expenseCategories, cleanName], current.expenses),
          auditLogs: addAudit(current, 'Created expense category', 'Expenses', cleanName),
          lastNotice: `${cleanName} category added.`,
        }));
        void createExpenseCategoryInBackend(cleanName)
          .then((response) => set((current) => ({
            expenseCategories: expenseCategoriesFrom([...current.expenseCategories, ...response.categories], current.expenses),
            backendStatus: 'online',
            backendMessage: 'Expense category synced to the backend database.',
          })))
          .catch(() => set({ backendStatus: 'offline', backendMessage: 'Expense category is saved locally; backend sync failed.' }));
        return true;
      },

      renameExpenseCategory: (oldName, newName) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'expenses.manage')) {
          set({ lastNotice: 'You need Manage expenses permission to edit categories.' });
          return false;
        }
        const cleanOldName = oldName.trim();
        const cleanNewName = newName.trim();
        if (!cleanOldName || !cleanNewName) {
          set({ lastNotice: 'Category name is required.' });
          return false;
        }
        if (cleanOldName.toLowerCase() !== cleanNewName.toLowerCase() && state.expenseCategories.some((category) => category.toLowerCase() === cleanNewName.toLowerCase())) {
          set({ lastNotice: 'That expense category already exists.' });
          return false;
        }
        const updatedExpenses = state.expenses.map((expense) => (
          expense.category.toLowerCase() === cleanOldName.toLowerCase() ? { ...expense, category: cleanNewName, updatedAt: nowStamp() } : expense
        ));
        set((current) => ({
          expenses: updatedExpenses,
          expenseCategories: expenseCategoriesFrom(
            current.expenseCategories.map((category) => category.toLowerCase() === cleanOldName.toLowerCase() ? cleanNewName : category),
            updatedExpenses
          ),
          auditLogs: addAudit(current, 'Renamed expense category', 'Expenses', `${cleanOldName} changed to ${cleanNewName}.`),
          lastNotice: `${cleanOldName} changed to ${cleanNewName}.`,
        }));
        void patchExpenseCategoryInBackend(cleanOldName, cleanNewName)
          .then((response) => set((current) => ({
            expenses: response.bootstrap.expenses ?? current.expenses,
            expenseCategories: expenseCategoriesFrom([...current.expenseCategories, ...response.categories], response.bootstrap.expenses ?? current.expenses),
            backendStatus: 'online',
            backendMessage: 'Expense category synced to the backend database.',
          })))
          .catch(() => set({ backendStatus: 'offline', backendMessage: 'Expense category change is saved locally; backend sync failed.' }));
        return true;
      },

      deleteExpenseCategory: (name) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'expenses.manage')) {
          set({ lastNotice: 'You need Manage expenses permission to edit categories.' });
          return false;
        }
        const cleanName = name.trim();
        const usedCount = state.expenses.filter((expense) => expense.category.toLowerCase() === cleanName.toLowerCase()).length;
        if (usedCount) {
          set({ lastNotice: 'Move expenses to another category before deleting this category.' });
          return false;
        }
        set((current) => ({
          expenseCategories: expenseCategoriesFrom(current.expenseCategories.filter((category) => category.toLowerCase() !== cleanName.toLowerCase()), current.expenses),
          auditLogs: addAudit(current, 'Deleted expense category', 'Expenses', cleanName),
          lastNotice: `${cleanName} category deleted.`,
        }));
        void deleteExpenseCategoryInBackend(cleanName)
          .then((response) => set((current) => ({
            expenseCategories: expenseCategoriesFrom(response.categories, current.expenses),
            backendStatus: 'online',
            backendMessage: 'Expense category synced to the backend database.',
          })))
          .catch(() => set({ backendStatus: 'offline', backendMessage: 'Expense category deletion is saved locally; backend sync failed.' }));
        return true;
      },

      addCashBankAccount: (input) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'cashbank.manage')) {
          set({ lastNotice: 'You need Manage cash and bank permission to add accounts.' });
          return false;
        }
        const account: CashBankAccount = {
          id: makeId('ACB'),
          name: input.name.trim() || `${input.type} account`,
          type: input.type,
          institution: input.institution.trim(),
          accountNumber: input.accountNumber.trim(),
          openingBalance: Math.max(0, input.openingBalance),
          balance: Math.max(0, input.openingBalance),
          active: true,
          createdAt: nowStamp(),
        };
        set((current) => ({
          cashBankAccounts: [account, ...current.cashBankAccounts],
          auditLogs: addAudit(current, 'Created cash/bank account', 'Cash & Bank', account.name),
          lastNotice: `${account.name} added.`,
        }));
        void createCashBankAccountInBackend(account).catch(() => set({ backendStatus: 'offline', backendMessage: 'Cash/bank account is saved locally; backend sync failed.' }));
        return true;
      },

      updateCashBankAccount: (accountId, patch) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'cashbank.manage')) {
          set({ lastNotice: 'You need Manage cash and bank permission to edit accounts.' });
          return;
        }
        set((current) => ({
          cashBankAccounts: current.cashBankAccounts.map((account) => account.id === accountId ? { ...account, ...patch, updatedAt: nowStamp() } : account),
          auditLogs: addAudit(current, 'Updated cash/bank account', 'Cash & Bank', accountId),
          lastNotice: 'Cash/bank account updated.',
        }));
        void patchCashBankAccountInBackend(accountId, patch)
          .then((response) => set({
            cashBankAccounts: response.bootstrap.cashBankAccounts ?? get().cashBankAccounts,
            backendStatus: 'online',
            backendMessage: 'Cash/bank account synced to the backend database.',
          }))
          .catch(() => set({ backendStatus: 'offline', backendMessage: 'Cash/bank account update is saved locally; backend sync failed.' }));
      },

      deleteCashBankAccount: (accountId) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'cashbank.manage')) {
          set({ lastNotice: 'You need Manage cash and bank permission to delete accounts.' });
          return false;
        }
        if (state.moneyMovements.some((movement) => movement.accountId === accountId)) {
          set({ lastNotice: 'This account has ledger entries. Mark it inactive instead of deleting it.' });
          return false;
        }
        set((current) => ({
          cashBankAccounts: current.cashBankAccounts.filter((account) => account.id !== accountId),
          auditLogs: addAudit(current, 'Deleted cash/bank account', 'Cash & Bank', accountId),
          lastNotice: 'Cash/bank account deleted.',
        }));
        void deleteCashBankAccountInBackend(accountId)
          .then((response) => set({
            cashBankAccounts: response.bootstrap.cashBankAccounts ?? get().cashBankAccounts,
            backendStatus: 'online',
            backendMessage: 'Cash/bank account synced to the backend database.',
          }))
          .catch(() => set({ backendStatus: 'offline', backendMessage: 'Cash/bank account deletion is saved locally; backend sync failed.' }));
        return true;
      },

      recordMoneyMovement: (input) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'cashbank.manage')) {
          set({ lastNotice: 'You need Manage cash and bank permission to record money movement.' });
          return false;
        }
        const account = state.cashBankAccounts.find((item) => item.id === input.accountId);
        if (!account || input.amount <= 0) return false;
        const movement: MoneyMovement = {
          id: makeId('MOVM'),
          accountId: account.id,
          accountName: account.name,
          type: input.type,
          amount: Math.max(0, input.amount),
          date: input.date,
          partyId: input.partyId,
          partyName: input.partyName,
          referenceId: input.referenceId,
          note: input.note.trim(),
          createdBy: state.currentUser.name,
          createdAt: nowStamp(),
        };
        set((current) => ({
          moneyMovements: [movement, ...current.moneyMovements],
          cashBankAccounts: applyCashBankBalance(current.cashBankAccounts, movement),
          auditLogs: addAudit(current, 'Recorded money movement', 'Cash & Bank', `${movement.type}: ${movement.amount}.`),
          lastNotice: 'Money movement saved.',
        }));
        void createMoneyMovementInBackend(movement).catch(() => set({ backendStatus: 'offline', backendMessage: 'Money movement is saved locally; backend sync failed.' }));
        return true;
      },

      updateMoneyMovement: (movementId, patch) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'cashbank.manage')) {
          set({ lastNotice: 'You need Manage cash & bank permission to edit money movements.' });
          return;
        }
        set((current) => ({
          moneyMovements: current.moneyMovements.map((movement) => (
            movement.id === movementId ? { ...movement, ...patch } : movement
          )),
          auditLogs: addAudit(current, 'Updated money movement', 'Cash & Bank', movementId),
          lastNotice: 'Money movement updated.',
        }));
        void patchMoneyMovementInBackend(movementId, patch).catch(() => set({ backendStatus: 'offline', backendMessage: 'Money movement update is saved locally; backend sync failed.' }));
      },

      deleteMoneyMovement: (movementId) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'cashbank.manage')) {
          set({ lastNotice: 'You need Manage cash & bank permission to delete money movements.' });
          return false;
        }
        set((current) => ({
          moneyMovements: current.moneyMovements.filter((movement) => movement.id !== movementId),
          auditLogs: addAudit(current, 'Deleted money movement', 'Cash & Bank', movementId),
          lastNotice: 'Money movement deleted.',
        }));
        void deleteMoneyMovementInBackend(movementId).catch(() => set({ backendStatus: 'offline', backendMessage: 'Money movement deletion is saved locally; backend sync failed.' }));
        return true;
      },

      addDocument: (input) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'documents.manage')) {
          set({ lastNotice: 'You need Manage documents permission to upload bills.' });
          return false;
        }
        const document: DocumentAttachment = {
          id: makeId('DOC'),
          name: input.name.trim() || input.fileName,
          recordType: input.recordType,
          recordId: input.recordId,
          fileName: input.fileName,
          mimeType: input.mimeType,
          size: input.size,
          dataUrl: input.dataUrl,
          uploadedBy: state.currentUser.name,
          createdAt: nowStamp(),
        };
        set((current) => ({
          documents: [document, ...current.documents],
          auditLogs: addAudit(current, 'Uploaded document', 'Documents', document.name),
          lastNotice: 'Document saved.',
        }));
        void createDocumentInBackend(document).catch(() => set({ backendStatus: 'offline', backendMessage: 'Document is saved locally; backend sync failed.' }));
        return true;
      },

      updateDocument: (documentId, patch) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'documents.manage')) {
          set({ lastNotice: 'You need Manage documents permission to edit files.' });
          return;
        }
        set((current) => ({
          documents: current.documents.map((document) => (
            document.id === documentId ? { ...document, ...patch } : document
          )),
          auditLogs: addAudit(current, 'Updated document', 'Documents', documentId),
          lastNotice: 'Document updated.',
        }));
        void patchDocumentInBackend(documentId, patch).catch(() => set({ backendStatus: 'offline', backendMessage: 'Document update is saved locally; backend sync failed.' }));
      },

      deleteDocument: (documentId) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'documents.manage')) {
          set({ lastNotice: 'You need Manage documents permission to delete files.' });
          return false;
        }
        set((current) => ({
          documents: current.documents.filter((document) => document.id !== documentId),
          auditLogs: addAudit(current, 'Deleted document', 'Documents', documentId),
          lastNotice: 'Document deleted.',
        }));
        void deleteDocumentInBackend(documentId).catch(() => set({ backendStatus: 'offline', backendMessage: 'Document deletion is saved locally; backend sync failed.' }));
        return true;
      },

      createReminderTemplate: (template) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'reminders.manage')) {
          set({ lastNotice: 'You need Manage reminders permission to create templates.' });
          return false;
        }
        const record: ReminderTemplate = { ...template, id: makeId('RMT') };
        set((current) => ({
          reminderTemplates: [record, ...current.reminderTemplates],
          auditLogs: addAudit(current, 'Created reminder template', 'Reminders', record.name),
          lastNotice: 'Reminder template saved.',
        }));
        void createReminderTemplateInBackend(record).catch(() => set({ backendStatus: 'offline', backendMessage: 'Reminder template is saved locally; backend sync failed.' }));
        return true;
      },

      updateReminderTemplate: (templateId, patch) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'reminders.manage')) {
          set({ lastNotice: 'You need Manage reminders permission to edit templates.' });
          return;
        }
        set((current) => ({
          reminderTemplates: current.reminderTemplates.map((template) => (
            template.id === templateId ? { ...template, ...patch } : template
          )),
          auditLogs: addAudit(current, 'Updated reminder template', 'Reminders', templateId),
          lastNotice: 'Reminder template updated.',
        }));
        void patchReminderTemplateInBackend(templateId, patch).catch(() => set({ backendStatus: 'offline', backendMessage: 'Reminder template update is saved locally; backend sync failed.' }));
      },

      deleteReminderTemplate: (templateId) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'reminders.manage')) {
          set({ lastNotice: 'You need Manage reminders permission to delete templates.' });
          return false;
        }
        set((current) => ({
          reminderTemplates: current.reminderTemplates.filter((template) => template.id !== templateId),
          auditLogs: addAudit(current, 'Deleted reminder template', 'Reminders', templateId),
          lastNotice: 'Reminder template deleted.',
        }));
        void deleteReminderTemplateInBackend(templateId).catch(() => set({ backendStatus: 'offline', backendMessage: 'Reminder template deletion is saved locally; backend sync failed.' }));
        return true;
      },

      sendReminder: (partyId, channel, message, amount, dueDate) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'reminders.manage')) {
          set({ lastNotice: 'You need Manage reminders permission to send reminders.' });
          return false;
        }
        const party = state.parties.find((item) => item.id === partyId);
        if (!party) return false;
        const log: ReminderLog = {
          id: makeId('RML'),
          partyId,
          partyName: party.name,
          channel,
          message,
          amount,
          dueDate,
          status: channel === 'Manual' ? 'Draft' : 'Sent',
          createdBy: state.currentUser.name,
          createdAt: nowStamp(),
        };
        set((current) => ({
          reminderLogs: [log, ...current.reminderLogs],
          auditLogs: addAudit(current, 'Created reminder', 'Reminders', `${party.name}: ${channel}.`),
          lastNotice: channel === 'WhatsApp' ? 'Reminder saved. Open WhatsApp link from the reminder list.' : 'Reminder saved.',
        }));
        void createReminderLogInBackend(log).catch(() => set({ backendStatus: 'offline', backendMessage: 'Reminder is saved locally; backend sync failed.' }));
        return true;
      },

      updateReminderLog: (logId, patch) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'reminders.manage')) {
          set({ lastNotice: 'You need Manage reminders permission to edit reminders.' });
          return;
        }
        set((current) => ({
          reminderLogs: current.reminderLogs.map((log) => (
            log.id === logId ? { ...log, ...patch } : log
          )),
          auditLogs: addAudit(current, 'Updated reminder', 'Reminders', logId),
          lastNotice: 'Reminder updated.',
        }));
        void patchReminderLogInBackend(logId, patch).catch(() => set({ backendStatus: 'offline', backendMessage: 'Reminder update is saved locally; backend sync failed.' }));
      },

      deleteReminderLog: (logId) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'reminders.manage')) {
          set({ lastNotice: 'You need Manage reminders permission to delete reminders.' });
          return false;
        }
        set((current) => ({
          reminderLogs: current.reminderLogs.filter((log) => log.id !== logId),
          auditLogs: addAudit(current, 'Deleted reminder', 'Reminders', logId),
          lastNotice: 'Reminder deleted.',
        }));
        void deleteReminderLogInBackend(logId).catch(() => set({ backendStatus: 'offline', backendMessage: 'Reminder deletion is saved locally; backend sync failed.' }));
        return true;
      },

      queueSyncOperation: (operation) => set((state) => ({
        syncOperations: [{
          ...operation,
          id: makeId('SYN'),
          status: 'Pending',
          createdAt: nowStamp(),
        }, ...state.syncOperations],
      })),

      updateSyncOperation: (operationId, patch) => {
        set((current) => ({
          syncOperations: current.syncOperations.map((operation) => (
            operation.id === operationId ? { ...operation, ...patch } : operation
          )),
          auditLogs: addAudit(current, 'Updated sync operation', 'Sync', operationId),
          lastNotice: 'Sync operation updated.',
        }));
        void patchSyncOperationInBackend(operationId, patch).catch(() => set({ backendStatus: 'offline', backendMessage: 'Sync operation update is saved locally; backend sync failed.' }));
      },

      deleteSyncOperation: (operationId) => {
        set((current) => ({
          syncOperations: current.syncOperations.filter((operation) => operation.id !== operationId),
          auditLogs: addAudit(current, 'Deleted sync operation', 'Sync', operationId),
          lastNotice: 'Sync operation deleted.',
        }));
        void deleteSyncOperationInBackend(operationId).catch(() => set({ backendStatus: 'offline', backendMessage: 'Sync operation deletion is saved locally; backend sync failed.' }));
        return true;
      },

      updateSaleStatus: (saleId, status) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'sales.update')) {
          set({ lastNotice: 'You need Update sales permission to change sale status.' });
          return false;
        }
        const sale = state.sales.find((entry) => entry.id === saleId);
        if (!sale) return false;

        let inventory = state.inventory;
        let inventoryMovements = state.inventoryMovements;
        if (sale.status !== 'Refunded' && status === 'Refunded') {
          sale.items.forEach((item) => {
            inventory = applyInventoryDelta(inventory, item.productId, item.quantity);
            inventoryMovements = [
              {
                id: makeId('MOV'),
                productId: item.productId,
                productName: item.productName,
                delta: item.quantity,
                reason: 'Return',
                note: `${sale.id} refunded`,
                user: state.currentUser.name,
                createdAt: nowStamp(),
              },
              ...inventoryMovements,
            ];
          });
        }
        if (sale.status === 'Refunded' && status !== 'Refunded') {
          sale.items.forEach((item) => {
            inventory = applyInventoryDelta(inventory, item.productId, -item.quantity);
          });
        }

        const sales = state.sales.map((entry) => {
          if (entry.id !== saleId) return entry;
          return {
            ...entry,
            status,
            amount: saleTotal(entry.items, status),
            auditTrail: [`Status changed to ${status} by ${state.currentUser.name} on ${nowStamp()}`, ...entry.auditTrail],
          };
        });

        set({
          sales,
          customers: recalculateCustomers(state.customers, sales),
          inventory,
          inventoryMovements,
          auditLogs: addAudit(state, 'Updated sale status', 'Sales', `${saleId} changed to ${status}.`),
          lastNotice: `${saleId} updated.`,
        });
        void patchSaleInBackend(saleId, { status })
          .then(() => set({
            backendStatus: 'online',
            backendMessage: 'Sale status synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Sale status is saved locally; backend sync failed.',
          }));
        return true;
      },

      softDeleteSale: (saleId) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'sales.delete')) {
          set({ lastNotice: 'You need Delete sales permission to remove sales.' });
          return false;
        }
        const sale = state.sales.find((entry) => entry.id === saleId);
        if (!sale || sale.deletedAt) return false;

        let inventory = state.inventory;
        if (sale.status !== 'Refunded') {
          sale.items.forEach((item) => {
            inventory = applyInventoryDelta(inventory, item.productId, item.quantity);
          });
        }

        const sales = state.sales.map((entry) => (
          entry.id === saleId
            ? {
                ...entry,
                deletedAt: nowStamp(),
                auditTrail: [`Soft-deleted by ${state.currentUser.name} on ${nowStamp()}`, ...entry.auditTrail],
              }
            : entry
        ));

        set({
          sales,
          customers: recalculateCustomers(state.customers, sales),
          inventory,
          auditLogs: addAudit(state, 'Soft-deleted sale', 'Sales', `${saleId} removed from active sales.`),
          lastNotice: `${saleId} moved to audit trail.`,
        });
        void deleteSaleInBackend(saleId)
          .then(() => set({
            backendStatus: 'online',
            backendMessage: 'Sale deletion synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Sale deletion is saved locally; backend sync failed.',
          }));
        return true;
      },

      importSales: (sales) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'sales.create')) {
          set({ lastNotice: 'You need Create sales permission to import sales.' });
          return;
        }
        set((current) => ({
          sales: [...sales, ...current.sales],
          auditLogs: addAudit(current, 'Imported sales', 'Sales', `${sales.length} CSV rows imported.`),
          lastNotice: `${sales.length} sales imported.`,
        }));
      },

      addCustomer: (input) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'customers.manage')) {
          set({ lastNotice: 'You need Manage customers permission to add customers.' });
          return false;
        }
        if (state.plan === 'free' && state.customers.length >= planLimits.customerProfiles) {
          set({ lastNotice: 'Free plan limit reached: 50 customer profiles. Upgrade to Pro for unlimited CRM.' });
          return false;
        }

        const customer: Customer = {
          id: makeId('CUST'),
          name: input.name.trim(),
          email: input.email.trim(),
          phone: input.phone.trim(),
          address: input.address.trim(),
          notes: input.notes.trim(),
          tags: input.tags,
          totalSpent: 0,
          orders: 0,
          lastOrder: today(),
          segment: 'Occasional',
          birthday: '',
        };

        set((current) => ({
          customers: [customer, ...current.customers],
          auditLogs: addAudit(current, 'Created customer', 'Customers', `${customer.name} profile added.`),
          lastNotice: `${customer.name} added to CRM.`,
        }));
        void createCustomerInBackend(customer)
          .then(() => set({
            backendStatus: 'online',
            backendMessage: 'Customer synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Customer is saved locally; backend sync failed.',
          }));
        return true;
      },

      updateCustomer: (customerId, patch) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'customers.manage')) {
          set({ lastNotice: 'You need Manage customers permission to edit customers.' });
          return;
        }
        set((state) => ({
          customers: state.customers.map((customer) => (
            customer.id === customerId ? { ...customer, ...patch } : customer
          )),
          auditLogs: addAudit(state, 'Updated customer', 'Customers', `${customerId} profile edited.`),
          lastNotice: 'Customer updated.',
        }));
        void patchCustomerInBackend(customerId, patch)
          .then(() => set({
            backendStatus: 'online',
            backendMessage: 'Customer update synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Customer update is saved locally; backend sync failed.',
          }));
      },

      deleteCustomer: (customerId) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'customers.manage')) {
          set({ lastNotice: 'You need Manage customers permission to delete customers.' });
          return false;
        }
        const customer = state.customers.find((item) => item.id === customerId);
        if (!customer) return false;
        set((current) => ({
          customers: current.customers.filter((item) => item.id !== customerId),
          creditLedger: current.creditLedger.filter((entry) => entry.customerId !== customerId),
          auditLogs: addAudit(current, 'Deleted customer', 'Customers', `${customer.name} profile deleted.`),
          lastNotice: `${customer.name} deleted from CRM.`,
        }));
        void deleteCustomerInBackend(customerId)
          .then((response) => set({
            customers: response.bootstrap.customers,
            backendStatus: 'online',
            backendMessage: 'Customer deletion synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Customer deletion is saved locally; backend sync failed.',
          }));
        return true;
      },

      addSupplier: (input) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'inventory.manage')) {
          set({ lastNotice: 'You need Manage inventory permission to add suppliers.' });
          return false;
        }
        const name = input.name.trim();
        if (!name) {
          set({ lastNotice: 'Supplier name is required.' });
          return false;
        }
        const supplier: Supplier = {
          id: makeId('SUP'),
          name,
          phone: input.phone.trim(),
          email: input.email.trim(),
          address: input.address.trim(),
          pan: input.pan.trim(),
          contactPerson: input.contactPerson.trim(),
          payableBalance: Math.max(0, input.payableBalance),
          notes: input.notes.trim(),
          createdAt: nowStamp(),
        };
        set((current) => ({
          suppliers: [supplier, ...current.suppliers],
          auditLogs: addAudit(current, 'Created supplier', 'Inventory', `${supplier.name} supplier added.`),
          lastNotice: `${supplier.name} supplier added.`,
        }));
        void createSupplierInBackend(supplier)
          .then(() => set({
            backendStatus: 'online',
            backendMessage: 'Supplier synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Supplier is saved locally; backend sync failed.',
          }));
        return true;
      },

      updateSupplier: (supplierId, patch) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'inventory.manage')) {
          set({ lastNotice: 'You need Manage inventory permission to edit suppliers.' });
          return;
        }
        set((current) => ({
          suppliers: current.suppliers.map((supplier) => (
            supplier.id === supplierId
              ? { ...supplier, ...patch, payableBalance: Math.max(0, patch.payableBalance ?? supplier.payableBalance), updatedAt: nowStamp() }
              : supplier
          )),
          auditLogs: addAudit(current, 'Updated supplier', 'Inventory', `${supplierId} supplier edited.`),
          lastNotice: 'Supplier updated.',
        }));
        void patchSupplierInBackend(supplierId, patch)
          .then(() => set({
            backendStatus: 'online',
            backendMessage: 'Supplier update synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Supplier update is saved locally; backend sync failed.',
          }));
      },

      deleteSupplier: (supplierId) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'inventory.manage')) {
          set({ lastNotice: 'You need Manage inventory permission to delete suppliers.' });
          return false;
        }
        const supplier = state.suppliers.find((item) => item.id === supplierId);
        if (!supplier) return false;
        set((current) => ({
          suppliers: current.suppliers.filter((item) => item.id !== supplierId),
          auditLogs: addAudit(current, 'Deleted supplier', 'Inventory', `${supplier.name} supplier deleted.`),
          lastNotice: `${supplier.name} supplier deleted.`,
        }));
        void deleteSupplierInBackend(supplierId)
          .then(() => set({
            backendStatus: 'online',
            backendMessage: 'Supplier deletion synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Supplier deletion is saved locally; backend sync failed.',
          }));
        return true;
      },

      recordCreditPayment: (customerId, amount, paymentMethod, note) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'customers.manage')) {
          set({ lastNotice: 'You need Manage customers permission to clear credit.' });
          return false;
        }
        const customer = state.customers.find((item) => item.id === customerId);
        if (!customer) return false;
        const currentBalance = creditBalanceFor(customerId, state.creditLedger);
        const paidAmount = Math.min(Math.max(0, amount), currentBalance);
        if (!paidAmount) {
          set({ lastNotice: 'Enter a payment amount greater than zero.' });
          return false;
        }
        const entry: CreditLedgerEntry = {
          id: makeId('CRD'),
          customerId,
          customerName: customer.name,
          type: 'Payment Received',
          amount: paidAmount,
          date: today(),
          paymentMethod,
          note: note.trim() || 'Credit payment received.',
          createdBy: state.currentUser.name,
          createdAt: nowStamp(),
        };
        const creditLedger = [entry, ...state.creditLedger];
        const customers = applyCreditBalances(state.customers, creditLedger);
        const cleared = creditBalanceFor(customerId, creditLedger) <= 0;
        const sales = cleared
          ? state.sales.map((sale) => (
            sale.customerId === customerId && sale.payment === 'Credit' && !sale.creditClearedAt
              ? { ...sale, creditClearedAt: nowStamp(), auditTrail: [`Credit cleared by ${state.currentUser.name} on ${nowStamp()}`, ...sale.auditTrail] }
              : sale
          ))
          : state.sales;
        set({
          creditLedger,
          customers,
          sales,
          auditLogs: addAudit(state, 'Cleared credit', 'Customers', `${customer.name} paid ${paidAmount}.`),
          lastNotice: cleared ? `${customer.name} credit cleared.` : `${customer.name} credit payment saved.`,
        });
        void createCreditEntryInBackend(entry)
          .then((response) => set({
            customers: response.bootstrap.customers,
            creditLedger: response.bootstrap.creditLedger ?? creditLedger,
            sales: response.bootstrap.sales,
            backendStatus: 'online',
            backendMessage: 'Credit payment synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Credit payment is saved locally; backend sync failed.',
          }));
        return true;
      },

      updateCreditEntry: (entryId, patch) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'customers.manage')) {
          set({ lastNotice: 'You need Manage customers permission to edit credit entries.' });
          return;
        }
        const creditLedger = state.creditLedger.map((entry) => (
          entry.id === entryId ? { ...entry, ...patch } : entry
        ));
        set({
          creditLedger,
          customers: applyCreditBalances(state.customers, creditLedger),
          auditLogs: addAudit(state, 'Updated credit entry', 'Customers', entryId),
          lastNotice: 'Credit entry updated.',
        });
        void patchCreditEntryInBackend(entryId, patch)
          .then((response) => set({
            customers: response.bootstrap.customers,
            creditLedger: response.bootstrap.creditLedger ?? creditLedger,
            backendStatus: 'online',
            backendMessage: 'Credit entry update synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Credit entry update is saved locally; backend sync failed.',
          }));
      },

      deleteCreditEntry: (entryId) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'customers.manage')) {
          set({ lastNotice: 'You need Manage customers permission to delete credit entries.' });
          return false;
        }
        const creditLedger = state.creditLedger.filter((entry) => entry.id !== entryId);
        set({
          creditLedger,
          customers: applyCreditBalances(state.customers, creditLedger),
          auditLogs: addAudit(state, 'Deleted credit entry', 'Customers', entryId),
          lastNotice: 'Credit entry deleted.',
        });
        void deleteCreditEntryInBackend(entryId)
          .then((response) => set({
            customers: response.bootstrap.customers,
            creditLedger: response.bootstrap.creditLedger ?? creditLedger,
            backendStatus: 'online',
            backendMessage: 'Credit entry deletion synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Credit entry deletion is saved locally; backend sync failed.',
          }));
        return true;
      },

      addInventoryProduct: (input) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'inventory.manage')) {
          set({ lastNotice: 'You need Manage inventory permission to add products.' });
          return false;
        }
        if (state.plan === 'free' && state.inventory.length >= planLimits.products) {
          set({ lastNotice: 'Free plan limit reached: 20 inventory products. Upgrade to Pro for unlimited products.' });
          return false;
        }

        const product: InventoryProduct = {
          id: makeId('PRD'),
          ...input,
          status: getStockStatus(input.stock, input.reorderLevel),
        };

        set((current) => ({
          inventory: [product, ...current.inventory],
          auditLogs: addAudit(current, 'Created product', 'Inventory', `${product.name} added to catalog.`),
          lastNotice: `${product.name} added to inventory.`,
        }));
        void createProductInBackend(product)
          .then(() => set({
            backendStatus: 'online',
            backendMessage: 'Product synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Product is saved locally; backend sync failed.',
          }));
        return true;
      },

      updateInventoryProduct: (productId, patch) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'inventory.manage')) {
          set({ lastNotice: 'You need Manage inventory permission to edit products.' });
          return;
        }
        const product = state.inventory.find((item) => item.id === productId);
        if (!product) return;
        const nextPatch = {
          ...patch,
          status: getStockStatus(patch.stock ?? product.stock, patch.reorderLevel ?? product.reorderLevel),
        };
        set((current) => ({
          inventory: current.inventory.map((item) => (
            item.id === productId ? { ...item, ...nextPatch } : item
          )),
          auditLogs: addAudit(current, 'Updated product', 'Inventory', `${product.name} edited.`),
          lastNotice: `${product.name} updated.`,
        }));
        void patchProductInBackend(productId, nextPatch)
          .then((response) => set({
            inventory: response.bootstrap.inventory,
            backendStatus: 'online',
            backendMessage: 'Product update synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Product update is saved locally; backend sync failed.',
          }));
      },

      deleteInventoryProduct: (productId) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'inventory.manage')) {
          set({ lastNotice: 'You need Manage inventory permission to delete products.' });
          return false;
        }
        const product = state.inventory.find((item) => item.id === productId);
        if (!product) return false;
        set((current) => ({
          inventory: current.inventory.filter((item) => item.id !== productId),
          inventoryMovements: current.inventoryMovements.filter((movement) => movement.productId !== productId),
          auditLogs: addAudit(current, 'Deleted product', 'Inventory', `${product.name} deleted.`),
          lastNotice: `${product.name} deleted from inventory.`,
        }));
        void deleteProductInBackend(productId)
          .then((response) => set({
            inventory: response.bootstrap.inventory,
            backendStatus: 'online',
            backendMessage: 'Product deletion synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Product deletion is saved locally; backend sync failed.',
          }));
        return true;
      },

      addInventoryCategory: (name) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'inventory.manage')) {
          set({ lastNotice: 'You need Manage inventory permission to edit categories.' });
          return false;
        }
        const cleanName = name.trim();
        if (!cleanName) {
          set({ lastNotice: 'Category name is required.' });
          return false;
        }
        const categories = inventoryCategoriesFrom(state.inventoryCategories, state.inventory);
        if (categories.some((category) => category.toLowerCase() === cleanName.toLowerCase())) {
          set({ lastNotice: 'That category already exists.' });
          return false;
        }
        set((current) => ({
          inventoryCategories: inventoryCategoriesFrom([...current.inventoryCategories, cleanName], current.inventory),
          auditLogs: addAudit(current, 'Created category', 'Inventory', `${cleanName} category added.`),
          lastNotice: `${cleanName} category added.`,
        }));
        void createInventoryCategoryInBackend(cleanName)
          .then((response) => set((current) => ({
            inventoryCategories: inventoryCategoriesFrom([...current.inventoryCategories, ...response.categories], current.inventory),
            backendStatus: 'online',
            backendMessage: 'Inventory category synced to the backend database.',
          })))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Category is saved locally; backend sync failed.',
          }));
        return true;
      },

      renameInventoryCategory: (oldName, newName) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'inventory.manage')) {
          set({ lastNotice: 'You need Manage inventory permission to edit categories.' });
          return false;
        }
        const cleanOldName = oldName.trim();
        const cleanNewName = newName.trim();
        if (!cleanOldName || !cleanNewName) {
          set({ lastNotice: 'Category name is required.' });
          return false;
        }
        if (cleanOldName.toLowerCase() !== cleanNewName.toLowerCase()) {
          const categories = inventoryCategoriesFrom(state.inventoryCategories, state.inventory);
          if (categories.some((category) => category.toLowerCase() === cleanNewName.toLowerCase())) {
            set({ lastNotice: 'That category already exists.' });
            return false;
          }
        }
        const updatedInventory = state.inventory.map((product) => (
          product.category.toLowerCase() === cleanOldName.toLowerCase()
            ? { ...product, category: cleanNewName }
            : product
        ));
        const renamedProducts = updatedInventory.filter((product) => product.category === cleanNewName);

        set((current) => ({
          inventory: updatedInventory,
          inventoryCategories: inventoryCategoriesFrom(
            current.inventoryCategories.map((category) => (
              category.toLowerCase() === cleanOldName.toLowerCase() ? cleanNewName : category
            )),
            updatedInventory
          ),
          auditLogs: addAudit(current, 'Renamed category', 'Inventory', `${cleanOldName} changed to ${cleanNewName}.`),
          lastNotice: `${cleanOldName} changed to ${cleanNewName}.`,
        }));
        void patchInventoryCategoryInBackend(cleanOldName, cleanNewName)
          .then((response) => set((current) => ({
            inventory: response.bootstrap.inventory,
            inventoryCategories: inventoryCategoriesFrom([...current.inventoryCategories, ...response.categories], response.bootstrap.inventory),
            backendStatus: 'online',
            backendMessage: 'Inventory category synced to the backend database.',
          })))
          .catch(() => {
            renamedProducts.forEach((product) => {
              void createProductInBackend(product).catch(() => undefined);
            });
            set({
              backendStatus: 'offline',
              backendMessage: 'Category change is saved locally; backend sync failed.',
            });
          });
        return true;
      },

      deleteInventoryCategory: (name) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'inventory.manage')) {
          set({ lastNotice: 'You need Manage inventory permission to edit categories.' });
          return false;
        }
        const cleanName = name.trim();
        const usedCount = state.inventory.filter((product) => product.category.toLowerCase() === cleanName.toLowerCase()).length;
        if (usedCount) {
          set({ lastNotice: 'Move products to another category before deleting this category.' });
          return false;
        }
        set((current) => ({
          inventoryCategories: inventoryCategoriesFrom(
            current.inventoryCategories.filter((category) => category.toLowerCase() !== cleanName.toLowerCase()),
            current.inventory
          ),
          auditLogs: addAudit(current, 'Deleted category', 'Inventory', `${cleanName} category deleted.`),
          lastNotice: `${cleanName} category deleted.`,
        }));
        void deleteInventoryCategoryInBackend(cleanName)
          .then((response) => set((current) => ({
            inventoryCategories: inventoryCategoriesFrom(response.categories, current.inventory),
            backendStatus: 'online',
            backendMessage: 'Inventory category synced to the backend database.',
          })))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Category deletion is saved locally; backend sync failed.',
          }));
        return true;
      },

      recordStockMovement: (input) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'inventory.manage')) {
          set({ lastNotice: 'You need Manage inventory permission to record stock movements.' });
          return false;
        }
        const product = state.inventory.find((item) => item.id === input.productId);
        if (!product) return false;

        const inventory = applyInventoryDelta(state.inventory, input.productId, input.delta);
        const movement: InventoryMovement = {
          id: makeId('MOV'),
          productId: product.id,
          productName: product.name,
          delta: input.delta,
          reason: input.reason,
          note: input.note,
          user: state.currentUser.name,
          createdAt: nowStamp(),
        };

        set({
          inventory,
          inventoryMovements: [movement, ...state.inventoryMovements],
          auditLogs: addAudit(state, 'Recorded stock movement', 'Inventory', `${product.name}: ${input.delta > 0 ? '+' : ''}${input.delta}.`),
          lastNotice: 'Stock movement saved.',
        });
        void createMovementInBackend(movement)
          .then((response) => set({
            inventory: response.bootstrap.inventory,
            inventoryMovements: response.bootstrap.inventoryMovements,
            backendStatus: 'online',
            backendMessage: 'Stock movement synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Stock movement is saved locally; backend sync failed.',
          }));
        return true;
      },

      updateStockMovement: (movementId, patch) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'inventory.manage')) {
          set({ lastNotice: 'You need Manage inventory permission to edit stock movements.' });
          return;
        }
        set((current) => ({
          inventoryMovements: current.inventoryMovements.map((movement) => (
            movement.id === movementId ? { ...movement, ...patch } : movement
          )),
          auditLogs: addAudit(current, 'Updated stock movement', 'Inventory', movementId),
          lastNotice: 'Stock movement updated.',
        }));
        void patchMovementInBackend(movementId, patch).catch(() => set({ backendStatus: 'offline', backendMessage: 'Stock movement update is saved locally; backend sync failed.' }));
      },

      deleteStockMovement: (movementId) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'inventory.manage')) {
          set({ lastNotice: 'You need Manage inventory permission to delete stock movements.' });
          return false;
        }
        set((current) => ({
          inventoryMovements: current.inventoryMovements.filter((movement) => movement.id !== movementId),
          auditLogs: addAudit(current, 'Deleted stock movement', 'Inventory', movementId),
          lastNotice: 'Stock movement deleted.',
        }));
        void deleteMovementInBackend(movementId).catch(() => set({ backendStatus: 'offline', backendMessage: 'Stock movement deletion is saved locally; backend sync failed.' }));
        return true;
      },

      generateReport: (input) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'reports.generate')) {
          set({ lastNotice: 'You need Generate reports permission to create reports.' });
          return false;
        }
        if (state.plan !== 'pro') {
          set({ lastNotice: 'PDF reports and scheduled exports are Pro features.' });
          return false;
        }

        const report: GeneratedReport = {
          id: makeId('RPT'),
          title: input.title.trim() || `${input.type} Report`,
          type: input.type,
          template: input.template,
          range: input.range,
          status: input.scheduled ? 'Scheduled' : 'Ready',
          createdAt: nowStamp(),
        };

        set({
          reports: [report, ...state.reports],
          auditLogs: addAudit(state, input.scheduled ? 'Scheduled report' : 'Generated report', 'Reports', `${report.title} is ${report.status.toLowerCase()}.`),
          lastNotice: `${report.title} ${report.status === 'Ready' ? 'generated' : 'scheduled'}.`,
        });
        void createReportInBackend(report)
          .then(() => set({
            backendStatus: 'online',
            backendMessage: 'Report synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Report is saved locally; backend sync failed.',
          }));
        return true;
      },

      updateReport: (reportId, patch) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'reports.generate')) {
          set({ lastNotice: 'You need Generate reports permission to edit reports.' });
          return;
        }
        set((current) => ({
          reports: current.reports.map((report) => (
            report.id === reportId ? { ...report, ...patch } : report
          )),
          auditLogs: addAudit(current, 'Updated report', 'Reports', reportId),
          lastNotice: 'Report updated.',
        }));
        void patchReportInBackend(reportId, patch)
          .then((response) => set({
            reports: response.bootstrap.reports,
            backendStatus: 'online',
            backendMessage: 'Report update synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Report update is saved locally; backend sync failed.',
          }));
      },

      deleteReport: (reportId) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'reports.generate')) {
          set({ lastNotice: 'You need Generate reports permission to delete reports.' });
          return false;
        }
        set((current) => ({
          reports: current.reports.filter((report) => report.id !== reportId),
          auditLogs: addAudit(current, 'Deleted report', 'Reports', reportId),
          lastNotice: 'Report deleted.',
        }));
        void deleteReportInBackend(reportId)
          .then((response) => set({
            reports: response.bootstrap.reports,
            backendStatus: 'online',
            backendMessage: 'Report deletion synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Report deletion is saved locally; backend sync failed.',
          }));
        return true;
      },

      upgradePlan: (gateway, cycle) => {
        const current = get();
        if (!roleCan(current.roleDefinitions, current.currentUser.role, 'billing.manage')) {
          set({ lastNotice: 'You need Manage billing permission to change plans.' });
          return;
        }
        const amount = cycle === 'annual' ? 14990 : 1499;
        const record: BillingRecord = {
          id: makeId('INV'),
          description: `Pro plan ${cycle} subscription`,
          gateway,
          amount,
          date: today(),
          status: 'Paid',
        };
        set((state) => ({
          plan: 'pro',
          billingCycle: cycle,
          billingHistory: [record, ...state.billingHistory],
          auditLogs: addAudit(state, 'Upgraded subscription', 'Billing', `Pro ${cycle} plan activated via ${gateway}.`),
          lastNotice: 'Pro plan activated. All premium features are unlocked.',
        }));
        void patchBillingPlanInBackend({ plan: 'pro', billingCycle: cycle, record })
          .then((response) => set({
            plan: response.bootstrap.plan,
            billingCycle: response.bootstrap.billingCycle,
            billingHistory: response.bootstrap.billingHistory,
            backendStatus: 'online',
            backendMessage: 'Billing plan synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Billing plan is saved locally; backend sync failed.',
          }));
      },

      downgradePlan: () => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'billing.manage')) {
          set({ lastNotice: 'You need Manage billing permission to change plans.' });
          return;
        }
        set((current) => ({
          plan: 'free',
          billingCycle: 'monthly',
          auditLogs: addAudit(current, 'Downgraded subscription', 'Billing', 'Account returned to Free plan.'),
          lastNotice: 'Account downgraded to Free plan.',
        }));
        void patchBillingPlanInBackend({ plan: 'free', billingCycle: 'monthly' })
          .then((response) => set({
            plan: response.bootstrap.plan,
            billingCycle: response.bootstrap.billingCycle,
            billingHistory: response.bootstrap.billingHistory,
            backendStatus: 'online',
            backendMessage: 'Billing downgrade synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Billing downgrade is saved locally; backend sync failed.',
          }));
      },

      inviteUser: (name, email, role) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'users.invite')) {
          set({ lastNotice: 'You need Invite users permission to add team members.' });
          return false;
        }
        const activeSeats = state.teamMembers.filter((member) => member.status === 'Active' || member.status === 'Invited').length;
        if (state.plan !== 'pro' && activeSeats >= planLimits.teamSeats) {
          set({ lastNotice: 'Team access is available on Pro. Free plan includes one owner seat.' });
          return false;
        }
        const roleDefinition = state.roleDefinitions.find((item) => item.name === role);
        const member: TeamMember = {
          id: makeId('USR'),
          name: name.trim(),
          email: email.trim(),
          role,
          roleId: roleDefinition?.id,
          permissions: roleDefinition?.permissions,
          status: 'Invited',
          lastActive: 'Pending invite',
        };

        set((current) => ({
          teamMembers: [
            ...current.teamMembers,
            member,
          ],
          auditLogs: addAudit(current, 'Invited user', 'Team', `${email} invited as ${role}.`),
          lastNotice: `${email} invited.`,
        }));
        void inviteUserInBackend(member)
          .then(() => set({
            backendStatus: 'online',
            backendMessage: 'Team invite synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Team invite is saved locally; backend sync failed.',
          }));
        return true;
      },

      updateUserRole: (userId, role) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'users.manage')) {
          set({ lastNotice: 'You need Manage users permission to change roles.' });
          return;
        }
        const roleDefinition = state.roleDefinitions.find((item) => item.name === role);
        set((current) => ({
          teamMembers: current.teamMembers.map((member) => (
            member.id === userId ? { ...member, role, roleId: roleDefinition?.id, permissions: roleDefinition?.permissions } : member
          )),
          auditLogs: addAudit(current, 'Changed user role', 'Team', `${userId} changed to ${role}.`),
          lastNotice: 'Role updated.',
        }));
        void patchUserRoleInBackend(userId, role)
          .then(() => set({
            backendStatus: 'online',
            backendMessage: 'User role synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'User role is saved locally; backend sync failed.',
          }));
      },

      removeUser: (userId) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'users.manage')) {
          set({ lastNotice: 'You need Manage users permission to remove team members.' });
          return;
        }
        set((current) => ({
          teamMembers: current.teamMembers.filter((member) => member.id !== userId || member.role === 'Owner'),
          auditLogs: addAudit(current, 'Removed user', 'Team', `${userId} removed from team.`),
          lastNotice: 'Team member removed.',
        }));
      },

      createRole: (input) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'roles.manage')) {
          set({ lastNotice: 'You need Manage roles permission to create roles.' });
          return false;
        }
        const name = input.name.trim();
        if (!name || !input.permissions.length) {
          set({ lastNotice: 'Role needs a name and at least one permission.' });
          return false;
        }
        if (state.roleDefinitions.some((role) => role.name.toLowerCase() === name.toLowerCase())) {
          set({ lastNotice: 'A role with that name already exists.' });
          return false;
        }
        const role: WorkspaceRole = {
          id: makeId('ROLE'),
          name,
          description: input.description.trim() || `${name} workspace access.`,
          permissions: input.permissions,
          systemRole: false,
          createdAt: nowStamp(),
        };
        set((current) => ({
          roleDefinitions: [...current.roleDefinitions, role],
          auditLogs: addAudit(current, 'Created role', 'Team', `${role.name} role created with ${role.permissions.length} permissions.`),
          lastNotice: `${role.name} role created.`,
        }));
        void createRoleInBackend(role)
          .then(() => set({
            backendStatus: 'online',
            backendMessage: 'Role synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Role is saved locally; backend sync failed.',
          }));
        return true;
      },

      updateRole: (roleId, patch) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'roles.manage')) {
          set({ lastNotice: 'You need Manage roles permission to edit roles.' });
          return;
        }
        const existing = state.roleDefinitions.find((role) => role.id === roleId);
        if (!existing || existing.name === 'Owner') {
          set({ lastNotice: 'Owner role cannot be edited here.' });
          return;
        }
        set((current) => ({
          roleDefinitions: current.roleDefinitions.map((role) => (
            role.id === roleId ? { ...role, ...patch, name: role.systemRole ? role.name : patch.name ?? role.name } : role
          )),
          teamMembers: patch.name
            ? current.teamMembers.map((member) => (
                member.role === existing.name ? { ...member, role: patch.name as string } : member
              ))
            : current.teamMembers,
          auditLogs: addAudit(current, 'Updated role', 'Team', `${existing.name} role permissions changed.`),
          lastNotice: `${existing.name} role updated.`,
        }));
        void patchRoleInBackend(roleId, patch)
          .then(() => set({
            backendStatus: 'online',
            backendMessage: 'Role update synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Role update is saved locally; backend sync failed.',
          }));
      },

      deleteRole: (roleId) => {
        const state = get();
        if (!roleCan(state.roleDefinitions, state.currentUser.role, 'roles.manage')) {
          set({ lastNotice: 'You need Manage roles permission to delete roles.' });
          return false;
        }
        const role = state.roleDefinitions.find((item) => item.id === roleId);
        if (!role || role.systemRole) {
          set({ lastNotice: 'System roles cannot be deleted.' });
          return false;
        }
        set((current) => ({
          roleDefinitions: current.roleDefinitions.filter((item) => item.id !== roleId),
          teamMembers: current.teamMembers.map((member) => (
            member.role === role.name ? { ...member, role: 'Staff', roleId: 'role-staff', permissions: permissionsForRole(current.roleDefinitions, 'Staff') } : member
          )),
          auditLogs: addAudit(current, 'Deleted role', 'Team', `${role.name} role deleted. Users moved to Staff.`),
          lastNotice: `${role.name} role deleted.`,
        }));
        void deleteRoleInBackend(roleId)
          .then(() => set({
            backendStatus: 'online',
            backendMessage: 'Role deletion synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Role deletion is saved locally; backend sync failed.',
          }));
        return true;
      },

      updateSettings: (patch) => {
        const current = get();
        if (!roleCan(current.roleDefinitions, current.currentUser.role, 'settings.manage')) {
          set({ lastNotice: 'You need Manage settings permission to update settings.' });
          return;
        }
        set((state) => ({
          settings: { ...state.settings, ...patch },
          auditLogs: addAudit(state, 'Updated settings', 'Settings', 'Business settings changed.'),
          lastNotice: 'Settings saved.',
        }));
        void patchSettingsInBackend(patch)
          .then(() => set({
            backendStatus: 'online',
            backendMessage: 'Settings synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Settings are saved locally; backend sync failed.',
          }));
      },
      setLanguage: (language) => set((state) => ({
        settings: { ...state.settings, language },
      })),
    }),
    {
      name: 'rhinopeak-saas-state-v2',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        activePage: state.activePage,
        sidebarCollapsed: state.sidebarCollapsed,
        globalSearch: state.globalSearch,
        isAuthenticated: state.isAuthenticated,
        currentUser: state.currentUser,
        session: state.session,
        plan: state.plan,
        billingCycle: state.billingCycle,
        trialEndsAt: state.trialEndsAt,
        businesses: state.businesses,
        activeBusinessId: state.activeBusinessId,
        teamMembers: state.teamMembers,
        roleDefinitions: state.roleDefinitions,
        sales: state.sales,
        parties: state.parties,
        partyLedger: state.partyLedger,
        purchases: state.purchases,
        expenses: state.expenses,
        expenseCategories: state.expenseCategories,
        cashBankAccounts: state.cashBankAccounts,
        moneyMovements: state.moneyMovements,
        journalEntries: state.journalEntries,
        accounts: state.accounts,
        invoiceTemplates: state.invoiceTemplates,
        documents: state.documents,
        billScans: state.billScans,
        reminderTemplates: state.reminderTemplates,
        reminderLogs: state.reminderLogs,
        syncOperations: state.syncOperations,
        customers: state.customers,
        suppliers: state.suppliers,
        creditLedger: state.creditLedger,
        inventory: state.inventory,
        inventoryCategories: state.inventoryCategories,
        inventoryMovements: state.inventoryMovements,
        reports: state.reports,
        auditLogs: state.auditLogs,
        billingHistory: state.billingHistory,
        platformOrganizations: state.platformOrganizations,
        featureFlags: state.featureFlags,
        supportTickets: state.supportTickets,
        settings: state.settings,
        lastNotice: state.lastNotice,
      }),
    }
  )
);
