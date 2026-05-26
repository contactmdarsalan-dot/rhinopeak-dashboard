import type {
  AppLanguage,
  AuditLog,
  BillScan,
  BillingRecord,
  Business,
  CashBankAccount,
  Customer,
  CreditLedgerEntry,
  DocumentAttachment,
  Expense,
  FeatureFlag,
  GeneratedReport,
  InventoryMovement,
  InventoryProduct,
  JournalEntry,
  MoneyMovement,
  Party,
  PartyLedgerEntry,
  PlatformOrganization,
  PlanType,
  PermissionKey,
  ParsedBillScan,
  Purchase,
  ReminderLog,
  ReminderTemplate,
  Sale,
  Supplier,
  SyncOperation,
  SupportTicket,
  TeamMember,
  WorkspaceRole,
} from '@/lib/domain';

export interface BackendSettings {
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
  defaultPaymentMethod: 'Cash' | 'Card' | 'eSewa' | 'FonePay' | 'Khalti' | 'Bank' | 'Credit';
  compactTables: boolean;
  lowStockAlerts: boolean;
  dailySalesSummary: boolean;
  newCustomerSignup: boolean;
  twoFactorEnabled: boolean;
  scheduledReports: boolean;
}

export interface BackendBootstrap {
  plan: PlanType;
  billingCycle: 'monthly' | 'annual';
  trialEndsAt: string;
  activeBusinessId: string;
  businesses: Business[];
  teamMembers: TeamMember[];
  roleDefinitions: WorkspaceRole[];
  sales: Sale[];
  parties?: Party[];
  partyLedger?: PartyLedgerEntry[];
  purchases?: Purchase[];
  expenses?: Expense[];
  expenseCategories?: string[];
  cashBankAccounts?: CashBankAccount[];
  moneyMovements?: MoneyMovement[];
  journalEntries?: JournalEntry[];
  documents?: DocumentAttachment[];
  billScans?: BillScan[];
  reminderTemplates?: ReminderTemplate[];
  reminderLogs?: ReminderLog[];
  syncOperations?: SyncOperation[];
  customers: Customer[];
  suppliers?: Supplier[];
  creditLedger?: CreditLedgerEntry[];
  inventory: InventoryProduct[];
  inventoryCategories?: string[];
  inventoryMovements: InventoryMovement[];
  reports: GeneratedReport[];
  auditLogs: AuditLog[];
  billingHistory: BillingRecord[];
  platformOrganizations: PlatformOrganization[];
  featureFlags: FeatureFlag[];
  supportTickets: SupportTicket[];
  settings: BackendSettings;
}

export interface EntityDetail {
  entity: string;
  kind: string;
  id: string;
  record: Record<string, unknown>;
  related: Record<string, Record<string, unknown>[]>;
}

export interface AssistantCommandResult {
  id: string;
  transcript: string;
  normalizedTranscript: string;
  language: 'en' | 'ne' | string;
  intent: string;
  confidence: number;
  requiresConfirmation: boolean;
  canExecute: boolean;
  route: string;
  slots: Record<string, unknown>;
  warnings: string[];
  missingSlots?: string[];
  nextSlot?: string;
  reply: string;
  safety: {
    autoExecute: boolean;
    reason: string;
  };
  executionStatus: 'Draft' | 'Executed' | string;
  createdAt: string;
  executedAt?: string;
  result?: Record<string, unknown>;
}

export interface AuthResponse {
  user: Omit<TeamMember, 'status' | 'lastActive'>;
  session: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
  };
  bootstrap: BackendBootstrap;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api';

