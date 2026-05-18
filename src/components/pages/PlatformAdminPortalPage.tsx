'use client';
import { FormEvent, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Banknote,
  Building2,
  CheckCircle2,
  Database,
  Download,
  Flag,
  Gauge,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LockKeyhole,
  LogOut,
  RefreshCcw,
  Search,
  Settings,
  ShieldCheck,
  TicketCheck,
  ToggleLeft,
  ToggleRight,
  Trash2,
  UserCog,
  UserPlus,
  UsersRound,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  createPlatformAdmin,
  createPlatformFeatureFlag,
  createPlatformOrganization,
  createPlatformSupportTicket,
  deletePlatformAdmin,
  deletePlatformFeatureFlag,
  deletePlatformOrganization,
  deletePlatformSupportTicket,
  getPlatformAuthState,
  getPlatformBootstrap,
  loginPlatformAdmin,
  logoutPlatformAdmin,
  patchPlatformAdmin,
  patchPlatformFeatureFlag,
  patchPlatformOrganization,
  patchPlatformSupportTicket,
  revokePlatformSession,
  setupPlatformOwner,
  type PlatformAdminUser,
  type PlatformBootstrap,
  type PlatformSecuritySession,
  type PlatformSession,
} from '@/lib/api';
import { type FeatureFlag, type PlatformOrgStatus, type PlanType, type SupportPriority, type SupportTicket } from '@/lib/domain';
import { Badge, Button, Field, Modal, ProgressBar, controlStyle } from '@/components/ui/Primitives';
import { downloadCsv, formatCurrency, formatNumber } from '@/lib/utils';

const STORAGE_KEY = 'rhinopeak-platform-session-v1';

type PortalSection = 'overview' | 'tenants' | 'billing' | 'admins' | 'support' | 'features' | 'security' | 'settings';
type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const orgStatuses: Array<'All' | PlatformOrgStatus> = ['All', 'Active', 'Trial', 'At Risk', 'Suspended', 'Expired'];
const orgStatusOptions: PlatformOrgStatus[] = ['Active', 'Trial', 'At Risk', 'Suspended', 'Expired'];
const plans: Array<'All' | PlanType> = ['All', 'free', 'pro'];
const planOptions: PlanType[] = ['free', 'pro'];
const adminRoleOptions: Array<'Super Admin' | 'Support Admin'> = ['Super Admin', 'Support Admin'];
const adminStatusOptions: PlatformAdminUser['status'][] = ['Active', 'Invited', 'Suspended'];
const supportStatuses: Array<'All' | SupportTicket['status']> = ['All', 'Open', 'Watching', 'Resolved'];
const supportPriorities: Array<'All' | SupportPriority> = ['All', 'Critical', 'High', 'Medium', 'Low'];
const priorityOptions: SupportPriority[] = ['Critical', 'High', 'Medium', 'Low'];
const featureAreaOptions: FeatureFlag['area'][] = ['Platform', 'Billing', 'Reports', 'Analytics', 'Security'];
const featureRiskOptions: FeatureFlag['risk'][] = ['Low', 'Medium', 'High'];
const rolloutOptions = [0, 20, 35, 50, 75, 100];

const navItems: Array<{ id: PortalSection; label: string; description: string; icon: LucideIcon }> = [
  { id: 'overview', label: 'Overview', description: 'Health and growth', icon: LayoutDashboard },
  { id: 'tenants', label: 'Tenants', description: 'Workspaces and status', icon: Building2 },
  { id: 'billing', label: 'Billing & Plans', description: 'Plans and revenue', icon: Banknote },
  { id: 'admins', label: 'Admins & Access', description: 'Platform operators', icon: UserCog },
  { id: 'support', label: 'Support Desk', description: 'Tenant issues', icon: LifeBuoy },
  { id: 'features', label: 'Feature Flags', description: 'Rollout controls', icon: Flag },
  { id: 'security', label: 'Security', description: 'Sessions and activity', icon: ShieldCheck },
  { id: 'settings', label: 'System Settings', description: 'Database and API', icon: Settings },
];

function orgTone(status: PlatformOrgStatus): BadgeTone {
  if (status === 'Active') return 'success';
  if (status === 'Trial') return 'info';
  if (status === 'At Risk') return 'warning';
  if (status === 'Expired') return 'danger';
  return 'danger';
}

function priorityTone(priority: SupportPriority): BadgeTone {
  if (priority === 'Critical') return 'danger';
  if (priority === 'High') return 'warning';
  if (priority === 'Medium') return 'info';
  return 'success';
}

function ticketTone(status: SupportTicket['status']): BadgeTone {
  if (status === 'Resolved') return 'success';
  if (status === 'Watching') return 'warning';
  return 'info';
}

function sessionTone(status: PlatformSecuritySession['status']): BadgeTone {
  if (status === 'Active') return 'success';
  if (status === 'Expired') return 'warning';
  return 'neutral';
}

function riskTone(risk: FeatureFlag['risk']): BadgeTone {
  if (risk === 'High') return 'danger';
  if (risk === 'Medium') return 'warning';
  return 'success';
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? 'R') + (parts[1]?.[0] ?? 'P');
}

function readableDate(value?: string) {
  if (!value) return 'Never';
  if (value === 'Never') return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function readPlatformSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as PlatformSession : null;
  } catch {
    return null;
  }
}

