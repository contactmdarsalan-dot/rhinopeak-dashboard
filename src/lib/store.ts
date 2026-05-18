import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  createCustomerInBackend,
  createMovementInBackend,
  createProductInBackend,
  createReportInBackend,
  createRoleInBackend,
  createSaleInBackend,
  deleteRoleInBackend,
  deleteSaleInBackend,
  inviteUserInBackend,
  logoutFromBackend,
  patchBillingPlanInBackend,
  patchCustomerInBackend,
  patchRoleInBackend,
  patchSaleInBackend,
  patchSettingsInBackend,
  patchUserRoleInBackend,
  type BackendBootstrap,
} from '@/lib/api';
import {
  emptySettings,
  planLimits,
  systemWorkspaceRoles,
  type AppLanguage,
  type AuditLog,
  type BillingRecord,
  type Business,
  type Customer,
  type CustomerSegment,
  type GeneratedReport,
  type InventoryMovement,
  type InventoryProduct,
  type MovementReason,
  type PaymentMethod,
  type FeatureFlag,
  type PermissionKey,
  type PlanType,
  type PlatformOrganization,
  type ReportTemplate,
  type Sale,
  type SaleLineItem,
  type SaleStatus,
  type StockStatus,
  type SupportTicket,
  type TeamMember,
  type UserRole,
  type WorkspaceRole,
} from '@/lib/domain';
import { daysBetween } from '@/lib/utils';

export type Theme = 'dark' | 'light';
export type BackendStatus = 'idle' | 'online' | 'offline';
export type ActivePage =
  | 'dashboard'
  | 'sales'
  | 'analytics'
  | 'customers'
  | 'inventory'
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

export interface NewInventoryInput {
  name: string;
  sku: string;
  category: string;
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
  sales: 'sales.view',
  analytics: 'analytics.view',
  customers: 'customers.view',
  inventory: 'inventory.view',
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
  customers: Customer[];
  inventory: InventoryProduct[];
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
  updateSaleStatus: (saleId: string, status: SaleStatus) => boolean;
  softDeleteSale: (saleId: string) => boolean;
  importSales: (sales: Sale[]) => void;
  addCustomer: (input: NewCustomerInput) => boolean;
  updateCustomer: (customerId: string, patch: Partial<Customer>) => void;
  addInventoryProduct: (input: NewInventoryInput) => boolean;
  recordStockMovement: (input: StockMovementInput) => boolean;
  generateReport: (input: ReportInput) => boolean;
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

export const paymentMethods: PaymentMethod[] = ['Cash', 'Card', 'eSewa', 'FonePay', 'Khalti', 'Bank'];
export const saleStatuses: SaleStatus[] = ['Completed', 'Pending', 'Refunded'];
export const userRoles: UserRole[] = systemWorkspaceRoles.map((role) => role.name);
export const reportTemplates: ReportTemplate[] = ['Minimal', 'Detailed', 'Executive'];

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
      customers: [],
      inventory: [],
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
          customers: payload.customers,
          inventory: payload.inventory,
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
          customers: bootstrap.customers,
          inventory: bootstrap.inventory,
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
          customers: [],
          inventory: [],
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
              quantity: Math.max(1, item.quantity),
              unitPrice: product.price,
              discount: Math.max(0, item.discount),
              tax: Math.max(0, item.tax),
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
          products: lineItems.map((item) => `${item.productName} x ${item.quantity}`).join(', '),
          items: lineItems,
          amount: saleTotal(lineItems, input.status),
          payment: input.payment,
          status: input.status,
          date: input.date,
          createdBy: state.currentUser.name,
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

        const sales = [sale, ...state.sales];
        const customers = recalculateCustomers(
          existingCustomer ? state.customers : [customer, ...state.customers],
          sales
        );

        set({
          sales,
          customers,
          inventory,
          inventoryMovements,
          auditLogs: addAudit(state, 'Created sale', 'Sales', `${sale.id} for ${customer.name}.`),
          lastNotice: `${sale.id} recorded successfully.`,
        });
        void createSaleInBackend(sale)
          .then((response) => set({
            inventory: response.bootstrap.inventory,
            customers: response.bootstrap.customers,
            backendStatus: 'online',
            backendMessage: 'Sale synced to the backend database.',
          }))
          .catch(() => set({
            backendStatus: 'offline',
            backendMessage: 'Sale is saved locally; backend sync failed.',
          }));
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
        customers: state.customers,
        inventory: state.inventory,
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
