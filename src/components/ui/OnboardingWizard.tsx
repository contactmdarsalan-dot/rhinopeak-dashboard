'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, PackageCheck, TrendingUp, Users, X, ArrowRight } from 'lucide-react';
import { useAppStore } from '@/lib/store';

const STEPS = [
  {
    id: 'welcome',
    icon: Building2,
    title: 'Welcome to RhinoPeak!',
    subtitle: 'Your business workspace is ready. Let us set things up in 3 quick steps.',
    color: '#1B4FD8',
  },
  {
    id: 'product',
    icon: PackageCheck,
    title: 'Add your first product',
    subtitle: 'Track stock, cost price, and reorder alerts for every item you sell.',
    color: '#0F9E6B',
  },
  {
    id: 'sale',
    icon: TrendingUp,
    title: 'Record your first sale',
    subtitle: 'Create an invoice, select a product, and record how your customer paid.',
    color: '#F59E0B',
  },
  {
    id: 'team',
    icon: Users,
    title: 'Invite your team (optional)',
    subtitle: 'Add staff, accountants, or managers with custom roles and permissions.',
    color: '#8B5CF6',
  },
] as const;

export function OnboardingWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const { setActivePage } = useAppStore();

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  const handleAction = () => {
    if (step === 1) {
      onClose();
      setActivePage('inventory');
    } else if (step === 2) {
      onClose();
      setActivePage('sales');
    } else if (step === 3) {
      onClose();
      setActivePage('team');
    } else {
      setStep((s) => s + 1);
    }
  };

  const actionLabel =
    step === 0
      ? 'Get Started'
      : step === 1
      ? 'Go to Inventory ->'
      : step === 2
      ? 'Go to Sales ->'
      : 'Go to Team ->';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <motion.div
        key={step}
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -10 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        style={{
          background: 'var(--bg-card, #1a2035)',
          border: '1px solid var(--border, rgba(255,255,255,0.1))',
          borderRadius: 20,
          padding: 36,
          width: '100%',
          maxWidth: 480,
          position: 'relative',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close onboarding"
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
          }}
        >
          <X size={18} />
        </button>

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              style={{
                height: 4,
                flex: 1,
                borderRadius: 2,
                background:
                  i <= step ? current.color : 'var(--border, rgba(255,255,255,0.1))',
                transition: 'background 0.3s',
              }}
            />
          ))}
        </div>

        {/* Step icon */}
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 16,
            background: `${current.color}20`,
            border: `2px solid ${current.color}40`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          <Icon size={28} color={current.color} />
        </div>

        {/* Step counter */}
        <p
          style={{
            color: 'var(--text-muted)',
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 8,
          }}
        >
          Step {step + 1} of {STEPS.length}
        </p>

        {/* Title & subtitle */}
        <h2
          style={{
            color: 'var(--text-primary, white)',
            fontSize: 22,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          {current.title}
        </h2>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: 14,
            lineHeight: 1.6,
            marginBottom: 28,
          }}
        >
          {current.subtitle}
        </p>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          {!isFirst && (
            <button
              onClick={() => setStep((s) => s - 1)}
              style={{
                flex: '0 0 auto',
                padding: '11px 18px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 10,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Back
            </button>
          )}

          <button
            onClick={handleAction}
            style={{
              flex: 1,
              padding: '12px 20px',
              background: current.color,
              color: 'white',
              border: 'none',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {actionLabel}
            {step === 0 && <ArrowRight size={16} />}
          </button>

          {isLast && (
            <button
              onClick={onClose}
              style={{
                flex: '0 0 auto',
                padding: '11px 18px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 10,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Skip
            </button>
          )}
        </div>

        {/* Global skip link (non-last steps) */}
        {!isLast && (
          <button
            onClick={onClose}
            style={{
              width: '100%',
              marginTop: 12,
              padding: '8px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Skip setup for now
          </button>
        )}
      </motion.div>
    </div>
  );
}
