export type PlanType = 'free' | 'pro';
export type UserRole = string;
export type SaleStatus = 'Completed' | 'Pending' | 'Refunded';
export type PaymentMethod = 'Cash' | 'Card' | 'eSewa' | 'FonePay' | 'Khalti' | 'Bank';
export type CustomerSegment = 'VIP' | 'Regular' | 'Occasional' | 'At-Risk';
export type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';
export type MovementReason = 'Stock In' | 'Sale' | 'Damage' | 'Theft' | 'Return' | 'Correction';
export type ReportTemplate = 'Minimal' | 'Detailed' | 'Executive';
export type AppLanguage = 'en' | 'ne';
export type PermissionArea = 'Dashboard' | 'Sales' | 'Customers' | 'Inventory' | 'Reports' | 'Team' | 'Billing' | 'Settings';
export type PermissionKey =
  | 'dashboard.view'
  | 'sales.view'
  | 'sales.create'
  | 'sales.update'
  | 'sales.delete'
  | 'customers.view'
  | 'customers.manage'
  | 'inventory.view'
  | 'inventory.manage'
  | 'analytics.view'
  | 'reports.view'
  | 'reports.generate'
  | 'team.view'
  | 'users.invite'
  | 'users.manage'
  | 'roles.manage'
  | 'billing.manage'
  | 'settings.manage'
  | 'account.delete';

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  area: PermissionArea;
  description: string;
}

export interface WorkspaceRole {
  id: string;
  name: UserRole;
  description: string;
  systemRole: boolean;
  permissions: PermissionKey[];
  createdAt: string;
}

export interface Business {
  id: string;
  name: string;
  category: string;
  address: string;
  phone?: string;
  email?: string;
  taxId?: string;
  currency?: 'NPR' | 'USD' | 'EUR';
  isPrimary?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleId?: string;
  permissions?: PermissionKey[];
  status: 'Active' | 'Invited';
  lastActive: string;
  phone?: string;
  avatarUrl?: string;
  locale?: string;
  isEmailVerified?: boolean;
  invitedBy?: string;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  tags: string[];
  totalSpent: number;
  orders: number;
  lastOrder: string;
  segment: CustomerSegment;
  birthday: string;
  company?: string;
  source?: string;
  taxId?: string;
  creditLimit?: number;
  balance?: number;
  preferredLanguage?: AppLanguage;
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  reorderLevel: number;
  price: number;
  costPrice: number;
  supplier: string;
  status: StockStatus;
  description?: string;
  brand?: string;
  unit?: string;
  barcode?: string;
  location?: string;
  taxRate?: number;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SaleLineItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  sku?: string;
  costPrice?: number;
  lineTotal?: number;
}

export interface Sale {
  id: string;
  customerId: string;
  customer: string;
  products: string;
  items: SaleLineItem[];
  amount: number;
  payment: PaymentMethod;
  status: SaleStatus;
  date: string;
  createdBy: string;
  deletedAt?: string;
  auditTrail: string[];
  invoiceNo?: string;
  businessId?: string;
  currency?: 'NPR' | 'USD' | 'EUR';
  subtotal?: number;
  discountTotal?: number;
  taxTotal?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  productName: string;
  delta: number;
  reason: MovementReason;
  note: string;
  user: string;
  createdAt: string;
  businessId?: string;
  stockBefore?: number;
  stockAfter?: number;
  referenceId?: string;
}