function SectionPanel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="platform-panel">
      <div style={{ padding: '15px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 800 }}>{title}</p>
          {subtitle && <p className="platform-muted" style={{ fontSize: 12, marginTop: 2 }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="platform-page-heading">
      <div>
        <p style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 850, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{eyebrow}</p>
        <h1>{title}</h1>
        <p style={{ maxWidth: 720, marginTop: 6 }}>{description}</p>
      </div>
      {action}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = 'accent',
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  detail: string;
  tone?: BadgeTone;
}) {
  const color = {
    neutral: 'var(--text-secondary)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger: 'var(--danger)',
    info: 'var(--info)',
    accent: 'var(--accent)',
  }[tone];
  return (
    <article className="platform-kpi">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <p className="platform-kpi-label">{label}</p>
        <Icon size={18} color={color} />
      </div>
      <div>
        <p className="platform-kpi-value" style={{ color }}>{value}</p>
        <p className="platform-muted" style={{ fontSize: 12, marginTop: 6 }}>{detail}</p>
      </div>
    </article>
  );
}

function EmptyState({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail: string }) {
  return (
    <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-secondary)' }}>
      <Icon size={28} color="var(--text-muted)" />
      <p style={{ fontWeight: 800, color: 'var(--text-primary)', marginTop: 10 }}>{title}</p>
      <p style={{ fontSize: 13, marginTop: 4 }}>{detail}</p>
    </div>
  );
}

export function PlatformAdminPortalPage() {
  const [activePage, setActivePage] = useState<PortalSection>('overview');
  const [bootstrap, setBootstrap] = useState<PlatformBootstrap | null>(null);
  const [session, setSession] = useState<PlatformSession | null>(null);
  const [ownerExists, setOwnerExists] = useState(true);
  const [setupTokenRequired, setSetupTokenRequired] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [showCreateFlag, setShowCreateFlag] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [setupToken, setSetupToken] = useState('');

  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminRole, setAdminRole] = useState<'Super Admin' | 'Support Admin'>('Super Admin');
  const [adminPasswordEdits, setAdminPasswordEdits] = useState<Record<string, string>>({});

  const [tenantBusinessName, setTenantBusinessName] = useState('');
  const [tenantOwnerName, setTenantOwnerName] = useState('');
  const [tenantOwnerEmail, setTenantOwnerEmail] = useState('');
  const [tenantPassword, setTenantPassword] = useState('');
  const [tenantCategory, setTenantCategory] = useState('General');
  const [tenantAddress, setTenantAddress] = useState('');
  const [tenantPlanForm, setTenantPlanForm] = useState<PlanType>('free');
  const [tenantStatusForm, setTenantStatusForm] = useState<PlatformOrgStatus>('Trial');

  const [ticketOrgId, setTicketOrgId] = useState('');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketPriority, setTicketPriority] = useState<SupportPriority>('Medium');

  const [flagName, setFlagName] = useState('');
  const [flagDescription, setFlagDescription] = useState('');
  const [flagArea, setFlagArea] = useState<FeatureFlag['area']>('Platform');
  const [flagRisk, setFlagRisk] = useState<FeatureFlag['risk']>('Low');
  const [flagRollout, setFlagRollout] = useState(0);
  const [flagEnabled, setFlagEnabled] = useState(false);

  const [tenantSearch, setTenantSearch] = useState('');
  const [tenantStatus, setTenantStatus] = useState<'All' | PlatformOrgStatus>('All');
  const [tenantPlan, setTenantPlan] = useState<'All' | PlanType>('All');
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketStatus, setTicketStatus] = useState<'All' | SupportTicket['status']>('All');
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState<'All' | SupportPriority>('All');

  useEffect(() => {
    let active = true;
    async function load() {
      setIsLoading(true);
      setError('');
      try {
        const state = await getPlatformAuthState();
        if (!active) return;
        setOwnerExists(state.ownerExists);
        setSetupTokenRequired(state.setupTokenRequired);
        const stored = readPlatformSession();
        if (stored?.accessToken) {
          const nextBootstrap = await getPlatformBootstrap(stored.accessToken);
          if (!active) return;
          setSession(stored);
          setBootstrap(nextBootstrap);
        }
      } catch (requestError) {
        if (!active) return;
        if (typeof window !== 'undefined') window.sessionStorage.removeItem(STORAGE_KEY);
        setError(requestError instanceof Error ? requestError.message : 'Could not reach platform API.');
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const isPlatformOwner = bootstrap?.admin?.role === 'Platform Owner';
  const canManageTenants = bootstrap?.admin?.role === 'Platform Owner' || bootstrap?.admin?.role === 'Super Admin';
  const canManageSupport = Boolean(bootstrap);
  const canManageFeatures = canManageTenants;

  const filteredOrgs = useMemo(() => {
    const query = tenantSearch.toLowerCase();
    return (bootstrap?.organizations ?? [])
      .filter((org) => tenantStatus === 'All' || org.status === tenantStatus)
      .filter((org) => tenantPlan === 'All' || org.plan === tenantPlan)
      .filter((org) => (
        (org.name ?? '').toLowerCase().includes(query) ||
        (org.owner ?? '').toLowerCase().includes(query) ||
        (org.email ?? '').toLowerCase().includes(query) ||
        (org.market ?? '').toLowerCase().includes(query)
      ))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  }, [bootstrap?.organizations, tenantPlan, tenantSearch, tenantStatus]);

  const filteredTickets = useMemo(() => {
    const query = ticketSearch.toLowerCase();
    return (bootstrap?.supportTickets ?? [])
      .filter((ticket) => ticketStatus === 'All' || ticket.status === ticketStatus)
      .filter((ticket) => ticketPriorityFilter === 'All' || ticket.priority === ticketPriorityFilter)
      .filter((ticket) => (
        (ticket.subject ?? '').toLowerCase().includes(query) ||
        (ticket.orgName ?? '').toLowerCase().includes(query) ||
        (ticket.assignedTo ?? '').toLowerCase().includes(query)
      ));
  }, [bootstrap?.supportTickets, ticketPriorityFilter, ticketSearch, ticketStatus]);

  const openTickets = useMemo(
    () => (bootstrap?.supportTickets ?? []).filter((ticket) => ticket.status !== 'Resolved'),
    [bootstrap?.supportTickets],
  );

  const planSummary = useMemo(() => {
    const orgs = bootstrap?.organizations ?? [];
    return planOptions.map((plan) => {
      const tenants = orgs.filter((org) => org.plan === plan);
      return {
        plan,
        tenants: tenants.length,
        mrr: tenants.reduce((sum, org) => sum + org.mrr, 0),
        users: tenants.reduce((sum, org) => sum + org.users, 0),
      };
    });
  }, [bootstrap?.organizations]);

  const exportRows = filteredOrgs.map((org) => ({
    id: org.id,
    name: org.name,
    owner: org.owner,
    email: org.email,
    plan: org.plan,
    status: org.status,
    mrr: org.mrr,
    users: org.users,
    salesEntries: org.salesEntries,
    healthScore: org.healthScore,
    lastSeen: org.lastSeen,
  }));

  const completePlatformAuth = (nextSession: PlatformSession, nextBootstrap: PlatformBootstrap) => {
    setSession(nextSession);
    setBootstrap(nextBootstrap);
    setOwnerExists(true);
    if (typeof window !== 'undefined') window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    setMessage(`Welcome, ${nextBootstrap.admin?.name ?? 'platform admin'}.`);
    setError('');
  };

  const refreshBootstrap = useCallback(async (successMessage = 'Latest platform data loaded.') => {
    if (!session?.accessToken) return;
    setIsRefreshing(true);
    setError('');
    try {
      const nextBootstrap = await getPlatformBootstrap(session.accessToken);
      setBootstrap(nextBootstrap);
      setMessage(successMessage);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not refresh platform data.');
    } finally {
      setIsRefreshing(false);
    }
  }, [session]);

  const submitAccess = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    setError('');
    try {
      const response = ownerExists
        ? await loginPlatformAdmin(email, password)
        : await setupPlatformOwner({ name, email, password, setupToken });
      completePlatformAuth(response.session, response.bootstrap);
      setPassword('');
      setSetupToken('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Platform access failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitNewTenant = async (event: FormEvent) => {
    event.preventDefault();
    if (!session?.accessToken) return;
    setIsSubmitting(true);
    setError('');
    try {
      const response = await createPlatformOrganization(session.accessToken, {
        businessName: tenantBusinessName,
        ownerName: tenantOwnerName,
        ownerEmail: tenantOwnerEmail,
        password: tenantPassword,
        category: tenantCategory,
        address: tenantAddress,
        plan: tenantPlanForm,
        status: tenantStatusForm,
      });
      setBootstrap(response.bootstrap);
      setShowCreateTenant(false);
      setTenantBusinessName('');
      setTenantOwnerName('');
      setTenantOwnerEmail('');
      setTenantPassword('');
      setTenantCategory('General');
      setTenantAddress('');
      setTenantPlanForm('free');
      setTenantStatusForm('Trial');
      setMessage(`${response.organization?.name ?? 'Tenant'} created.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not create tenant.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitNewAdmin = async (event: FormEvent) => {
    event.preventDefault();
    if (!session?.accessToken) return;
    setIsSubmitting(true);
    setError('');
    try {
      const response = await createPlatformAdmin(session.accessToken, {
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        role: adminRole,
      });
      setBootstrap(response.bootstrap);
      setShowCreateAdmin(false);
      setAdminName('');
      setAdminEmail('');
      setAdminPassword('');
      setAdminRole('Super Admin');
      setMessage(`${response.admin.email} added as ${response.admin.role}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not create platform admin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitNewFeatureFlag = async (event: FormEvent) => {
    event.preventDefault();
    if (!session?.accessToken) return;
    setIsSubmitting(true);
    setError('');
    try {
      const response = await createPlatformFeatureFlag(session.accessToken, {
        name: flagName,
        description: flagDescription,
        area: flagArea,
        enabled: flagEnabled,
        rollout: flagRollout,
        risk: flagRisk,
      });
      setBootstrap(response.bootstrap);
      setShowCreateFlag(false);
      setFlagName('');
      setFlagDescription('');
      setFlagArea('Platform');
      setFlagRisk('Low');
      setFlagRollout(0);
      setFlagEnabled(false);
      setMessage(`${response.featureFlag.name} created.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not create feature flag.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitNewTicket = async (event: FormEvent) => {
    event.preventDefault();
    if (!session?.accessToken) return;
    setIsSubmitting(true);
    setError('');
    try {
      const response = await createPlatformSupportTicket(session.accessToken, {
        orgId: ticketOrgId || bootstrap?.organizations?.[0]?.id || '',
        subject: ticketSubject,
        priority: ticketPriority,
        assignedTo: bootstrap?.admin?.email,
        channel: 'Portal',
      });
      setBootstrap(response.bootstrap);
      setShowCreateTicket(false);
      setTicketSubject('');
      setTicketPriority('Medium');
      setMessage('Support ticket created.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not create support ticket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateOrganization = async (orgId: string, patch: { plan?: PlanType; status?: PlatformOrgStatus }) => {
    if (!session?.accessToken) return;
    setIsSubmitting(true);
    setError('');
    try {
      const response = await patchPlatformOrganization(session.accessToken, orgId, patch);
      setBootstrap(response.bootstrap);
      setMessage('Tenant organization updated.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Organization update failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeOrganization = async (orgId: string, orgName: string) => {
    if (!session?.accessToken) return;
    if (!window.confirm(`Delete ${orgName}? This will expire the subscription, hide the tenant from active operations, and revoke tenant sessions.`)) return;
    setIsSubmitting(true);
    setError('');
    try {
      const response = await deletePlatformOrganization(session.accessToken, orgId);
      setBootstrap(response.bootstrap);
      setMessage(`${orgName} deleted from active tenant operations.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Tenant delete failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateAdmin = async (adminId: string, patch: Partial<PlatformAdminUser> & { password?: string }) => {
    if (!session?.accessToken) return;
    setIsSubmitting(true);
    setError('');
    try {
      const response = await patchPlatformAdmin(session.accessToken, adminId, patch);
      setBootstrap(response.bootstrap);
      if (patch.password) {
        setAdminPasswordEdits((current) => ({ ...current, [adminId]: '' }));
      }
      setMessage('Platform admin updated.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Admin update failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeAdmin = async (admin: PlatformAdminUser) => {
    if (!session?.accessToken) return;
    if (!window.confirm(`Delete platform admin ${admin.email}? Their active sessions will be revoked.`)) return;
    setIsSubmitting(true);
    setError('');
    try {
      const response = await deletePlatformAdmin(session.accessToken, admin.id);
      setBootstrap(response.bootstrap);
      setMessage(`${admin.email} deleted.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Admin delete failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFeatureFlag = async (flagId: string, patch: Partial<FeatureFlag>) => {
    if (!session?.accessToken) return;
    setIsSubmitting(true);
    setError('');
    try {
      const response = await patchPlatformFeatureFlag(session.accessToken, flagId, patch);
      setBootstrap(response.bootstrap);
      setMessage('Feature flag updated.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Feature flag update failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeFeatureFlag = async (flag: FeatureFlag) => {
    if (!session?.accessToken) return;
    if (!window.confirm(`Delete feature flag "${flag.name}"? Default flags can only be disabled.`)) return;
    setIsSubmitting(true);
    setError('');
    try {
      const response = await deletePlatformFeatureFlag(session.accessToken, flag.id);
      setBootstrap(response.bootstrap);
      setMessage(`${flag.name} deleted.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Feature flag delete failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateTicket = async (ticketId: string, patch: Partial<SupportTicket>) => {
    if (!session?.accessToken) return;
    setIsSubmitting(true);
    setError('');
    try {
      const response = await patchPlatformSupportTicket(session.accessToken, ticketId, patch);
      setBootstrap(response.bootstrap);
      setMessage('Support ticket updated.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Ticket update failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeTicket = async (ticket: SupportTicket) => {
    if (!session?.accessToken) return;
    if (!window.confirm(`Delete support ticket "${ticket.subject}"?`)) return;
    setIsSubmitting(true);
    setError('');
    try {
      const response = await deletePlatformSupportTicket(session.accessToken, ticket.id);
      setBootstrap(response.bootstrap);
      setMessage('Support ticket deleted.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Ticket delete failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    if (!session?.accessToken) return;
    setIsSubmitting(true);
    setError('');
    try {
      const response = await revokePlatformSession(session.accessToken, sessionId);
      setBootstrap(response.bootstrap);
      setMessage('Platform session revoked.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Session revoke failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const signOut = async () => {
    const token = session?.accessToken;
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setBootstrap(null);
    setMessage('Platform session ended.');
    if (token) await logoutPlatformAdmin(token).catch(() => undefined);
  };

  if (isLoading) {
    return (
      <main className="platform-owner-portal" style={{ display: 'grid', placeItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)' }}>
          <RefreshCcw size={17} className="animate-spin" />
          Checking platform access...
        </div>
      </main>
    );
  }

  if (!bootstrap) {
    return (
      <main className="platform-owner-portal">
        <div className="platform-auth-shell">
          <section className="platform-auth-copy">
            <div>
              <div className="platform-owner-brand" style={{ padding: 0, border: 0 }}>
                <span className="platform-owner-logo"><Zap size={16} fill="currentColor" /></span>
                <div>
                  <p style={{ fontWeight: 900, fontSize: 18 }}>RhinoPeak Platform</p>
                  <p className="platform-muted" style={{ fontSize: 12 }}>SaaS owner console</p>
                </div>
              </div>
              <div style={{ marginTop: 86 }}>
                <Badge tone="accent">Platform owner portal</Badge>
                <h1 style={{ marginTop: 18 }}>Manage every tenant without entering tenant workspaces.</h1>
                <p style={{ maxWidth: 680, marginTop: 18, color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.75 }}>
                  Create platform admins, monitor tenant health, control plans, manage support tickets, and keep RhinoPeak operations separate from customer dashboards.
                </p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, maxWidth: 780 }}>
              {[
                ['Tenant isolation', 'Tenant owners only see their own dashboard and roles.'],
                ['Owner controlled', 'Super admins are created by the SaaS platform owner.'],
                ['MongoDB backed', 'Portal data comes from the live local MongoDB database.'],
              ].map(([title, copy]) => (
                <div key={title} style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <p style={{ fontWeight: 800, fontSize: 13 }}>{title}</p>
                  <p className="platform-muted" style={{ fontSize: 12, marginTop: 4 }}>{copy}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="platform-auth-card">
            <section className="platform-panel" style={{ width: '100%', maxWidth: 440 }}>
              <div style={{ padding: 20, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <p style={{ fontWeight: 900, fontSize: 17 }}>{ownerExists ? 'Platform sign in' : 'Create platform owner'}</p>
                  <p className="platform-muted" style={{ fontSize: 12, marginTop: 3 }}>
                    {ownerExists ? 'Use a platform admin account, not a tenant login.' : 'One-time setup for the SaaS platform owner.'}
                  </p>
                </div>
                {ownerExists ? <LockKeyhole size={18} color="var(--accent)" /> : <ShieldCheck size={18} color="var(--accent)" />}
              </div>
              <form onSubmit={submitAccess} style={{ padding: 20, display: 'grid', gap: 14 }}>
                {!ownerExists && (
                  <Field label="Owner name">
                    <input value={name} onChange={(event) => setName(event.target.value)} style={controlStyle} required />
                  </Field>
                )}
                <Field label="Email">
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} style={controlStyle} required />
                </Field>
                <Field label={ownerExists ? 'Password' : 'Owner password'}>
                  <input type="password" minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} style={controlStyle} required />
                </Field>
                {!ownerExists && setupTokenRequired && (
                  <Field label="Setup code" hint="Configured by RHINOPEAK_PLATFORM_SETUP_TOKEN.">
                    <input value={setupToken} onChange={(event) => setSetupToken(event.target.value)} style={controlStyle} required />
                  </Field>
                )}
                <Button type="submit" disabled={isSubmitting}>
                  {ownerExists ? <KeyRound size={14} /> : <ShieldCheck size={14} />}
                  {isSubmitting ? 'Working...' : ownerExists ? 'Open owner console' : 'Create platform owner'}
                </Button>
                {(message || error) && (
                  <p style={{ color: error ? 'var(--danger)' : 'var(--success)', fontSize: 12, lineHeight: 1.5 }}>
                    {error || message}
                  </p>
                )}
              </form>
            </section>
          </section>
        </div>
      </main>
    );
  }

  const activeNav = navItems.find((item) => item.id === activePage) ?? navItems[0];
  const platformAdmin = bootstrap.admin ?? {
    id: 'unknown',
    name: 'Platform admin',
    email: '',
    role: 'Support Admin',
    status: 'Active',
    lastActive: '',
    createdBy: '',
    createdAt: '',
  } satisfies PlatformAdminUser;
  const platformAdmins = bootstrap.admins ?? [];
  const organizations = bootstrap.organizations ?? [];
  const featureFlags = bootstrap.featureFlags ?? [];
  const supportTickets = bootstrap.supportTickets ?? [];
  const securitySessions = bootstrap.securitySessions ?? [];
  const rawMetrics = bootstrap.metrics as Partial<PlatformBootstrap['metrics']> | undefined;
  const metrics = {
    mrr: rawMetrics?.mrr ?? 0,
    arr: rawMetrics?.arr ?? 0,
    tenants: rawMetrics?.tenants ?? organizations.length,
    activeTenants: rawMetrics?.activeTenants ?? organizations.filter((org) => org.status === 'Active').length,
    trialTenants: rawMetrics?.trialTenants ?? organizations.filter((org) => org.status === 'Trial').length,
    riskTenants: rawMetrics?.riskTenants ?? organizations.filter((org) => org.status === 'At Risk' || org.status === 'Suspended' || org.status === 'Expired').length,
    expiredTenants: rawMetrics?.expiredTenants ?? organizations.filter((org) => org.status === 'Expired').length,
    users: rawMetrics?.users ?? organizations.reduce((sum, org) => sum + Number(org.users ?? 0), 0),
    salesEntries: rawMetrics?.salesEntries ?? organizations.reduce((sum, org) => sum + Number(org.salesEntries ?? 0), 0),
    openTickets: rawMetrics?.openTickets ?? supportTickets.filter((ticket) => ticket.status !== 'Resolved').length,
    enabledFlags: rawMetrics?.enabledFlags ?? featureFlags.filter((flag) => flag.enabled).length,
    activeSessions: rawMetrics?.activeSessions ?? securitySessions.filter((item) => item.status === 'Active').length,
  };
  const database = bootstrap.database ?? {
    status: 'offline',
    name: 'MongoDB',
    counts: {},
    checkedAt: '',
  };

  const renderOverview = () => (
    <>
      <PageHeading
        eyebrow="Owner overview"
        title="Platform health, revenue, and tenant risk"
        description="A single operating view for the SaaS owner team. Use the quick panels to jump into work that needs attention."
        action={<Button variant="secondary" onClick={() => void refreshBootstrap()} disabled={isRefreshing}><RefreshCcw size={14} /> Refresh</Button>}
      />

      <div className="platform-grid">
        <div className="platform-span-3"><KpiCard icon={Banknote} label="MRR" value={formatCurrency(metrics.mrr)} detail={`ARR ${formatCurrency(metrics.arr)}`} /></div>
        <div className="platform-span-3"><KpiCard icon={Building2} label="Tenants" value={metrics.tenants} detail={`${metrics.activeTenants} active, ${metrics.trialTenants} trial`} tone="success" /></div>
        <div className="platform-span-3"><KpiCard icon={AlertTriangle} label="Needs attention" value={metrics.riskTenants + metrics.openTickets} detail={`${metrics.riskTenants} risky tenants, ${metrics.openTickets} open tickets`} tone={metrics.riskTenants || metrics.openTickets ? 'warning' : 'success'} /></div>
        <div className="platform-span-3"><KpiCard icon={ShieldCheck} label="Active sessions" value={metrics.activeSessions} detail={`${platformAdmins.length} platform admins`} tone="info" /></div>
      </div>

      <div className="platform-split">
        <SectionPanel title="Tenant health" subtitle="Lowest health scores first" action={<Button variant="ghost" onClick={() => setActivePage('tenants')}>Open tenants</Button>}>
          <div className="platform-panel-pad platform-list">
            {[...organizations].sort((a, b) => a.healthScore - b.healthScore).slice(0, 5).map((org) => (
              <div className="platform-list-row" key={org.id}>
                <div className="platform-entity">
                  <span className="platform-avatar"><Building2 size={15} /></span>
                  <div>
                    <p style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{org.name}</p>
                    <p className="platform-muted" style={{ fontSize: 12 }}>{org.owner || 'No owner'} - {org.users} users</p>
                  </div>
                </div>
                <div style={{ minWidth: 160 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                    <Badge tone={orgTone(org.status)}>{org.status}</Badge>
                    <span style={{ fontWeight: 800 }}>{org.healthScore}</span>
                  </div>
                  <ProgressBar value={org.healthScore} tone={org.healthScore < 55 ? 'danger' : org.healthScore < 75 ? 'warning' : 'success'} />
                </div>
              </div>
            ))}
            {!organizations.length && <EmptyState icon={Building2} title="No tenants yet" detail="New workspace registrations will appear here automatically." />}
          </div>
        </SectionPanel>

        <SectionPanel title="Today in operations" subtitle="Open work across support and rollouts">
          <div className="platform-panel-pad platform-list">
            <div className="platform-list-row">
              <div>
                <p style={{ fontWeight: 800 }}>Support load</p>
                <p className="platform-muted" style={{ fontSize: 12 }}>{openTickets.length} unresolved tenant tickets</p>
              </div>
              <Button variant="secondary" onClick={() => setActivePage('support')}>Review</Button>
            </div>
            <div className="platform-list-row">
              <div>
                <p style={{ fontWeight: 800 }}>Feature rollout</p>
                <p className="platform-muted" style={{ fontSize: 12 }}>{metrics.enabledFlags} enabled flags</p>
              </div>
              <Button variant="secondary" onClick={() => setActivePage('features')}>Control</Button>
            </div>
            <div className="platform-list-row">
              <div>
                <p style={{ fontWeight: 800 }}>Database</p>
                <p className="platform-muted" style={{ fontSize: 12 }}>{database.name} is {database.status}</p>
              </div>
              <Badge tone={database.status === 'online' ? 'success' : 'danger'}>{database.status}</Badge>
            </div>
          </div>
        </SectionPanel>
      </div>
    </>
  );

  const tenantToolbar = (
    <div className="platform-toolbar">
      <label className="platform-search">
        <Search size={14} color="var(--text-muted)" />
        <input value={tenantSearch} onChange={(event) => setTenantSearch(event.target.value)} placeholder="Search tenants" />
      </label>
      <select value={tenantPlan} onChange={(event) => setTenantPlan(event.target.value as 'All' | PlanType)} style={{ ...controlStyle, width: 112 }}>
        {plans.map((item) => <option key={item}>{item}</option>)}
      </select>
      <select value={tenantStatus} onChange={(event) => setTenantStatus(event.target.value as 'All' | PlatformOrgStatus)} style={{ ...controlStyle, width: 136 }}>
        {orgStatuses.map((item) => <option key={item}>{item}</option>)}
      </select>
    </div>
  );

  const renderTenantRows = (billingMode = false) => (
    <div className="platform-table-wrap">
      <table className="platform-table">
        <thead>
          <tr>
            <th>Tenant</th>
            <th>Plan</th>
            <th>Status</th>
            <th>{billingMode ? 'Revenue' : 'Usage'}</th>
            <th>Health</th>
            <th>Last seen</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredOrgs.map((org) => (
            <tr key={org.id}>
              <td>
                <div className="platform-entity">
                  <span className="platform-avatar">{initials(org.name)}</span>
                  <div>
                    <p style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{org.name}</p>
                    <p className="platform-muted" style={{ fontSize: 12 }}>{org.owner} - {org.email}</p>
                  </div>
                </div>
              </td>
              <td>
                <select
                  value={org.plan}
                  disabled={!canManageTenants || isSubmitting}
                  onChange={(event) => void updateOrganization(org.id, { plan: event.target.value as PlanType })}
                  style={{ ...controlStyle, minHeight: 32, width: 96, padding: '5px 8px' }}
                >
                  {planOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </td>
              <td>
                <select
                  value={org.status}
                  disabled={!canManageTenants || isSubmitting}
                  onChange={(event) => void updateOrganization(org.id, { status: event.target.value as PlatformOrgStatus })}
                  style={{ ...controlStyle, minHeight: 32, width: 128, padding: '5px 8px' }}
                >
                  {orgStatusOptions.map((item) => <option key={item}>{item}</option>)}
                </select>
              </td>
              <td style={{ minWidth: 158 }}>
                {billingMode ? (
                  <>
                    <p style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{formatCurrency(org.mrr)}</p>
                    <p className="platform-muted" style={{ fontSize: 12 }}>{org.subscriptionStatus ?? 'trial'} subscription</p>
                  </>
                ) : (
                  <>
                    <p>{org.salesEntries} sales, {org.users} users</p>
                    <ProgressBar value={Math.min(100, org.salesEntries / 5)} tone={org.salesEntries > 450 ? 'warning' : 'accent'} />
                  </>
                )}
              </td>
              <td style={{ minWidth: 150 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Badge tone={orgTone(org.status)}>{org.healthScore}</Badge>
                  <ProgressBar value={org.healthScore} tone={org.healthScore < 55 ? 'danger' : org.healthScore < 75 ? 'warning' : 'success'} />
                </div>
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>{readableDate(org.lastSeen)}</td>
              <td>
                <Button
                  variant="danger"
                  disabled={!canManageTenants || isSubmitting}
                  onClick={() => void removeOrganization(org.id, org.name)}
                >
                  <Trash2 size={14} />
                  Delete
                </Button>
              </td>
            </tr>
          ))}
          {!filteredOrgs.length && (
            <tr>
              <td colSpan={7}><EmptyState icon={Building2} title="No matching tenants" detail="Try a different search, plan, or status filter." /></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderTenants = () => (
    <>
      <PageHeading
        eyebrow="Tenant operations"
        title="Manage tenant workspaces"
        description="Change tenant plan and lifecycle status from the owner portal while tenant admins manage their own staff and permissions."
        action={
          <div className="platform-toolbar">
            {canManageTenants && <Button onClick={() => setShowCreateTenant(true)}><UserPlus size={14} /> Create tenant</Button>}
            <Button variant="secondary" onClick={() => downloadCsv('rhinopeak-platform-tenants.csv', exportRows)}><Download size={14} /> Export CSV</Button>
            <Button variant="secondary" onClick={() => void refreshBootstrap()} disabled={isRefreshing}><RefreshCcw size={14} /> Refresh</Button>
          </div>
        }
      />
      <SectionPanel title="Tenant directory" subtitle={`${filteredOrgs.length} of ${organizations.length} tenants shown`} action={tenantToolbar}>
        {renderTenantRows(false)}
      </SectionPanel>
    </>
  );

  const renderBilling = () => (
    <>
      <PageHeading
        eyebrow="Billing"
        title="Plans, subscriptions, and revenue"
        description="Keep plan assignment and tenant status aligned before automated billing is connected."
        action={<Button variant="secondary" onClick={() => setActivePage('tenants')}><Building2 size={14} /> Open tenants</Button>}
      />
      <div className="platform-grid">
        {planSummary.map((item) => (
          <div className="platform-span-4" key={item.plan}>
            <KpiCard
              icon={item.plan === 'pro' ? Banknote : Gauge}
              label={`${item.plan} plan`}
              value={formatCurrency(item.mrr)}
              detail={`${item.tenants} tenants and ${item.users} users`}
              tone={item.plan === 'pro' ? 'accent' : 'info'}
            />
          </div>
        ))}
        <div className="platform-span-4">
          <KpiCard icon={AlertTriangle} label="Expired subscriptions" value={metrics.expiredTenants} detail="Tenants in expired subscription state" tone={metrics.expiredTenants ? 'danger' : 'success'} />
        </div>
      </div>
      <SectionPanel title="Tenant billing controls" subtitle="Move tenants between free and pro while keeping account state clear" action={tenantToolbar}>
        {renderTenantRows(true)}
      </SectionPanel>
    </>
  );

  const renderAdmins = () => (
    <>
      <PageHeading
        eyebrow="Access control"
        title="Platform admins and SaaS owner roles"
        description="Only the platform owner can create admins, change operator role, suspend access, or reset a temporary password."
        action={isPlatformOwner && <Button onClick={() => setShowCreateAdmin(true)}><UserPlus size={14} /> Create admin</Button>}
      />
      <SectionPanel title="Admin directory" subtitle={`${platformAdmins.length} platform accounts`}>
        <div className="platform-table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last active</th>
                <th>Password reset</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {platformAdmins.map((admin) => {
                const lockedOwner = admin.role === 'Platform Owner';
                return (
                  <tr key={admin.id}>
                    <td>
                      <div className="platform-entity">
                        <span className="platform-avatar">{initials(admin.name)}</span>
                        <div>
                          <p style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{admin.name}</p>
                          <p className="platform-muted" style={{ fontSize: 12 }}>{admin.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      {isPlatformOwner && !lockedOwner ? (
                        <select value={admin.role} disabled={isSubmitting} onChange={(event) => void updateAdmin(admin.id, { role: event.target.value as PlatformAdminUser['role'] })} style={{ ...controlStyle, width: 138, minHeight: 32, padding: '5px 8px' }}>
                          {adminRoleOptions.map((item) => <option key={item}>{item}</option>)}
                        </select>
                      ) : (
                        <Badge tone={lockedOwner ? 'accent' : 'info'}>{admin.role}</Badge>
                      )}
                    </td>
                    <td>
                      {isPlatformOwner && !lockedOwner ? (
                        <select value={admin.status} disabled={isSubmitting} onChange={(event) => void updateAdmin(admin.id, { status: event.target.value as PlatformAdminUser['status'] })} style={{ ...controlStyle, width: 120, minHeight: 32, padding: '5px 8px' }}>
                          {adminStatusOptions.map((item) => <option key={item}>{item}</option>)}
                        </select>
                      ) : (
                        <Badge tone={admin.status === 'Active' ? 'success' : admin.status === 'Suspended' ? 'danger' : 'warning'}>{admin.status}</Badge>
                      )}
                    </td>
                    <td>{readableDate(admin.lastActive)}</td>
                    <td style={{ minWidth: 250 }}>
                      {isPlatformOwner ? (
                        <div className="platform-toolbar">
                          <input
                            type="password"
                            minLength={10}
                            value={adminPasswordEdits[admin.id] ?? ''}
                            onChange={(event) => setAdminPasswordEdits((current) => ({ ...current, [admin.id]: event.target.value }))}
                            placeholder="New temporary password"
                            style={{ ...controlStyle, width: 180, minHeight: 32, padding: '5px 8px' }}
                          />
                          <Button
                            variant="secondary"
                            disabled={isSubmitting || !(adminPasswordEdits[admin.id] ?? '').trim()}
                            onClick={() => void updateAdmin(admin.id, { password: adminPasswordEdits[admin.id] })}
                          >
                            Reset
                          </Button>
                        </div>
                      ) : (
                        <span className="platform-muted">Owner only</span>
                      )}
                    </td>
                    <td>
                      <Button
                        variant="danger"
                        disabled={!isPlatformOwner || lockedOwner || isSubmitting}
                        onClick={() => void removeAdmin(admin)}
                      >
                        <Trash2 size={14} />
                        Delete
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionPanel>
    </>
  );

  const supportToolbar = (
    <div className="platform-toolbar">
      <label className="platform-search">
        <Search size={14} color="var(--text-muted)" />
        <input value={ticketSearch} onChange={(event) => setTicketSearch(event.target.value)} placeholder="Search tickets" />
      </label>
      <select value={ticketStatus} onChange={(event) => setTicketStatus(event.target.value as 'All' | SupportTicket['status'])} style={{ ...controlStyle, width: 126 }}>
        {supportStatuses.map((item) => <option key={item}>{item}</option>)}
      </select>
      <select value={ticketPriorityFilter} onChange={(event) => setTicketPriorityFilter(event.target.value as 'All' | SupportPriority)} style={{ ...controlStyle, width: 126 }}>
        {supportPriorities.map((item) => <option key={item}>{item}</option>)}
      </select>
    </div>
  );

  const renderSupport = () => (
    <>
      <PageHeading
        eyebrow="Support desk"
        title="Tenant support operations"
        description="Create owner-side support work, assign tickets, change priority, and mark issues resolved from the SaaS portal."
        action={<Button onClick={() => setShowCreateTicket(true)} disabled={!canManageSupport || !organizations.length}><TicketCheck size={14} /> New ticket</Button>}
      />
      <div className="platform-grid">
        <div className="platform-span-4"><KpiCard icon={LifeBuoy} label="Open tickets" value={openTickets.length} detail={`${supportTickets.length} total tickets`} tone={openTickets.length ? 'warning' : 'success'} /></div>
        <div className="platform-span-4"><KpiCard icon={AlertTriangle} label="Critical" value={supportTickets.filter((ticket) => ticket.priority === 'Critical' && ticket.status !== 'Resolved').length} detail="Unresolved critical cases" tone="danger" /></div>
        <div className="platform-span-4"><KpiCard icon={CheckCircle2} label="Resolved" value={supportTickets.filter((ticket) => ticket.status === 'Resolved').length} detail="Closed support requests" tone="success" /></div>
      </div>
      <SectionPanel title="Tickets" subtitle={`${filteredTickets.length} tickets shown`} action={supportToolbar}>
        <div className="platform-table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th>Issue</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assigned to</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td>
                    <p style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{ticket.subject}</p>
                    <p className="platform-muted" style={{ fontSize: 12 }}>{ticket.orgName} - {ticket.channel ?? 'Portal'}</p>
                  </td>
                  <td>
                    <select value={ticket.priority} disabled={isSubmitting} onChange={(event) => void updateTicket(ticket.id, { priority: event.target.value as SupportPriority })} style={{ ...controlStyle, minHeight: 32, width: 116, padding: '5px 8px' }}>
                      {priorityOptions.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={ticket.status} disabled={isSubmitting} onChange={(event) => void updateTicket(ticket.id, { status: event.target.value as SupportTicket['status'] })} style={{ ...controlStyle, minHeight: 32, width: 122, padding: '5px 8px' }}>
                      {supportStatuses.filter((item) => item !== 'All').map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      defaultValue={ticket.assignedTo ?? ''}
                      onBlur={(event) => {
                        const nextValue = event.target.value.trim();
                        if (nextValue !== (ticket.assignedTo ?? '')) void updateTicket(ticket.id, { assignedTo: nextValue });
                      }}
                      style={{ ...controlStyle, minHeight: 32, width: 210, padding: '5px 8px' }}
                      placeholder="Assign admin"
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Badge tone={priorityTone(ticket.priority)}>{ticket.priority}</Badge>
                      <Badge tone={ticketTone(ticket.status)}>{ticket.status}</Badge>
                      <span>{readableDate(ticket.lastUpdatedAt ?? ticket.createdAt)}</span>
                    </div>
                  </td>
                  <td>
                    <Button variant="danger" disabled={isSubmitting} onClick={() => void removeTicket(ticket)}>
                      <Trash2 size={14} />
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
              {!filteredTickets.length && (
                <tr>
                  <td colSpan={6}><EmptyState icon={LifeBuoy} title="No support tickets" detail="Create a ticket for any tenant that needs owner-side help." /></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionPanel>
    </>
  );

  const renderFeatures = () => (
    <>
      <PageHeading
        eyebrow="Feature management"
        title="Roll out platform capabilities safely"
        description="Toggle global feature availability and control rollout level before exposing features broadly."
        action={
          <div className="platform-toolbar">
            {canManageFeatures && <Button onClick={() => setShowCreateFlag(true)}><Flag size={14} /> Create flag</Button>}
            <Button variant="secondary" onClick={() => void refreshBootstrap()} disabled={isRefreshing}><RefreshCcw size={14} /> Refresh flags</Button>
          </div>
        }
      />
      <SectionPanel title="Global feature flags" subtitle="These controls affect the SaaS platform, not one tenant only">
        <div className="platform-table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Area</th>
                <th>Risk</th>
                <th>Rollout</th>
                <th>State</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {featureFlags.map((flag) => (
                <tr key={flag.id}>
                  <td>
                    <p style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{flag.name}</p>
                    <p className="platform-muted" style={{ fontSize: 12, maxWidth: 480 }}>{flag.description}</p>
                  </td>
                  <td><Badge tone="info">{flag.area}</Badge></td>
                  <td>
                    <select value={flag.risk} disabled={!canManageFeatures || isSubmitting} onChange={(event) => void updateFeatureFlag(flag.id, { risk: event.target.value as FeatureFlag['risk'] })} style={{ ...controlStyle, minHeight: 32, width: 104, padding: '5px 8px' }}>
                      {featureRiskOptions.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </td>
                  <td style={{ minWidth: 180 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <select value={flag.rollout} disabled={!canManageFeatures || isSubmitting} onChange={(event) => void updateFeatureFlag(flag.id, { rollout: Number(event.target.value) })} style={{ ...controlStyle, minHeight: 32, width: 92, padding: '5px 8px' }}>
                        {rolloutOptions.map((item) => <option key={item} value={item}>{item}%</option>)}
                      </select>
                      <ProgressBar value={flag.rollout} tone={flag.rollout < 50 ? 'warning' : 'success'} />
                    </div>
                  </td>
                  <td>
                    <Button variant={flag.enabled ? 'secondary' : 'ghost'} disabled={!canManageFeatures || isSubmitting} onClick={() => void updateFeatureFlag(flag.id, { enabled: !flag.enabled })}>
                      {flag.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      {flag.enabled ? 'Enabled' : 'Disabled'}
                    </Button>
                  </td>
                  <td>
                    <Badge tone={riskTone(flag.risk)}>{flag.risk} risk</Badge>
                    <p className="platform-muted" style={{ fontSize: 12, marginTop: 5 }}>{readableDate(flag.updatedAt)}</p>
                  </td>
                  <td>
                    <Button variant="danger" disabled={!canManageFeatures || isSubmitting} onClick={() => void removeFeatureFlag(flag)}>
                      <Trash2 size={14} />
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionPanel>
    </>
  );

  const renderSecurity = () => (
    <>
      <PageHeading
        eyebrow="Security"
        title="Platform sessions and operator activity"
        description="See active owner-console sessions and revoke access when a device or admin account should be cut off."
        action={<Button variant="secondary" onClick={() => void refreshBootstrap()} disabled={isRefreshing}><RefreshCcw size={14} /> Refresh sessions</Button>}
      />
      <div className="platform-grid">
        <div className="platform-span-4"><KpiCard icon={ShieldCheck} label="Active sessions" value={metrics.activeSessions} detail="Current platform console sessions" tone="success" /></div>
        <div className="platform-span-4"><KpiCard icon={UsersRound} label="Admins" value={platformAdmins.length} detail={`${platformAdmins.filter((admin) => admin.status === 'Active').length} active accounts`} tone="info" /></div>
        <div className="platform-span-4"><KpiCard icon={Database} label="Database" value={database.status} detail={`${database.name} checked ${readableDate(database.checkedAt)}`} tone={database.status === 'online' ? 'success' : 'danger'} /></div>
      </div>
      <SectionPanel title="Platform sessions" subtitle="Newest 100 sessions">
        <div className="platform-table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Status</th>
                <th>Created</th>
                <th>Expires</th>
                <th>Device</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {securitySessions.map((item) => (
                <tr key={item.id}>
                  <td>
                    <p style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{item.adminName}</p>
                    <p className="platform-muted" style={{ fontSize: 12 }}>{item.adminEmail || item.adminId}</p>
                  </td>
                  <td><Badge tone={sessionTone(item.status)}>{item.status}</Badge></td>
                  <td>{readableDate(item.createdAt)}</td>
                  <td>{readableDate(item.expiresAt)}</td>
                  <td className="platform-muted">{item.ipAddress || 'Local'} {item.userAgent ? `- ${item.userAgent}` : ''}</td>
                  <td>
                    <Button variant="danger" disabled={!canManageTenants || item.status !== 'Active' || isSubmitting} onClick={() => void revokeSession(item.id)}>
                      Revoke
                    </Button>
                  </td>
                </tr>
              ))}
              {!securitySessions.length && (
                <tr>
                  <td colSpan={6}><EmptyState icon={ShieldCheck} title="No platform sessions" detail="Sessions will appear after platform admins sign in." /></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionPanel>
    </>
  );

  const renderSettings = () => (
    <>
      <PageHeading
        eyebrow="System settings"
        title="Platform configuration and database health"
        description="Operational details for the owner portal, local MongoDB, mobile API readiness, and setup state."
        action={<Button variant="secondary" onClick={() => void refreshBootstrap()} disabled={isRefreshing}><RefreshCcw size={14} /> Refresh health</Button>}
      />
      <div className="platform-grid">
        <div className="platform-span-6">
          <SectionPanel title="Database" subtitle="Live MongoDB connection used by tenant and owner portals">
            <div className="platform-panel-pad platform-list">
              <div className="platform-list-row">
                <div>
                  <p style={{ fontWeight: 800 }}>Status</p>
                  <p className="platform-muted" style={{ fontSize: 12 }}>Checked {readableDate(database.checkedAt)}</p>
                </div>
                <Badge tone={database.status === 'online' ? 'success' : 'danger'}>{database.status}</Badge>
              </div>
              <div className="platform-list-row">
                <div>
                  <p style={{ fontWeight: 800 }}>Database name</p>
                  <p className="platform-muted" style={{ fontSize: 12 }}>{database.name}</p>
                </div>
                <Database size={18} color="var(--accent)" />
              </div>
            </div>
          </SectionPanel>
        </div>
        <div className="platform-span-6">
          <SectionPanel title="Owner portal state" subtitle="This portal is separate from every tenant workspace">
            <div className="platform-panel-pad platform-list">
              <div className="platform-list-row">
                <div>
                  <p style={{ fontWeight: 800 }}>Owner account</p>
                  <p className="platform-muted" style={{ fontSize: 12 }}>{ownerExists ? 'Already created' : 'Setup required'}</p>
                </div>
                <Badge tone={ownerExists ? 'success' : 'warning'}>{ownerExists ? 'Ready' : 'Setup'}</Badge>
              </div>
              <div className="platform-list-row">
                <div>
                  <p style={{ fontWeight: 800 }}>Setup token</p>
                  <p className="platform-muted" style={{ fontSize: 12 }}>{setupTokenRequired ? 'Required for first owner setup' : 'Not required locally'}</p>
                </div>
                <Badge tone={setupTokenRequired ? 'warning' : 'info'}>{setupTokenRequired ? 'Required' : 'Optional'}</Badge>
              </div>
            </div>
          </SectionPanel>
        </div>
        <div className="platform-span-7">
          <SectionPanel title="Collection counts" subtitle="Primary MongoDB collections used by the SaaS platform">
            <div className="platform-panel-pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              {Object.entries(database.counts).map(([key, value]) => (
                <div key={key} style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 12 }}>
                  <p className="platform-muted" style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 800 }}>{key.replaceAll('_', ' ')}</p>
                  <p style={{ fontWeight: 900, fontSize: 22 }}>{formatNumber(value)}</p>
                </div>
              ))}
            </div>
          </SectionPanel>
        </div>
        <div className="platform-span-5">
          <SectionPanel title="Mobile and API readiness" subtitle="Backend surfaces prepared for web and mobile clients">
            <div className="platform-panel-pad platform-list">
              {[
                ['Tenant bootstrap', '/api/bootstrap'],
                ['Mobile bootstrap', '/api/mobile/bootstrap'],
                ['Owner bootstrap', '/api/platform/bootstrap'],
                ['Support updates', '/api/platform/support-tickets/:id'],
                ['Feature rollout', '/api/platform/feature-flags/:id'],
              ].map(([label, route]) => (
                <div key={route} className="platform-list-row">
                  <span style={{ fontWeight: 800 }}>{label}</span>
                  <code className="platform-muted" style={{ fontSize: 12 }}>{route}</code>
                </div>
              ))}
            </div>
          </SectionPanel>
        </div>
      </div>
    </>
  );

  const pages: Record<PortalSection, ReactNode> = {
    overview: renderOverview(),
    tenants: renderTenants(),
    billing: renderBilling(),
    admins: renderAdmins(),
    support: renderSupport(),
    features: renderFeatures(),
    security: renderSecurity(),
    settings: renderSettings(),
  };

  return (
    <main className="platform-owner-portal">
      <div className="platform-owner-shell">
        <aside className="platform-owner-sidebar">
          <div className="platform-owner-brand">
            <span className="platform-owner-logo"><Zap size={16} fill="currentColor" /></span>
            <div>
              <p style={{ fontWeight: 900, fontSize: 16 }}>RhinoPeak</p>
              <p className="platform-muted" style={{ fontSize: 12 }}>SaaS owner portal</p>
            </div>
          </div>
          <nav className="platform-owner-nav" aria-label="Platform owner navigation">
            {navItems.map((item) => (
              <button key={item.id} type="button" className={`platform-nav-button ${activePage === item.id ? 'active' : ''}`} onClick={() => setActivePage(item.id)}>
                <item.icon size={16} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="platform-owner-user">
            <div className="platform-list-row" style={{ alignItems: 'flex-start' }}>
              <span className="platform-avatar">{initials(platformAdmin.name)}</span>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontWeight: 850, color: 'var(--text-primary)' }}>{platformAdmin.name}</p>
                <p className="platform-muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{platformAdmin.email}</p>
                <div style={{ marginTop: 7 }}><Badge tone={isPlatformOwner ? 'accent' : 'info'}>{platformAdmin.role}</Badge></div>
              </div>
            </div>
          </div>
        </aside>

        <section className="platform-owner-main">
          <header className="platform-owner-topbar">
            <div>
              <p className="platform-muted" style={{ fontSize: 11 }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 2 }}>
                <activeNav.icon size={18} color="var(--accent)" />
                <p style={{ fontWeight: 900, fontSize: 18 }}>{activeNav.label}</p>
              </div>
            </div>
            <div className="platform-toolbar">
              <Badge tone={database.status === 'online' ? 'success' : 'danger'}>MongoDB {database.status}</Badge>
              <Badge tone={isPlatformOwner ? 'accent' : 'info'}>{platformAdmin.role}</Badge>
              <Button variant="secondary" onClick={() => void refreshBootstrap()} disabled={isRefreshing}><RefreshCcw size={14} /> Sync</Button>
              <Button variant="secondary" onClick={signOut}><LogOut size={14} /> Sign out</Button>
            </div>
          </header>

          <div
            className="platform-owner-content"
            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'stretch', gap: 12 }}
          >
            {(message || error) && (
              <div style={{ border: `1px solid ${error ? 'rgba(239,68,68,0.26)' : 'rgba(34,197,94,0.25)'}`, background: error ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', borderRadius: 10, padding: '10px 12px', color: error ? 'var(--danger)' : 'var(--success)', fontSize: 13 }}>
                {error || message}
              </div>
            )}
            {pages[activePage]}
          </div>
        </section>
      </div>

      {showCreateTenant && (
        <Modal title="Create Tenant" subtitle="Create a workspace owner and initial tenant workspace." onClose={() => setShowCreateTenant(false)} width={620}>
          <form onSubmit={submitNewTenant} style={{ display: 'grid', gap: 13 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <Field label="Business name">
                <input value={tenantBusinessName} onChange={(event) => setTenantBusinessName(event.target.value)} style={controlStyle} required />
              </Field>
              <Field label="Category">
                <input value={tenantCategory} onChange={(event) => setTenantCategory(event.target.value)} style={controlStyle} required />
              </Field>
            </div>
            <Field label="Address">
              <input value={tenantAddress} onChange={(event) => setTenantAddress(event.target.value)} style={controlStyle} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <Field label="Owner name">
                <input value={tenantOwnerName} onChange={(event) => setTenantOwnerName(event.target.value)} style={controlStyle} required />
              </Field>
              <Field label="Owner email">
                <input type="email" value={tenantOwnerEmail} onChange={(event) => setTenantOwnerEmail(event.target.value)} style={controlStyle} required />
              </Field>
            </div>
            <Field label="Temporary password" hint="Use at least 10 characters. The owner can change it after login.">
              <input type="password" minLength={10} value={tenantPassword} onChange={(event) => setTenantPassword(event.target.value)} style={controlStyle} required />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <Field label="Plan">
                <select value={tenantPlanForm} onChange={(event) => setTenantPlanForm(event.target.value as PlanType)} style={controlStyle}>
                  {planOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="Subscription status">
                <select value={tenantStatusForm} onChange={(event) => setTenantStatusForm(event.target.value as PlatformOrgStatus)} style={controlStyle}>
                  {orgStatusOptions.map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="secondary" onClick={() => setShowCreateTenant(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>Create tenant</Button>
            </div>
          </form>
        </Modal>
      )}

      {showCreateAdmin && (
        <Modal title="Create Platform Admin" subtitle="Only the SaaS platform owner can create platform operators." onClose={() => setShowCreateAdmin(false)}>
          <form onSubmit={submitNewAdmin} style={{ display: 'grid', gap: 13 }}>
            <Field label="Name">
              <input value={adminName} onChange={(event) => setAdminName(event.target.value)} style={controlStyle} required />
            </Field>
            <Field label="Email">
              <input type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} style={controlStyle} required />
            </Field>
            <Field label="Role">
              <select value={adminRole} onChange={(event) => setAdminRole(event.target.value as 'Super Admin' | 'Support Admin')} style={controlStyle}>
                {adminRoleOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Temporary password" hint="Use at least 10 characters and share it securely.">
              <input type="password" minLength={10} value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} style={controlStyle} required />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="secondary" onClick={() => setShowCreateAdmin(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>Create admin</Button>
            </div>
          </form>
        </Modal>
      )}

      {showCreateFlag && (
        <Modal title="Create Feature Flag" subtitle="Create a rollout control for platform or product capabilities." onClose={() => setShowCreateFlag(false)}>
          <form onSubmit={submitNewFeatureFlag} style={{ display: 'grid', gap: 13 }}>
            <Field label="Feature name">
              <input value={flagName} onChange={(event) => setFlagName(event.target.value)} style={controlStyle} required />
            </Field>
            <Field label="Description">
              <textarea value={flagDescription} onChange={(event) => setFlagDescription(event.target.value)} style={{ ...controlStyle, minHeight: 82, resize: 'vertical' }} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <Field label="Area">
                <select value={flagArea} onChange={(event) => setFlagArea(event.target.value as FeatureFlag['area'])} style={controlStyle}>
                  {featureAreaOptions.map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="Risk">
                <select value={flagRisk} onChange={(event) => setFlagRisk(event.target.value as FeatureFlag['risk'])} style={controlStyle}>
                  {featureRiskOptions.map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="Rollout">
                <select value={flagRollout} onChange={(event) => setFlagRollout(Number(event.target.value))} style={controlStyle}>
                  {rolloutOptions.map((item) => <option key={item} value={item}>{item}%</option>)}
                </select>
              </Field>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)', fontSize: 13 }}>
              <input type="checkbox" checked={flagEnabled} onChange={(event) => setFlagEnabled(event.target.checked)} />
              Enable this flag after creation
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="secondary" onClick={() => setShowCreateFlag(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>Create flag</Button>
            </div>
          </form>
        </Modal>
      )}

      {showCreateTicket && (
        <Modal title="Create Support Ticket" subtitle="Create owner-side support work for any tenant." onClose={() => setShowCreateTicket(false)}>
          <form onSubmit={submitNewTicket} style={{ display: 'grid', gap: 13 }}>
            <Field label="Tenant">
              <select value={ticketOrgId || organizations[0]?.id || ''} onChange={(event) => setTicketOrgId(event.target.value)} style={controlStyle} required>
                {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
              </select>
            </Field>
            <Field label="Subject">
              <input value={ticketSubject} onChange={(event) => setTicketSubject(event.target.value)} style={controlStyle} required placeholder="What needs attention?" />
            </Field>
            <Field label="Priority">
              <select value={ticketPriority} onChange={(event) => setTicketPriority(event.target.value as SupportPriority)} style={controlStyle}>
                {priorityOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="secondary" onClick={() => setShowCreateTicket(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>Create ticket</Button>
            </div>
          </form>
        </Modal>
      )}
    </main>
  );
}