export interface PlatformAdminUser {
  id: string;
  name: string;
  email: string;
  role: 'Platform Owner' | 'Super Admin' | 'Support Admin';
  status: 'Active' | 'Invited' | 'Suspended';
  lastActive: string;
  phone?: string;
  permissions?: string[];
  lastLoginAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PlatformSecuritySession {
  id: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  role: 'Platform Owner' | 'Super Admin' | 'Support Admin';
  status: 'Active' | 'Expired' | 'Revoked';
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface PlatformBootstrap {
  admin: PlatformAdminUser;
  admins: PlatformAdminUser[];
  organizations: PlatformOrganization[];
  featureFlags: FeatureFlag[];
  supportTickets: SupportTicket[];
  securitySessions: PlatformSecuritySession[];
  database: {
    status: 'online' | 'offline';
    name: string;
    counts: Record<string, number>;
    checkedAt: string;
  };
  metrics: {
    mrr: number;
    arr: number;
    tenants: number;
    activeTenants: number;
    trialTenants: number;
    riskTenants: number;
    expiredTenants: number;
    users: number;
    salesEntries: number;
    openTickets: number;
    enabledFlags: number;
    activeSessions: number;
  };
}

export interface PlatformSession {
  accessToken: string;
  expiresAt: string;
}

interface PlatformAuthResponse {
  session: PlatformSession;
  bootstrap: PlatformBootstrap;
}

function apiUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!isObject(value)) {
    throw new Error(`${label} response was not an object.`);
  }
  return value;
}

function requireStringField(value: Record<string, unknown>, field: string, label: string) {
  if (typeof value[field] !== 'string' || value[field].length === 0) {
    throw new Error(`${label} response is missing ${field}.`);
  }
}

function requireArrayField(value: Record<string, unknown>, field: string, label: string) {
  if (!Array.isArray(value[field])) {
    throw new Error(`${label} response is missing ${field}.`);
  }
}

function validateBootstrap(value: unknown): BackendBootstrap {
  const bootstrap = requireObject(value, 'Bootstrap');
  for (const field of [
    'businesses',
    'teamMembers',
    'roleDefinitions',
    'sales',
    'customers',
    'inventory',
    'inventoryMovements',
    'reports',
    'auditLogs',
    'billingHistory',
    'platformOrganizations',
    'featureFlags',
    'supportTickets',
  ]) {
    requireArrayField(bootstrap, field, 'Bootstrap');
  }
  requireObject(bootstrap.settings, 'Settings');
  requireStringField(bootstrap, 'plan', 'Bootstrap');
  requireStringField(bootstrap, 'billingCycle', 'Bootstrap');
  return bootstrap as unknown as BackendBootstrap;
}

function validateAuthResponse(value: unknown): AuthResponse {
  const response = requireObject(value, 'Authentication');
  const user = requireObject(response.user, 'Authentication user');
  const session = requireObject(response.session, 'Authentication session');
  requireStringField(user, 'id', 'Authentication user');
  requireStringField(user, 'email', 'Authentication user');
  requireStringField(session, 'accessToken', 'Authentication session');
  requireStringField(session, 'refreshToken', 'Authentication session');
  requireStringField(session, 'expiresAt', 'Authentication session');
  return {
    ...(response as unknown as AuthResponse),
    bootstrap: validateBootstrap(response.bootstrap),
  };
}

function persistedAccessToken() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('rhinopeak-saas-state-v2');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.session?.accessToken ?? null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const accessToken = persistedAccessToken();
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(apiUrl(path), {
    ...options,
    cache: 'no-store',
    headers,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error ?? `API request failed with status ${response.status}`);
  }

  return payload as T;
}

async function publicRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  const response = await fetch(apiUrl(path), {
    ...options,
    cache: 'no-store',
    headers,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error ?? `API request failed with status ${response.status}`);
  }

  return payload as T;
}

async function platformRequest<T>(path: string, accessToken?: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(apiUrl(path), {
    ...options,
    cache: 'no-store',
    headers,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error ?? `API request failed with status ${response.status}`);
  }

  return payload as T;
}

export async function getBackendHealth() {
  return request<{ ok: boolean; database: string; counts: Record<string, number> }>('/health');
}

export async function getBootstrap(accessToken?: string) {
  const response = await request<{ bootstrap: BackendBootstrap }>('/bootstrap', {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  return validateBootstrap(response.bootstrap);
}

export async function loginWithBackend(email: string, password: string) {
  const response = await request<unknown>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return validateAuthResponse(response);
}

export async function registerWithBackend(name: string, email: string, password: string, businessName: string) {
  const response = await request<unknown>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, businessName }),
  });
  return validateAuthResponse(response);
}

