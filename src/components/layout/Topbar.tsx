'use client';
import { useMemo, useState } from 'react';
import { Bell, Building2, Languages, LogOut, Moon, Search, Sun, User } from 'lucide-react';
import { Badge } from '@/components/ui/Primitives';
import { planLimits } from '@/lib/domain';
import { languageName, translate } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';

const pageTitleKey: Record<string, Parameters<typeof translate>[1]> = {
  '/dashboard': 'nav.dashboard',
  '/sales': 'nav.sales',
  '/analytics': 'nav.analytics',
  '/customers': 'nav.customers',
  '/inventory': 'nav.inventory',
  '/reports': 'nav.reports',
  '/team': 'nav.team',
  '/billing': 'nav.billing',
  '/settings': 'nav.settings',
};

const getPageTitle = (pathname: string, language: Parameters<typeof translate>[0]) => {
  const key = pageTitleKey[pathname];
  if (key) return translate(language, key);
  const segment = pathname.split('/')[1];
  return segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : 'Dashboard';
};

export function Topbar() {
  const {
    theme,
    toggleTheme,
    inventory,
    sales,
    plan,
    businesses,
    activeBusinessId,
    switchBusiness,
    settings,
    updateSettings,
    currentUser,
    backendStatus,
    backendMessage,
    logout,
    globalSearch,
    setGlobalSearch,
  } = useAppStore();
  
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const t = (key: Parameters<typeof translate>[1]) => translate(settings.language, key);

  const notifications = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7);
    const usage = sales.filter((sale) => !sale.deletedAt && sale.date.startsWith(month)).length;
    const stock = inventory
      .filter((product) => product.status !== 'In Stock')
      .map((product) => ({
        id: product.id,
        severity: product.status === 'Out of Stock' ? 'critical' : 'warning',
        message: `${product.name}: ${product.status.toLowerCase()} (${product.stock} left)`,
      }));
    const planUsage = plan === 'free' && usage >= planLimits.salesEntries * 0.8
      ? [{
          id: 'usage',
          severity: 'info',
          message: `${usage}/${planLimits.salesEntries} free sales entries used this month.`,
        }]
      : [];
    return [...stock, ...planUsage];
  }, [inventory, plan, sales]);

  const activeBusiness = businesses.find((business) => business.id === activeBusinessId) ?? businesses[0];

  return (
    <header
      style={{
        minHeight: 64,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '10px 20px',
        gap: 14,
        position: 'sticky',
        top: 0,
        zIndex: 30,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: '1 1 180px', minWidth: 160 }}>
        <motion.h1 
          key={pathname}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 16 }}
        >
          {getPageTitle(pathname, settings.language)}
        </motion.h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>
          {new Date().toLocaleDateString(settings.language === 'ne' ? 'ne-NP' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '7px 10px',
          minWidth: 190,
          flex: '0 1 260px',
          transition: 'border-color 0.2s ease',
        }}
        onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
        onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
      >
        <Building2 size={14} color="var(--text-muted)" />
        <select
          value={activeBusiness?.id ?? ''}
          onChange={(event) => switchBusiness(event.target.value)}
          disabled={!businesses.length}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: 12,
            width: '100%',
            cursor: 'pointer',
          }}
        >
          {!businesses.length && <option value="">{t('topbar.noWorkspace')}</option>}
          {businesses.map((business) => (
            <option key={business.id} value={business.id}>
              {business.name}
            </option>
          ))}
        </select>
      </label>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '7px 10px',
          minWidth: 180,
          flex: '0 1 260px',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent-glow)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <Search size={14} color="var(--text-muted)" />
        <input
          value={globalSearch}
          onChange={(event) => setGlobalSearch(event.target.value)}
          type="text"
          placeholder={t('topbar.search')}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: 13,
            width: '100%',
          }}
        />
      </label>

      <Badge tone={plan === 'pro' ? 'success' : 'warning'}>{plan === 'pro' ? 'Pro' : 'Free'}</Badge>
      <span title={backendMessage}>
        <Badge tone={backendStatus === 'online' ? 'success' : backendStatus === 'offline' ? 'danger' : 'info'}>
          {backendStatus === 'online' ? t('topbar.dbOnline') : backendStatus === 'offline' ? t('topbar.dbOffline') : t('topbar.dbCheck')}
        </Badge>
      </span>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => updateSettings({ language: settings.language === 'ne' ? 'en' : 'ne' })}
        style={{
          minWidth: 58,
          height: 36,
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--bg-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          fontSize: 12,
          fontWeight: 700,
        }}
        title={languageName(settings.language)}
      >
        <Languages size={15} />
        {settings.language === 'ne' ? 'NE' : 'EN'}
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={toggleTheme}
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--bg-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
        }}
        title="Toggle theme"
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </motion.button>

      <div style={{ position: 'relative' }}>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowNotifs(!showNotifs)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            position: 'relative',
          }}
        >
          <Bell size={16} />
          {notifications.length > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--danger)',
                border: '2px solid var(--bg-secondary)',
              }}
            />
          )}
        </motion.button>

        <AnimatePresence>
          {showNotifs && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'absolute',
                right: 0,
                top: 44,
                width: 330,
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                zIndex: 100,
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 13 }}>{t('topbar.notifications')}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>{notifications.length} {t('topbar.activeAlerts')}</p>
              </div>
              {notifications.length ? notifications.map((alert) => (
                <div key={alert.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 10 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      marginTop: 5,
                      flexShrink: 0,
                      background: alert.severity === 'critical' ? 'var(--danger)' : alert.severity === 'warning' ? 'var(--warning)' : 'var(--info)',
                    }}
                  />
                  <p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5 }}>{alert.message}</p>
                </div>
              )) : (
                <p style={{ color: 'var(--text-muted)', fontSize: 12, padding: 16 }}>{t('topbar.noNotifications')}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div style={{ position: 'relative' }}>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowProfile(!showProfile)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: 'none',
            background: 'linear-gradient(135deg, #6366f1, #22d3ee)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          title="Profile"
        >
          <User size={16} color="#fff" />
        </motion.button>
        <AnimatePresence>
          {showProfile && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'absolute',
                right: 0,
                top: 44,
                width: 240,
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                overflow: 'hidden',
                zIndex: 100,
              }}
            >
              <div style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
                <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 700 }}>{currentUser.name}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>{currentUser.role} - {currentUser.email}</p>
              </div>
              <button
                onClick={() => {
                  router.push('/settings');
                  setShowProfile(false);
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border-subtle)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', textAlign: 'left', cursor: 'pointer', fontSize: 13, transition: 'background 0.2s ease' }}
              >
                {t('topbar.accountSettings')}
              </button>
              <button
                onClick={logout}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--danger-glow)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: 'var(--danger)', textAlign: 'left', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.2s ease' }}
              >
                <LogOut size={14} /> {t('topbar.logout')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
