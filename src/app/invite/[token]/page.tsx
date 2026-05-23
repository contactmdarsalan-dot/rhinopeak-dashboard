'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle2, Mountain, Users, ShieldCheck, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { acceptInviteInBackend, getInviteInBackend } from '@/lib/api';
import { useAppStore } from '@/lib/store';

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const completeAuth = useAppStore((state) => state.completeAuth);
  const token = params.token as string;
  const [status, setStatus] = useState<'loading' | 'ready' | 'accepting' | 'done' | 'error'>('loading');
  const [inviteInfo, setInviteInfo] = useState<{
    workspaceName: string;
    inviterName: string;
    role: string;
    email: string;
  } | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getInviteInBackend(token)
      .then((data) => {
        if (data.invite) {
          setInviteInfo(data.invite);
          setStatus('ready');
        } else {
          setInviteInfo({
            workspaceName: 'RhinoPeak Workspace',
            inviterName: 'Your admin',
            role: 'Staff',
            email: '',
          });
          setStatus('ready');
        }
      })
      .catch(() => {
        // Still show the form even if backend call fails
        setInviteInfo({
          workspaceName: 'RhinoPeak Workspace',
          inviterName: 'Your admin',
          role: 'Staff',
          email: '',
        });
        setStatus('ready');
      });
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('accepting');
    setError('');
    try {
      const data = await acceptInviteInBackend({ token, password });
      completeAuth(data.user, data.session, data.bootstrap, 'Welcome to your workspace.');
      setStatus('done');
      setTimeout(() => router.push('/dashboard'), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation.');
      setStatus('ready');
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f1629 0%, #1a2744 50%, #0f1629 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: '100%',
          maxWidth: 460,
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20,
          padding: 36,
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div
            style={{
              width: 38,
              height: 38,
              background: '#1B4FD8',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Mountain size={18} color="white" />
          </div>
          <div>
            <p style={{ color: 'white', fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>
              RhinoPeak Business
            </p>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>Business Dashboard</p>
          </div>
        </div>

        {/* Loading state */}
        {status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div
              style={{
                width: 40,
                height: 40,
                border: '3px solid rgba(255,255,255,0.1)',
                borderTopColor: '#1B4FD8',
                borderRadius: '50%',
                margin: '0 auto 16px',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Loading invitation...</p>
          </div>
        )}

        {/* Success state */}
        {status === 'done' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <CheckCircle2 size={56} color="#0F9E6B" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ color: 'white', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
              Welcome aboard!
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
              Your account is ready. Redirecting to your dashboard...
            </p>
          </div>
        )}

        {/* Ready / accepting state */}
        {(status === 'ready' || status === 'accepting') && inviteInfo && (
          <>
            {/* Invite info card */}
            <div
              style={{
                background: 'rgba(27,79,216,0.15)',
                border: '1px solid rgba(27,79,216,0.3)',
                borderRadius: 12,
                padding: 16,
                marginBottom: 24,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Users size={16} color="#6B9FFF" />
                <p
                  style={{
                    color: '#6B9FFF',
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  Team Invitation
                </p>
              </div>
              <p style={{ color: 'white', fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
                {inviteInfo.workspaceName}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                {inviteInfo.inviterName} has invited you to join as{' '}
                <span style={{ color: '#6B9FFF', fontWeight: 600 }}>{inviteInfo.role}</span>
              </p>
            </div>

            {/* Role badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <ShieldCheck size={14} color="#0F9E6B" />
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                You will join with the{' '}
                <strong style={{ color: 'white' }}>{inviteInfo.role}</strong> role and its
                permissions.
              </p>
            </div>

            <form onSubmit={handleAccept} style={{ display: 'grid', gap: 14 }}>
              {inviteInfo.email && (
                <div>
                  <label
                    style={{
                      color: 'rgba(255,255,255,0.7)',
                      fontSize: 12,
                      fontWeight: 600,
                      display: 'block',
                      marginBottom: 6,
                    }}
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    value={inviteInfo.email}
                    readOnly
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10,
                      color: 'rgba(255,255,255,0.6)',
                      fontSize: 14,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              <div>
                <label
                  style={{
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  Create Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 10,
                    color: 'white',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {error && (
                <div
                  style={{
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 8,
                    padding: '10px 14px',
                  }}
                >
                  <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={status === 'accepting'}
                style={{
                  background: '#1B4FD8',
                  color: 'white',
                  border: 'none',
                  borderRadius: 10,
                  padding: '13px 20px',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: status === 'accepting' ? 'not-allowed' : 'pointer',
                  opacity: status === 'accepting' ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {status === 'accepting' ? (
                  'Joining workspace...'
                ) : (
                  <>
                    <span>Accept &amp; Join Workspace</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <p
              style={{
                textAlign: 'center',
                marginTop: 18,
                color: 'rgba(255,255,255,0.4)',
                fontSize: 12,
              }}
            >
              Already have an account?{' '}
              <Link href="/login" style={{ color: '#6B9FFF', textDecoration: 'none' }}>
                Log in
              </Link>
            </p>
          </>
        )}
      </motion.div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus { border-color: #1B4FD8 !important; }
      `}</style>
    </main>
  );
}