export interface AuditLog {
  id: string;
  user: string;
  action: string;
  module: string;
  detail: string;
  createdAt: string;
  actorId?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

export interface GeneratedReport {
  id: string;
  title: string;
  type: 'Sales' | 'Inventory' | 'Customers' | 'Executive';
  template: ReportTemplate;
  range: string;
  status: 'Ready' | 'Scheduled';
  createdAt: string;
  createdBy?: string;
  format?: 'HTML' | 'PDF' | 'CSV';
  downloadUrl?: string;
  scheduledAt?: string;
}

export interface BillingRecord {
  id: string;
  description: string;
  gateway: 'Stripe' | 'eSewa' | 'Khalti';
  amount: number;
  date: string;
  status: 'Paid' | 'Trial' | 'Pending';
  plan?: PlanType;
  billingCycle?: 'monthly' | 'annual';
  currency?: 'NPR' | 'USD' | 'EUR';
  invoiceNo?: string;
  paidAt?: string;
}

export type PlatformOrgStatus = 'Active' | 'Trial' | 'At Risk' | 'Suspended' | 'Expired';
export type SupportPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface PlatformOrganization {
  id: string;
  name: string;
  owner: string;
  email: string;
  market: string;
  category: string;
  plan: PlanType;
  status: PlatformOrgStatus;
  mrr: number;
  users: number;
  salesEntries: number;
  storageGb: number;
  healthScore: number;
  lastSeen: string;
  joinedAt: string;
  country?: string;
  timezone?: string;
  subscriptionStatus?: 'trial' | 'active' | 'past_due' | 'cancelled' | 'suspended' | 'expired';
}

export interface FeatureFlag {
  id: string;
  name: string;
  area: 'Billing' | 'Reports' | 'Analytics' | 'Security' | 'Platform';
  enabled: boolean;
  rollout: number;
  risk: 'Low' | 'Medium' | 'High';
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupportTicket {
  id: string;
  orgId: string;
  orgName: string;
  subject: string;
  priority: SupportPriority;
  status: 'Open' | 'Watching' | 'Resolved';
  createdAt: string;
  assignedTo?: string;
  channel?: 'Email' | 'Phone' | 'Chat' | 'Portal';
  lastUpdatedAt?: string;
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

export const planLimits = {
  salesEntries: 100,
  customerProfiles: 50,
  products: 20,
  teamSeats: 1,
};

export const permissionCatalog: PermissionDefinition[] = [
  { key: 'dashboard.view', label: 'View dashboard', area: 'Dashboard', description: 'Open KPI dashboard and workspace overview.' },
  { key: 'sales.view', label: 'View sales', area: 'Sales', description: 'Read sales entries, filters, and history.' },
  { key: 'sales.create', label: 'Create sales', area: 'Sales', description: 'Record new sales and import sales data.' },
  { key: 'sales.update', label: 'Update sales', area: 'Sales', description: 'Change payment status and sale metadata.' },
  { key: 'sales.delete', label: 'Delete sales', area: 'Sales', description: 'Soft-delete sales into the audit trail.' },
  { key: 'customers.view', label: 'View customers', area: 'Customers', description: 'Read CRM profiles and purchase history.' },
  { key: 'customers.manage', label: 'Manage customers', area: 'Customers', description: 'Create and edit customer profiles.' },
  { key: 'inventory.view', label: 'View inventory', area: 'Inventory', description: 'Read product catalog and stock levels.' },
  { key: 'inventory.manage', label: 'Manage inventory', area: 'Inventory', description: 'Create products and record stock movements.' },
  { key: 'analytics.view', label: 'View analytics', area: 'Dashboard', description: 'Open charts, comparisons, and growth insights.' },
  { key: 'reports.view', label: 'View reports', area: 'Reports', description: 'Read generated reports and export history.' },
  { key: 'reports.generate', label: 'Generate reports', area: 'Reports', description: 'Create scheduled or downloadable reports.' },
  { key: 'team.view', label: 'View team', area: 'Team', description: 'Read team members, roles, and activity history.' },
  { key: 'users.invite', label: 'Invite users', area: 'Team', description: 'Invite new users into the workspace.' },
  { key: 'users.manage', label: 'Manage users', area: 'Team', description: 'Change user roles and remove team members.' },
  { key: 'roles.manage', label: 'Manage roles', area: 'Team', description: 'Create custom roles and assign feature permissions.' },
  { key: 'billing.manage', label: 'Manage billing', area: 'Billing', description: 'Upgrade plan, downgrade plan, and export billing history.' },
  { key: 'settings.manage', label: 'Manage settings', area: 'Settings', description: 'Edit workspace settings, notifications, and security controls.' },
  { key: 'account.delete', label: 'Delete account', area: 'Settings', description: 'Export and clear account data.' },
];

export const allPermissions = permissionCatalog.map((permission) => permission.key);

export const systemWorkspaceRoles: WorkspaceRole[] = [
  {
    id: 'role-owner',
    name: 'Owner',
    description: 'Full tenant owner access, including billing, roles, settings, and account deletion.',
    systemRole: true,
    permissions: allPermissions,
    createdAt: '',
  },
  {
    id: 'role-manager',
    name: 'Manager',
    description: 'Operational manager access across sales, CRM, inventory, analytics, reports, and team visibility.',
    systemRole: true,
    permissions: [
      'dashboard.view',
      'sales.view',
      'sales.create',
      'sales.update',
      'customers.view',
      'customers.manage',
      'inventory.view',
      'inventory.manage',
      'analytics.view',
      'reports.view',
      'reports.generate',
      'team.view',
      'users.invite',
      'settings.manage',
    ],
    createdAt: '',
  },
  {
    id: 'role-staff',
    name: 'Staff',
    description: 'Frontline user with limited sales entry and stock movement permissions.',
    systemRole: true,
    permissions: ['dashboard.view', 'sales.view', 'sales.create', 'customers.view', 'inventory.view', 'inventory.manage'],
    createdAt: '',
  },
  {
    id: 'role-viewer',
    name: 'Viewer',
    description: 'Read-only access for dashboard, analytics, reports, and operational history.',
    systemRole: true,
    permissions: ['dashboard.view', 'sales.view', 'customers.view', 'inventory.view', 'analytics.view', 'reports.view'],
    createdAt: '',
  },
];

export const emptySettings: AppSettings = {
  businessName: '',
  currency: 'NPR',
  language: 'en',
  timezone: 'Asia/Kathmandu',
  fiscalYearStart: 'July',
  dateFormat: 'YYYY-MM-DD',
  numberFormat: 'en-NP',
  taxRate: 13,
  invoicePrefix: 'RP',
  receiptFooter: 'Thank you for your business.',
  defaultPaymentMethod: 'Cash',
  compactTables: false,
  lowStockAlerts: true,
  dailySalesSummary: false,
  newCustomerSignup: false,
  twoFactorEnabled: false,
  scheduledReports: false,
};
