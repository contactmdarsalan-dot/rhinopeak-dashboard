import type {
  AppLanguage,
  AuditLog,
  BillingRecord,
  Business,
  Customer,
  FeatureFlag,
  GeneratedReport,
  InventoryMovement,
  InventoryProduct,
  PlatformOrganization,
  PlanType,
  PermissionKey,
  Sale,
  SupportTicket,
  TeamMember,
  WorkspaceRole,
} from '@/lib/domain';

export interface BackendSettings {
  businessName: string;
  currency: 'NPR' | 'USD' | 'EUR';
  language: AppLanguage;
  timezone: string;
  fiscalYearStart: 'January' | 'April' | 'July' | 'October';
  dateFormat: string;
  numberFormat: string;
  taxRate: number;
  invoicePrefix: string;
  receiptFooter: string;
  defaultPaymentMethod: 'Cash' | 'Card' | 'eSewa' | 'FonePay' | 'Khalti' | 'Bank';
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
  customers: Customer[];
  inventory: InventoryProduct[];
  inventoryMovements: InventoryMovement[];
  reports: GeneratedReport[];
  auditLogs: AuditLog[];
  billingHistory: BillingRecord[];
  platformOrganizations: PlatformOrganization[];
  featureFlags: FeatureFlag[];
  supportTickets: SupportTicket[];
  settings: BackendSettings;
}

interface AuthResponse {
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
  return response.bootstrap;
}

export async function loginWithBackend(email: string, password: string) {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function registerWithBackend(name: string, email: string, password: string, businessName: string) {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, businessName }),
  });
}

export async function refreshSession(refreshToken: string) {
  return request<AuthResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
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
  return response.bootstrap;
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

export async function createProductInBackend(product: InventoryProduct) {
  return request<{ product: InventoryProduct }>('/inventory', {
    method: 'POST',
    body: JSON.stringify(product),
  });
}

export async function createMovementInBackend(movement: InventoryMovement) {
  return request<{ movement: InventoryMovement; bootstrap: BackendBootstrap }>('/inventory/movements', {
    method: 'POST',
    body: JSON.stringify(movement),
  });
}

export async function createReportInBackend(report: GeneratedReport) {
  return request<{ report: GeneratedReport }>('/reports', {
    method: 'POST',
    body: JSON.stringify(report),
  });
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
