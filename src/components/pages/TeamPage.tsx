'use client';
import { FormEvent, useMemo, useState } from 'react';
import { KeyRound, Plus, Save, ShieldCheck, Trash2, UserCog } from 'lucide-react';
import { Badge, Button, Field, Modal, Panel, PanelHeader, ProGate, StatTile, controlStyle } from '@/components/ui/Primitives';
import {
  permissionCatalog,
  type PermissionArea,
  type PermissionKey,
  type UserRole,
} from '@/lib/domain';
import { useAppStore } from '@/lib/store';

function roleTone(role: UserRole) {
  if (role === 'Owner') return 'success';
  if (role === 'Manager') return 'accent';
  if (role === 'Sales') return 'info';
  if (role === 'Inventory' || role === 'Accountant') return 'warning';
  if (role === 'Staff') return 'info';
  return 'neutral';
}

function areaPermissions() {
  return permissionCatalog.reduce<Record<PermissionArea, typeof permissionCatalog>>((groups, permission) => {
    groups[permission.area] = [...(groups[permission.area] ?? []), permission];
    return groups;
  }, {} as Record<PermissionArea, typeof permissionCatalog>);
}

function PermissionChecklist({
  selectedPermissions,
  disabled,
  onToggle,
}: {
  selectedPermissions: PermissionKey[];
  disabled?: boolean;
  onToggle: (permission: PermissionKey) => void;
}) {
  const groupedPermissions = areaPermissions();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
      {Object.entries(groupedPermissions).map(([area, permissions]) => (
        <div key={area} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'var(--bg-primary)' }}>
          <p style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 800, marginBottom: 10 }}>{area}</p>
          <div style={{ display: 'grid', gap: 8 }}>
            {permissions.map((permission) => {
              const checked = selectedPermissions.includes(permission.key);
              return (
                <label key={permission.key} style={{ display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr)', gap: 8, alignItems: 'start', cursor: disabled ? 'not-allowed' : 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => onToggle(permission.key)}
                    style={{ marginTop: 2, accentColor: 'var(--accent)' }}
                  />
                  <span>
                    <span style={{ color: checked ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 12, fontWeight: 700 }}>{permission.label}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.45, display: 'block', marginTop: 2 }}>{permission.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TeamPage() {
  const {
    teamMembers,
    roleDefinitions,
    auditLogs,
    plan,
    currentUser,
    inviteUser,
    updateUserRole,
    removeUser,
    createRole,
    updateRole,
    deleteRole,
    hasPermission,
    setActivePage,
  } = useAppStore();
  const [showInvite, setShowInvite] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState(roleDefinitions[0]?.id ?? 'role-owner');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('Sales');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [newRolePermissions, setNewRolePermissions] = useState<PermissionKey[]>(['dashboard.view']);

  const canInvite = hasPermission('users.invite');
  const canManageUsers = hasPermission('users.manage');
  const canManageRoles = hasPermission('roles.manage');
  const selectedRole = roleDefinitions.find((item) => item.id === selectedRoleId) ?? roleDefinitions[0];

  const roleUsage = useMemo(() => {
    return roleDefinitions.reduce<Record<string, number>>((usage, item) => {
      usage[item.name] = teamMembers.filter((member) => member.role === item.name).length;
      return usage;
    }, {});
  }, [roleDefinitions, teamMembers]);

  const submitInvite = (event: FormEvent) => {
    event.preventDefault();
    const ok = inviteUser(name, email, role);
    if (ok) {
      setShowInvite(false);
      setName('');
      setEmail('');
      setRole('Sales');
    }
  };

  const submitRole = (event: FormEvent) => {
    event.preventDefault();
    const ok = createRole({
      name: newRoleName,
      description: newRoleDescription,
      permissions: newRolePermissions,
    });
    if (ok) {
      setShowRoleModal(false);
      setNewRoleName('');
      setNewRoleDescription('');
      setNewRolePermissions(['dashboard.view']);
    }
  };

  const toggleSelectedRolePermission = (permission: PermissionKey) => {
    if (!selectedRole || selectedRole.name === 'Owner') return;
    const permissions = selectedRole.permissions.includes(permission)
      ? selectedRole.permissions.filter((item) => item !== permission)
      : [...selectedRole.permissions, permission];
    updateRole(selectedRole.id, { permissions });
  };

  const toggleNewRolePermission = (permission: PermissionKey) => {
    setNewRolePermissions((permissions) => (
      permissions.includes(permission)
        ? permissions.filter((item) => item !== permission)
        : [...permissions, permission]
    ));
  };

  const editableRoles = roleDefinitions.filter((item) => item.name !== 'Owner');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          SaaS team access with custom tenant roles, feature-level permissions, and admin-controlled assignments.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" disabled={!canManageRoles} onClick={() => setShowRoleModal(true)}>
            <KeyRound size={14} /> New Role
          </Button>
          <Button disabled={!canInvite} onClick={() => plan === 'pro' ? setShowInvite(true) : setActivePage('billing')}>
            <Plus size={14} /> Invite User
          </Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <StatTile label="Seats used" value={teamMembers.length} detail={plan === 'pro' ? 'Pro supports up to 10 seats' : 'Free includes owner only'} />
        <StatTile label="Active users" value={teamMembers.filter((member) => member.status === 'Active').length} tone="success" />
        <StatTile label="Tenant roles" value={roleDefinitions.length} detail={`${roleDefinitions.filter((item) => !item.systemRole).length} custom roles`} tone="accent" />
        <StatTile label="Your permissions" value={roleDefinitions.find((item) => item.name === currentUser.role)?.permissions.length ?? 0} detail={currentUser.role} tone="warning" />
      </div>

      {plan !== 'pro' && (
        <ProGate message="Multi-user invites remain a Pro control. Role design is available so owners can prepare access before upgrading." onUpgrade={() => setActivePage('billing')} />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(320px,0.72fr)', gap: 16 }}>
        <Panel>
          <PanelHeader title="Team Members" subtitle="Assign every user to a tenant role" />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Name', 'Email', 'Role', 'Permissions', 'Status', 'Actions'].map((header) => (
                    <th key={header} style={{ padding: '11px 14px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 650, textAlign: 'left', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamMembers.map((member, index) => {
                  const memberRole = roleDefinitions.find((item) => item.name === member.role);
                  return (
                    <tr key={member.id} style={{ borderBottom: index < teamMembers.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                      <td style={{ padding: '12px 14px', color: 'var(--text-primary)', fontWeight: 700, fontSize: 13 }}>{member.name}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>{member.email}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <select
                          value={member.role}
                          disabled={member.role === 'Owner' || !canManageUsers}
                          onChange={(event) => updateUserRole(member.id, event.target.value)}
                          style={{ ...controlStyle, minHeight: 30, padding: '4px 8px', width: 140 }}
                        >
                          {roleDefinitions.map((item) => <option key={item.id}>{item.name}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '12px 14px' }}><Badge tone={roleTone(member.role)}>{memberRole?.permissions.length ?? 0} features</Badge></td>
                      <td style={{ padding: '12px 14px' }}><Badge tone={member.status === 'Active' ? 'success' : 'warning'}>{member.status}</Badge></td>
                      <td style={{ padding: '12px 14px' }}>
                        <Button variant="ghost" disabled={member.role === 'Owner' || !canManageUsers} onClick={() => removeUser(member.id)} title="Remove user">
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Activity Log" subtitle="Recent security and access changes" />
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 460, overflowY: 'auto' }}>
            {auditLogs.slice(0, 14).map((log) => (
              <div key={log.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 11, background: 'var(--bg-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 700 }}>{log.action}</p>
                  <Badge tone="neutral">{log.module}</Badge>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 3 }}>{log.detail}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 3 }}>{log.createdAt} by {log.user}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Role Builder"
          subtitle="Create roles like Sales, Inventory, Accountant, or your own, then choose exact features"
          action={<Badge tone={canManageRoles ? 'success' : 'warning'}>{canManageRoles ? 'Editable' : 'View only'}</Badge>}
        />
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr)', gap: 16 }}>
          <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
            {roleDefinitions.map((item) => {
              const selected = item.id === selectedRole?.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedRoleId(item.id)}
                  style={{
                    border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                    background: selected ? 'var(--accent-glow)' : 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    borderRadius: 10,
                    padding: 12,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 800 }}>{item.name}</span>
                    <Badge tone={item.systemRole ? 'neutral' : 'accent'}>{item.systemRole ? 'System' : 'Custom'}</Badge>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 5 }}>{item.permissions.length} permissions, {roleUsage[item.name] ?? 0} users</p>
                </button>
              );
            })}
          </div>

          {selectedRole && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <ShieldCheck size={16} color="var(--accent)" />
                    <p style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 800 }}>{selectedRole.name}</p>
                    <Badge tone={roleTone(selectedRole.name)}>{selectedRole.permissions.length} features</Badge>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.6, marginTop: 5 }}>{selectedRole.description}</p>
                </div>
                <Button
                  variant="danger"
                  disabled={!canManageRoles || selectedRole.systemRole}
                  onClick={() => deleteRole(selectedRole.id)}
                  title={selectedRole.systemRole ? 'System roles cannot be deleted' : 'Delete role and move assigned users to Staff'}
                >
                  <Trash2 size={14} /> Delete
                </Button>
              </div>

              {!selectedRole.systemRole && canManageRoles && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 0.5fr) minmax(240px, 1fr) auto', gap: 10, alignItems: 'end' }}>
                  <Field label="Role name">
                    <input
                      value={selectedRole.name}
                      onChange={(event) => updateRole(selectedRole.id, { name: event.target.value })}
                      style={controlStyle}
                    />
                  </Field>
                  <Field label="Description">
                    <input
                      value={selectedRole.description}
                      onChange={(event) => updateRole(selectedRole.id, { description: event.target.value })}
                      style={controlStyle}
                    />
                  </Field>
                  <Button variant="secondary" disabled>
                    <Save size={14} /> Auto saved
                  </Button>
                </div>
              )}

              <PermissionChecklist
                selectedPermissions={selectedRole.permissions}
                disabled={!canManageRoles || selectedRole.name === 'Owner'}
                onToggle={toggleSelectedRolePermission}
              />
            </div>
          )}
        </div>
      </Panel>

      {showInvite && (
        <Modal title="Invite Team Member" subtitle="Assign a tenant role with exact feature permissions" onClose={() => setShowInvite(false)}>
          <form onSubmit={submitInvite} style={{ display: 'grid', gap: 13 }}>
            <Field label="Name"><input value={name} onChange={(event) => setName(event.target.value)} style={controlStyle} required /></Field>
            <Field label="Email"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} style={controlStyle} required /></Field>
            <Field label="Role">
              <select value={role} onChange={(event) => setRole(event.target.value)} style={controlStyle}>
                {editableRoles.map((item) => <option key={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'var(--bg-primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserCog size={14} color="var(--accent)" />
                <Badge tone={roleTone(role)}>{role}</Badge>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 6 }}>
                This invite receives {roleDefinitions.find((item) => item.name === role)?.permissions.length ?? 0} feature permissions.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="secondary" onClick={() => setShowInvite(false)}>Cancel</Button>
              <Button type="submit">Send Invite</Button>
            </div>
          </form>
        </Modal>
      )}

      {showRoleModal && (
        <Modal title="Create Custom Role" subtitle="Build a tenant-specific role for a team or department" onClose={() => setShowRoleModal(false)} width={860}>
          <form onSubmit={submitRole} style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 0.5fr) minmax(240px, 1fr)', gap: 12 }}>
              <Field label="Role name">
                <input value={newRoleName} onChange={(event) => setNewRoleName(event.target.value)} style={controlStyle} placeholder="Warehouse Lead" required />
              </Field>
              <Field label="Description">
                <input value={newRoleDescription} onChange={(event) => setNewRoleDescription(event.target.value)} style={controlStyle} placeholder="Can manage stock and view sales context." />
              </Field>
            </div>
            <PermissionChecklist selectedPermissions={newRolePermissions} onToggle={toggleNewRolePermission} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{newRolePermissions.length} permissions selected</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <Button variant="secondary" onClick={() => setShowRoleModal(false)}>Cancel</Button>
                <Button type="submit">Create Role</Button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
