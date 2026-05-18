'use client';
import { useEffect, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { useAppStore } from '@/lib/store';
import { AnimatePresence, motion } from 'framer-motion';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const {
    isAuthenticated,
    session,
    lastNotice,
    backendStatus,
    clearNotice,
    hydrateFromBackend,
    logout,
    markBackendOffline,
  } = useAppStore();
  
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated || backendStatus !== 'idle' || !session?.accessToken) return;
    import('@/lib/api').then(({ getBootstrap }) => {
      getBootstrap(session.accessToken)
        .then(hydrateFromBackend)
        .catch((error: Error) => {
          const message = error.message || 'Backend API is not reachable.';
          if (/token|session/i.test(message)) {
            logout();
            router.push('/login');
            return;
          }
          markBackendOffline(message);
        });
    });
  }, [backendStatus, hydrateFromBackend, isAuthenticated, logout, markBackendOffline, router, session?.accessToken]);

  if (!isAuthenticated) return null;

  return (
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <Topbar />
        {lastNotice && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{ margin: '12px 20px 0', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}
          >
            <span>{lastNotice}</span>
            <button onClick={clearNotice} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 700 }}>Dismiss</button>
          </motion.div>
        )}
        <main style={{ flex: 1, padding: 20, overflowY: 'auto', position: 'relative' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