export async function refreshSession(refreshToken: string) {
  const response = await request<unknown>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
  return validateAuthResponse(response);
}

export async function logoutFromBackend(refreshToken?: string) {
  return request<{ ok: boolean }>('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

export async function requestPasswordReset(email: string) {
  return request<{ ok: boolean; message: string; resetToken?: string }>('/auth/password/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(email: string, token: string, password: string) {
  return request<{ ok: boolean; message: string }>('/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify({ email, token, password }),
  });
}

export async function getMobileBootstrap(accessToken?: string) {
  const response = await request<{ bootstrap: BackendBootstrap }>('/mobile/bootstrap', {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  return validateBootstrap(response.bootstrap);
}

export async function getEntityDetail(entity: string, id: string) {
  const response = await request<{ detail: EntityDetail }>(`/details/${encodeURIComponent(entity)}/${encodeURIComponent(id)}`);
  return response.detail;
}

export async function createSaleInBackend(sale: Sale) {
  return request<{ sale: Sale; bootstrap: BackendBootstrap }>('/sales', {
    method: 'POST',
    body: JSON.stringify(sale),
  });
}

export async function patchSaleInBackend(saleId: string, patch: Partial<Sale>) {
  return request<{ sale: Sale }>(`/sales/${saleId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteSaleInBackend(saleId: string) {
  return request<{ ok: boolean }>(`/sales/${saleId}`, { method: 'DELETE' });
}

export async function createCustomerInBackend(customer: Customer) {
  return request<{ customer: Customer }>('/customers', {
    method: 'POST',
    body: JSON.stringify(customer),
  });
}

export async function patchCustomerInBackend(customerId: string, patch: Partial<Customer>) {
  return request<{ customer: Customer }>(`/customers/${customerId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteCustomerInBackend(customerId: string) {
  return request<{ ok: boolean; bootstrap: BackendBootstrap }>(`/customers/${customerId}`, { method: 'DELETE' });
}

export async function createSupplierInBackend(supplier: Supplier) {
  return request<{ supplier: Supplier }>('/suppliers', {
    method: 'POST',
    body: JSON.stringify(supplier),
  });
}

export async function patchSupplierInBackend(supplierId: string, patch: Partial<Supplier>) {
  return request<{ supplier: Supplier }>(`/suppliers/${supplierId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteSupplierInBackend(supplierId: string) {
  return request<{ ok: boolean }>(`/suppliers/${supplierId}`, { method: 'DELETE' });
}

export async function createCreditEntryInBackend(entry: CreditLedgerEntry) {
  return request<{ entry: CreditLedgerEntry; bootstrap: BackendBootstrap }>('/credit-ledger', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
}

export async function patchCreditEntryInBackend(entryId: string, patch: Partial<CreditLedgerEntry>) {
  return request<{ record: CreditLedgerEntry; bootstrap: BackendBootstrap }>(`/credit-ledger/${entryId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteCreditEntryInBackend(entryId: string) {
  return request<{ ok: boolean; bootstrap: BackendBootstrap }>(`/credit-ledger/${entryId}`, { method: 'DELETE' });
}

export async function createPartyInBackend(party: Party) {
  return request<{ party: Party; bootstrap: BackendBootstrap }>('/parties', {
    method: 'POST',
    body: JSON.stringify(party),
  });
}

export async function patchPartyInBackend(partyId: string, patch: Partial<Party>) {
  return request<{ party: Party; bootstrap: BackendBootstrap }>(`/parties/${partyId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deletePartyInBackend(partyId: string) {
  return request<{ ok: boolean; bootstrap: BackendBootstrap }>(`/parties/${partyId}`, { method: 'DELETE' });
}

export async function createPartyLedgerEntryInBackend(entry: PartyLedgerEntry) {
  return request<{ entry: PartyLedgerEntry; bootstrap: BackendBootstrap }>('/party-ledger', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
}

export async function createPurchaseInBackend(purchase: Purchase) {
  return request<{ purchase: Purchase; bootstrap: BackendBootstrap }>('/purchases', {
    method: 'POST',
    body: JSON.stringify(purchase),
  });
}

export async function patchPurchaseInBackend(purchaseId: string, patch: Partial<Purchase>) {
  return request<{ purchase: Purchase; bootstrap: BackendBootstrap }>(`/purchases/${purchaseId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deletePurchaseInBackend(purchaseId: string) {
  return request<{ ok: boolean; bootstrap: BackendBootstrap }>(`/purchases/${purchaseId}`, { method: 'DELETE' });
}

export async function createExpenseInBackend(expense: Expense) {
  return request<{ expense: Expense; bootstrap: BackendBootstrap }>('/expenses', {
    method: 'POST',
    body: JSON.stringify(expense),
  });
}

export async function patchExpenseInBackend(expenseId: string, patch: Partial<Expense>) {
  return request<{ expense: Expense; bootstrap: BackendBootstrap }>(`/expenses/${expenseId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteExpenseInBackend(expenseId: string) {
  return request<{ ok: boolean; bootstrap: BackendBootstrap }>(`/expenses/${expenseId}`, { method: 'DELETE' });
}

export async function createExpenseCategoryInBackend(name: string) {
  return request<{ categories: string[] }>('/expenses/categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function patchExpenseCategoryInBackend(oldName: string, newName: string) {
  return request<{ categories: string[]; bootstrap: BackendBootstrap }>(`/expenses/categories/${encodeURIComponent(oldName)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: newName }),
  });
}

export async function deleteExpenseCategoryInBackend(name: string) {
  return request<{ categories: string[] }>(`/expenses/categories/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

export async function createCashBankAccountInBackend(account: CashBankAccount) {
  return request<{ account: CashBankAccount; bootstrap: BackendBootstrap }>('/cash-bank-accounts', {
    method: 'POST',
    body: JSON.stringify(account),
  });
}

export async function patchCashBankAccountInBackend(accountId: string, patch: Partial<CashBankAccount>) {
  return request<{ account: CashBankAccount; bootstrap: BackendBootstrap }>(`/cash-bank-accounts/${accountId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteCashBankAccountInBackend(accountId: string) {
  return request<{ ok: boolean; bootstrap: BackendBootstrap }>(`/cash-bank-accounts/${accountId}`, { method: 'DELETE' });
}

export async function createMoneyMovementInBackend(movement: MoneyMovement) {
  return request<{ movement: MoneyMovement; bootstrap: BackendBootstrap }>('/money-movements', {
    method: 'POST',
    body: JSON.stringify(movement),
  });
}

export async function patchMoneyMovementInBackend(movementId: string, patch: Partial<MoneyMovement>) {
  return request<{ record: MoneyMovement; bootstrap: BackendBootstrap }>(`/money-movements/${movementId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteMoneyMovementInBackend(movementId: string) {
  return request<{ ok: boolean; bootstrap: BackendBootstrap }>(`/money-movements/${movementId}`, { method: 'DELETE' });
}

export async function createDocumentInBackend(document: DocumentAttachment) {
  return request<{ document: DocumentAttachment; bootstrap: BackendBootstrap }>('/documents', {
    method: 'POST',
    body: JSON.stringify(document),
  });
}

export async function patchDocumentInBackend(documentId: string, patch: Partial<DocumentAttachment>) {
  return request<{ record: DocumentAttachment; bootstrap: BackendBootstrap }>(`/documents/${documentId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteDocumentInBackend(documentId: string) {
  return request<{ ok: boolean; bootstrap: BackendBootstrap }>(`/documents/${documentId}`, { method: 'DELETE' });
}

export async function uploadBillScanInBackend(input: {
  rawText?: string;
  imageDataUrl?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  sourceType?: 'camera' | 'upload' | 'manual';
}) {
  return request<{ billScan: BillScan; bootstrap: BackendBootstrap }>('/bill-scans/upload', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function parseBillScanInBackend(scanId: string, rawText?: string) {
  return request<{ billScan: BillScan; parsed: ParsedBillScan; bootstrap: BackendBootstrap }>(`/bill-scans/${scanId}/parse`, {
    method: 'POST',
    body: JSON.stringify({ rawText }),
  });
}

export async function approveBillScanInBackend(scanId: string, targetRecordType: 'Expense' | 'Purchase' | 'Sale', approved: ParsedBillScan) {
  return request<{ billScan: BillScan; target: Record<string, unknown>; document: DocumentAttachment; bootstrap: BackendBootstrap }>(`/bill-scans/${scanId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ targetRecordType, approved }),
  });
}

export async function deleteBillScanInBackend(scanId: string) {
  return request<{ ok: boolean; bootstrap: BackendBootstrap }>(`/bill-scans/${scanId}`, { method: 'DELETE' });
}

export async function runAssistantCommandInBackend(input: {
  transcript: string;
  language?: AppLanguage;
  confirm?: boolean;
  overrides?: Record<string, unknown>;
  draft?: AssistantCommandResult | Record<string, unknown>;
  conversation?: AssistantCommandResult | Record<string, unknown>;
  activeCommand?: AssistantCommandResult | Record<string, unknown>;
}) {
  return request<{ assistantCommand: AssistantCommandResult; bootstrap?: BackendBootstrap }>('/assistant/command', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function createReminderTemplateInBackend(template: ReminderTemplate) {
  return request<{ template: ReminderTemplate; bootstrap: BackendBootstrap }>('/reminder-templates', {
    method: 'POST',
    body: JSON.stringify(template),
  });
}

export async function patchReminderTemplateInBackend(templateId: string, patch: Partial<ReminderTemplate>) {
  return request<{ record: ReminderTemplate; bootstrap: BackendBootstrap }>(`/reminder-templates/${templateId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteReminderTemplateInBackend(templateId: string) {
  return request<{ ok: boolean; bootstrap: BackendBootstrap }>(`/reminder-templates/${templateId}`, { method: 'DELETE' });
}

export async function createReminderLogInBackend(log: ReminderLog) {
  return request<{ log: ReminderLog; bootstrap: BackendBootstrap }>('/reminders', {
    method: 'POST',
    body: JSON.stringify(log),
  });
}

export async function patchReminderLogInBackend(logId: string, patch: Partial<ReminderLog>) {
  return request<{ record: ReminderLog; bootstrap: BackendBootstrap }>(`/reminders/${logId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteReminderLogInBackend(logId: string) {
  return request<{ ok: boolean; bootstrap: BackendBootstrap }>(`/reminders/${logId}`, { method: 'DELETE' });
}

export async function pushSyncOperationInBackend(operation: SyncOperation) {
  return request<{ operation: SyncOperation; bootstrap: BackendBootstrap }>('/sync/push', {
    method: 'POST',
    body: JSON.stringify(operation),
  });
}

export async function patchSyncOperationInBackend(operationId: string, patch: Partial<SyncOperation>) {
  return request<{ record: SyncOperation; bootstrap: BackendBootstrap }>(`/sync-operations/${operationId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteSyncOperationInBackend(operationId: string) {
  return request<{ ok: boolean; bootstrap: BackendBootstrap }>(`/sync-operations/${operationId}`, { method: 'DELETE' });
}

export async function createProductInBackend(product: InventoryProduct) {
  return request<{ product: InventoryProduct }>('/inventory', {
    method: 'POST',
    body: JSON.stringify(product),
  });
}

export async function patchProductInBackend(productId: string, patch: Partial<InventoryProduct>) {
  return request<{ record: InventoryProduct; bootstrap: BackendBootstrap }>(`/inventory/${productId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteProductInBackend(productId: string) {
  return request<{ ok: boolean; bootstrap: BackendBootstrap }>(`/inventory/${productId}`, { method: 'DELETE' });
}

export async function createInventoryCategoryInBackend(name: string) {
  return request<{ categories: string[] }>('/inventory/categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function patchInventoryCategoryInBackend(oldName: string, name: string) {
  return request<{ categories: string[]; bootstrap: BackendBootstrap }>(`/inventory/categories/${encodeURIComponent(oldName)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export async function deleteInventoryCategoryInBackend(name: string) {
  return request<{ categories: string[] }>(`/inventory/categories/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
}

export async function createMovementInBackend(movement: InventoryMovement) {
  return request<{ movement: InventoryMovement; bootstrap: BackendBootstrap }>('/inventory/movements', {
    method: 'POST',
    body: JSON.stringify(movement),
  });
}

export async function patchMovementInBackend(movementId: string, patch: Partial<InventoryMovement>) {
  return request<{ record: InventoryMovement; bootstrap: BackendBootstrap }>(`/inventory-movements/${movementId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteMovementInBackend(movementId: string) {
  return request<{ ok: boolean; bootstrap: BackendBootstrap }>(`/inventory-movements/${movementId}`, { method: 'DELETE' });
}

export async function createReportInBackend(report: GeneratedReport) {
  return request<{ report: GeneratedReport }>('/reports', {
    method: 'POST',
    body: JSON.stringify(report),
  });
}

export async function patchReportInBackend(reportId: string, patch: Partial<GeneratedReport>) {
  return request<{ record: GeneratedReport; bootstrap: BackendBootstrap }>(`/reports/${reportId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteReportInBackend(reportId: string) {
  return request<{ ok: boolean; bootstrap: BackendBootstrap }>(`/reports/${reportId}`, { method: 'DELETE' });
}

export async function patchSettingsInBackend(patch: Partial<BackendSettings>) {
  return request<{ settings: BackendSettings }>('/settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function patchBillingPlanInBackend(input: {
  plan: PlanType;
  billingCycle: 'monthly' | 'annual';
  record?: BillingRecord;
}) {
  return request<{ bootstrap: BackendBootstrap }>('/billing/plan', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function initiatePaymentInBackend(input: {
  gateway: 'esewa' | 'khalti';
  amount: number;
  plan: 'pro';
  billingCycle: 'monthly' | 'annual';
}) {
  return request<{
    transactionUuid: string;
    payment: {
      gateway: 'esewa' | 'khalti';
      form_url?: string;
      fields?: Record<string, string>;
      payment_url?: string;
      pidx?: string;
      error?: string;
      note?: string;
    };
    session: Record<string, unknown>;
  }>('/payments/initiate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function createRoleInBackend(role: WorkspaceRole) {
  return request<{ role: WorkspaceRole }>('/roles', {
    method: 'POST',
    body: JSON.stringify(role),
  });
}

export async function patchRoleInBackend(roleId: string, patch: Partial<WorkspaceRole>) {
  return request<{ role: WorkspaceRole }>(`/roles/${roleId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteRoleInBackend(roleId: string) {
  return request<{ ok: boolean; fallbackRole: string }>(`/roles/${roleId}`, { method: 'DELETE' });
}

export async function patchUserRoleInBackend(userId: string, roleName: string) {
  return request<{ user: TeamMember }>(`/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role: roleName }),
  });
}

export async function inviteUserInBackend(input: {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions?: PermissionKey[];
}) {
  return request<{ user: TeamMember }>('/users/invite', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getInviteInBackend(token: string) {
  return publicRequest<{
    invite: {
      token: string;
      workspaceName: string;
      inviterName: string;
      role: string;
      email: string;
    };
  }>(`/invites/${encodeURIComponent(token)}`);
}

export async function acceptInviteInBackend(input: { token: string; password: string }) {
  return publicRequest<AuthResponse>('/invites/accept', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getPlatformAuthState() {
  return platformRequest<{
    ownerExists: boolean;
    adminCount: number;
    setupRequired: boolean;
    setupTokenRequired: boolean;
  }>('/platform/auth/state');
}

export async function setupPlatformOwner(input: {
  name: string;
  email: string;
  password: string;
  setupToken?: string;
}) {
  return platformRequest<PlatformAuthResponse>('/platform/auth/setup-owner', undefined, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function loginPlatformAdmin(email: string, password: string) {
  return platformRequest<PlatformAuthResponse>('/platform/auth/login', undefined, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function getPlatformBootstrap(accessToken: string) {
  const response = await platformRequest<{ bootstrap: PlatformBootstrap }>('/platform/bootstrap', accessToken);
  return response.bootstrap;
}

export async function createPlatformAdmin(accessToken: string, input: {
  name: string;
  email: string;
  password: string;
  role: 'Super Admin' | 'Support Admin';
}) {
  return platformRequest<{ admin: PlatformAdminUser; bootstrap: PlatformBootstrap }>('/platform/admins', accessToken, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function patchPlatformAdmin(accessToken: string, adminId: string, patch: Partial<PlatformAdminUser> & { password?: string }) {
  return platformRequest<{ admin: PlatformAdminUser; bootstrap: PlatformBootstrap }>(`/platform/admins/${adminId}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deletePlatformAdmin(accessToken: string, adminId: string) {
  return platformRequest<{ ok: boolean; bootstrap: PlatformBootstrap }>(`/platform/admins/${adminId}`, accessToken, {
    method: 'DELETE',
    body: JSON.stringify({}),
  });
}

export async function createPlatformOrganization(accessToken: string, input: {
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  password: string;
  plan: PlanType;
  status: PlatformOrganization['status'];
  category?: string;
  address?: string;
  country?: string;
  timezone?: string;
}) {
  return platformRequest<{ organization: PlatformOrganization; bootstrap: PlatformBootstrap }>('/platform/organizations', accessToken, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function patchPlatformOrganization(accessToken: string, orgId: string, patch: Partial<PlatformOrganization>) {
  return platformRequest<{ organization: PlatformOrganization; bootstrap: PlatformBootstrap }>(`/platform/organizations/${orgId}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deletePlatformOrganization(accessToken: string, orgId: string) {
  return platformRequest<{ ok: boolean; bootstrap: PlatformBootstrap }>(`/platform/organizations/${orgId}`, accessToken, {
    method: 'DELETE',
    body: JSON.stringify({}),
  });
}

export async function createPlatformFeatureFlag(accessToken: string, input: {
  name: string;
  description?: string;
  area: FeatureFlag['area'];
  enabled: boolean;
  rollout: number;
  risk: FeatureFlag['risk'];
}) {
  return platformRequest<{ featureFlag: FeatureFlag; bootstrap: PlatformBootstrap }>('/platform/feature-flags', accessToken, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function patchPlatformFeatureFlag(accessToken: string, flagId: string, patch: Partial<FeatureFlag>) {
  return platformRequest<{ featureFlag: FeatureFlag; bootstrap: PlatformBootstrap }>(`/platform/feature-flags/${flagId}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deletePlatformFeatureFlag(accessToken: string, flagId: string) {
  return platformRequest<{ ok: boolean; bootstrap: PlatformBootstrap }>(`/platform/feature-flags/${flagId}`, accessToken, {
    method: 'DELETE',
    body: JSON.stringify({}),
  });
}

export async function createPlatformSupportTicket(accessToken: string, input: {
  orgId: string;
  subject: string;
  priority: SupportTicket['priority'];
  assignedTo?: string;
  channel?: SupportTicket['channel'];
}) {
  return platformRequest<{ supportTicket: SupportTicket; bootstrap: PlatformBootstrap }>('/platform/support-tickets', accessToken, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function patchPlatformSupportTicket(accessToken: string, ticketId: string, patch: Partial<SupportTicket>) {
  return platformRequest<{ supportTicket: SupportTicket; bootstrap: PlatformBootstrap }>(`/platform/support-tickets/${ticketId}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deletePlatformSupportTicket(accessToken: string, ticketId: string) {
  return platformRequest<{ ok: boolean; bootstrap: PlatformBootstrap }>(`/platform/support-tickets/${ticketId}`, accessToken, {
    method: 'DELETE',
    body: JSON.stringify({}),
  });
}

export async function revokePlatformSession(accessToken: string, sessionId: string) {
  return platformRequest<{ ok: boolean; bootstrap: PlatformBootstrap }>(`/platform/sessions/${sessionId}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify({ revoked: true }),
  });
}

export async function logoutPlatformAdmin(accessToken?: string) {
  return platformRequest<{ ok: boolean }>('/platform/auth/logout', accessToken, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
