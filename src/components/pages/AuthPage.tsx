'use client';

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MessageSquareText,
  Mountain,
  PackageCheck,
  UserRound,
  Users,
} from 'lucide-react';
import { loginWithBackend, registerWithBackend, requestPasswordReset, resetPassword } from '@/lib/api';
import { languageName } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';

type PublicMode = 'landing' | 'login' | 'register';
type AuthMode = 'login' | 'reset';

const PRODUCT_IMAGE = '/rhinopeak-product-dashboard.svg';

const publicCopy = {
  en: {
    brand: 'RhinoPeak Business',
    subtitle: 'Business Dashboard',
    nav: {
      workflow: 'Workflow',
      platform: 'Platform',
      pricing: 'Pricing',
      login: 'Log in',
      start: 'Start free',
      dashboard: 'Dashboard',
    },
    hero: {
      kicker: 'Built for Nepali businesses',
      title: 'RhinoPeak Business',
      lead: 'Track sales, stock, customers, and staff roles in one clean dashboard.',
      body: 'Start with a real workspace, invite your team, and make better daily decisions without spreadsheets.',
      primary: 'Start free',
      secondary: 'Log in',
      dashboard: 'Open dashboard',
      alt: 'RhinoPeak Business product dashboard with sales, inventory, customers, and role controls',
    },
    workflow: {
      kicker: 'Daily workflow',
      title: 'Everything your team needs to run the day.',
      body: 'Record a sale, update stock, check a customer, and send reports from the same workspace.',
      items: [
        ['Record sales', 'Create invoices, track payments, discounts, refunds, and daily totals.'],
        ['Know customers', 'Keep contact details, notes, spend history, and follow-up reminders together.'],
        ['Control stock', 'See low stock, product margins, suppliers, and movement history before it becomes a problem.'],
        ['Close faster', 'Export reports, review billing, and share clean numbers with owners.'],
      ],
    },
    platform: {
      kicker: 'SaaS ready',
      title: 'One portal for each business. One separate portal for platform admins.',
      body: 'Tenant owners manage their own workspace. The platform owner manages accounts, plans, risk, and super admins from a separate panel.',
      checks: ['Dynamic roles for every workspace', 'English and Nepali public flow', 'MongoDB-backed records and sessions'],
      previewTitle: 'Live workspace',
      previewDate: 'Today',
      online: 'MongoDB online',
      stats: [
        ['8', 'Core modules'],
        ['Live', 'Database'],
        ['Dynamic', 'Roles'],
      ],
      queueTitle: 'Ready actions',
      queue: [
        ['New sale', 'Paid by FonePay'],
        ['Low stock', '12 items need reorder'],
        ['Customer note', 'Follow up tomorrow'],
      ],
    },
    pricing: {
      kicker: 'Pricing',
      title: 'Start free. Upgrade when your team grows.',
      plans: [
        ['Free', 'Rs. 0', 'For a new business owner starting with clean records.', ['100 sales entries monthly', 'Owner account', 'Basic reports', 'Core dashboard']],
        ['Pro', 'Rs. 1,499', 'For teams using sales, stock, reports, and roles every day.', ['Unlimited records', 'Custom team roles', 'Advanced analytics', 'Scheduled reports']],
      ],
      finalTitle: 'Ready to run from real data?',
      finalBody: 'Create your owner account and start adding products, customers, and sales today.',
      finalCta: 'Create workspace',
    },
    login: {
      sideKicker: 'Operator workspace',
      sideTitle: 'Know what sold, what is low, and who can access each feature.',
      welcome: 'Welcome back',
      resetKicker: 'Secure reset',
      title: 'Log in to your workspace',
      resetTitle: 'Reset your workspace password',
      body: 'Use your workspace email and password to continue.',
      resetBody: 'Request a reset code, then choose a new password.',
      email: 'Email',
      emailPlaceholder: 'owner@company.com',
      password: 'Password',
      newPassword: 'New password',
      passwordPlaceholder: 'Enter password',
      newPasswordPlaceholder: 'New secure password',
      resetCode: 'Reset code',
      resetCodePlaceholder: 'Paste reset code',
      sendCode: 'Send code',
      resetLink: 'Reset password',
      backToLogin: 'Back to login',
      submit: 'Log in',
      resetSubmit: 'Reset password',
      working: 'Working...',
      passwordUpdated: 'Password updated. You can log in now.',
      newHere: 'New to RhinoPeak Business?',
      createAccount: 'Create an account',
      hidePassword: 'Hide password',
      showPassword: 'Show password',
    },
    register: {
      login: 'Log in',
      kicker: 'Start free',
      title: 'Create your business workspace.',
      body: 'Add the owner account first. Products, customers, roles, billing, and reports are ready after signup.',
      bullets: [
        'Clean MongoDB workspace for your business',
        'Sales, CRM, inventory, reports, and billing included',
        'Create Sales, Inventory, Finance, or custom roles',
      ],
      name: 'Your name',
      namePlaceholder: 'Owner name',
      email: 'Work email',
      emailPlaceholder: 'owner@company.com',
      businessName: 'Business name',
      businessNamePlaceholder: 'Business or branch name',
      password: 'Password',
      passwordPlaceholder: 'At least 8 characters',
      businessType: 'Business type',
      plan: 'Plan',
      free: 'Free',
      proTrial: 'Pro trial',
      recommended: 'Recommended setup',
      recommendedBody: 'Start free, then upgrade from Billing when you need unlimited records, team seats, and scheduled reports.',
      submit: 'Create workspace',
      working: 'Creating workspace...',
      footnote: 'Use RhinoPeak Business for real business records and customer operations.',
      successNotice: 'Workspace created. Start by adding products, customers, and team roles.',
      types: ['Retail', 'Restaurant', 'Hotel', 'Travel agency', 'Wholesale', 'Services'],
    },
  },
  ne: {
    brand: 'राइनोपिक बिजनेस',
    subtitle: 'व्यवसाय ड्यासबोर्ड',
    nav: {
      workflow: 'कामको तरिका',
      platform: 'प्लेटफर्म',
      pricing: 'मूल्य',
      login: 'लग इन',
      start: 'निःशुल्क सुरु गर्नुहोस्',
      dashboard: 'ड्यासबोर्ड',
    },
    hero: {
      kicker: 'नेपाली व्यवसायका लागि',
      title: 'राइनोपिक बिजनेस',
      lead: 'बिक्री, स्टक, ग्राहक र कर्मचारी भूमिका एउटै सफा ड्यासबोर्डमा हेर्नुहोस्।',
      body: 'वास्तविक वर्कस्पेसबाट सुरु गर्नुहोस्, आफ्नो टोली थप्नुहोस्, र स्प्रेडसिट बिना राम्रो दैनिक निर्णय लिनुहोस्।',
      primary: 'निःशुल्क सुरु गर्नुहोस्',
      secondary: 'लग इन',
      dashboard: 'ड्यासबोर्ड खोल्नुहोस्',
      alt: 'बिक्री, स्टक, ग्राहक र भूमिका नियन्त्रण भएको राइनोपिक बिजनेस ड्यासबोर्ड',
    },
    workflow: {
      kicker: 'दैनिक काम',
      title: 'दिन चलाउन चाहिने सबै कुरा एउटै ठाउँमा।',
      body: 'बिक्री राख्नुहोस्, स्टक अपडेट गर्नुहोस्, ग्राहक हेर्नुहोस्, र रिपोर्ट पठाउनुहोस्।',
      items: [
        ['बिक्री राख्नुहोस्', 'इनभ्वाइस, भुक्तानी, छुट, फिर्ता र दैनिक जम्मा सजिलै ट्र्याक गर्नुहोस्।'],
        ['ग्राहक बुझ्नुहोस्', 'सम्पर्क, नोट, खर्च इतिहास र फलोअप एकै ठाउँमा राख्नुहोस्।'],
        ['स्टक नियन्त्रण गर्नुहोस्', 'कम स्टक, मार्जिन, सप्लायर र स्टक मूभमेन्ट पहिले नै हेर्नुहोस्।'],
        ['छिटो बन्द गर्नुहोस्', 'रिपोर्ट निर्यात गर्नुहोस्, बिलिङ हेर्नुहोस्, र मालिकलाई सफा नम्बर दिनुहोस्।'],
      ],
    },
    platform: {
      kicker: 'SaaS तयार',
      title: 'हरेक व्यवसायका लागि आफ्नै पोर्टल। प्लेटफर्म एडमिनका लागि छुट्टै पोर्टल।',
      body: 'टेनेन्ट मालिकले आफ्नै वर्कस्पेस चलाउँछन्। प्लेटफर्म मालिकले अकाउन्ट, प्लान, जोखिम र सुपर एडमिन छुट्टै प्यानलबाट चलाउँछन्।',
      checks: ['हरेक वर्कस्पेसमा डायनामिक भूमिका', 'अंग्रेजी र नेपाली सार्वजनिक फ्लो', 'MongoDB मा सुरक्षित रेकर्ड र सेसन'],
      previewTitle: 'लाइभ वर्कस्पेस',
      previewDate: 'आज',
      online: 'MongoDB अनलाइन',
      stats: [
        ['८', 'मुख्य मोड्युल'],
        ['लाइभ', 'डाटाबेस'],
        ['डायनामिक', 'भूमिका'],
      ],
      queueTitle: 'तयार काम',
      queue: [
        ['नयाँ बिक्री', 'FonePay बाट भुक्तानी'],
        ['कम स्टक', '१२ वस्तु फेरि मगाउनु पर्ने'],
        ['ग्राहक नोट', 'भोलि फलोअप'],
      ],
    },
    pricing: {
      kicker: 'मूल्य',
      title: 'निःशुल्क सुरु गर्नुहोस्। टोली बढेपछि अपग्रेड गर्नुहोस्।',
      plans: [
        ['निःशुल्क', 'रु. ०', 'सफा रेकर्डबाट सुरु गर्ने नयाँ व्यवसाय मालिकका लागि।', ['मासिक १०० बिक्री इन्ट्री', 'मालिक अकाउन्ट', 'आधारभूत रिपोर्ट', 'मुख्य ड्यासबोर्ड']],
        ['प्रो', 'रु. १,४९९', 'दैनिक बिक्री, स्टक, रिपोर्ट र भूमिका चलाउने टोलीका लागि।', ['असीमित रेकर्ड', 'कस्टम टोली भूमिका', 'एड्भान्स एनालिटिक्स', 'तालिकाबद्ध रिपोर्ट']],
      ],
      finalTitle: 'वास्तविक डाटाबाट चलाउन तयार हुनुहुन्छ?',
      finalBody: 'आफ्नो मालिक अकाउन्ट बनाउनुहोस् र आजै प्रडक्ट, ग्राहक र बिक्री थप्नुहोस्।',
      finalCta: 'वर्कस्पेस बनाउनुहोस्',
    },
    login: {
      sideKicker: 'अपरेटर वर्कस्पेस',
      sideTitle: 'के बिक्री भयो, के कम छ, र कसले कुन सुविधा चलाउन सक्छ भन्ने तुरुन्त हेर्नुहोस्।',
      welcome: 'फेरि स्वागत छ',
      resetKicker: 'सुरक्षित रिसेट',
      title: 'आफ्नो वर्कस्पेसमा लग इन गर्नुहोस्',
      resetTitle: 'वर्कस्पेस पासवर्ड रिसेट गर्नुहोस्',
      body: 'जारी राख्न आफ्नो वर्कस्पेस इमेल र पासवर्ड प्रयोग गर्नुहोस्।',
      resetBody: 'रिसेट कोड माग्नुहोस्, त्यसपछि नयाँ पासवर्ड राख्नुहोस्।',
      email: 'इमेल',
      emailPlaceholder: 'owner@company.com',
      password: 'पासवर्ड',
      newPassword: 'नयाँ पासवर्ड',
      passwordPlaceholder: 'पासवर्ड लेख्नुहोस्',
      newPasswordPlaceholder: 'नयाँ सुरक्षित पासवर्ड',
      resetCode: 'रिसेट कोड',
      resetCodePlaceholder: 'रिसेट कोड राख्नुहोस्',
      sendCode: 'कोड पठाउनुहोस्',
      resetLink: 'पासवर्ड रिसेट',
      backToLogin: 'लग इनमा फर्कनुहोस्',
      submit: 'लग इन',
      resetSubmit: 'पासवर्ड रिसेट',
      working: 'काम हुँदैछ...',
      passwordUpdated: 'पासवर्ड अपडेट भयो। अब लग इन गर्न सक्नुहुन्छ।',
      newHere: 'राइनोपिक बिजनेसमा नयाँ हुनुहुन्छ?',
      createAccount: 'अकाउन्ट बनाउनुहोस्',
      hidePassword: 'पासवर्ड लुकाउनुहोस्',
      showPassword: 'पासवर्ड देखाउनुहोस्',
    },
    register: {
      login: 'लग इन',
      kicker: 'निःशुल्क सुरु',
      title: 'आफ्नो व्यवसाय वर्कस्पेस बनाउनुहोस्।',
      body: 'पहिले मालिक अकाउन्ट थप्नुहोस्। साइनअपपछि प्रडक्ट, ग्राहक, भूमिका, बिलिङ र रिपोर्ट तयार हुन्छ।',
      bullets: [
        'आफ्नो व्यवसायका लागि सफा MongoDB वर्कस्पेस',
        'बिक्री, CRM, स्टक, रिपोर्ट र बिलिङ समावेश',
        'सेल्स, इन्भेन्टरी, फाइनान्स वा कस्टम भूमिका बनाउनुहोस्',
      ],
      name: 'तपाईंको नाम',
      namePlaceholder: 'मालिकको नाम',
      email: 'कामको इमेल',
      emailPlaceholder: 'owner@company.com',
      businessName: 'व्यवसायको नाम',
      businessNamePlaceholder: 'व्यवसाय वा शाखाको नाम',
      password: 'पासवर्ड',
      passwordPlaceholder: 'कम्तीमा ८ अक्षर',
      businessType: 'व्यवसाय प्रकार',
      plan: 'प्लान',
      free: 'निःशुल्क',
      proTrial: 'प्रो ट्रायल',
      recommended: 'सुझाव गरिएको सेटअप',
      recommendedBody: 'निःशुल्क सुरु गर्नुहोस्, पछि असीमित रेकर्ड, टोली सिट र तालिकाबद्ध रिपोर्ट चाहिँदा बिलिङबाट अपग्रेड गर्नुहोस्।',
      submit: 'वर्कस्पेस बनाउनुहोस्',
      working: 'वर्कस्पेस बनाउँदै...',
      footnote: 'राइनोपिक बिजनेस वास्तविक व्यवसाय र ग्राहक रेकर्डका लागि प्रयोग गर्नुहोस्।',
      successNotice: 'वर्कस्पेस बन्यो। अब प्रडक्ट, ग्राहक र टोली भूमिका थप्नुहोस्।',
      types: ['रिटेल', 'रेस्टुरेन्ट', 'होटल', 'ट्राभल एजेन्सी', 'होलसेल', 'सेवा'],
    },
  },
} as const;

type PublicCopy = (typeof publicCopy)[keyof typeof publicCopy];

const productStats = [0, 1, 2] as const;
const businessTypeValues = ['Retail', 'Restaurant', 'Hotel', 'Travel agency', 'Wholesale', 'Services'];

function usePublicCopy() {
  const language = useAppStore((state) => state.settings.language);
  return publicCopy[language] ?? publicCopy.en;
}

function Brand({ compact = false, copy }: { compact?: boolean; copy: PublicCopy }) {
  return (
    <Link href="/" className="flex items-center gap-3" aria-label={`${copy.brand} home`}>
      <span className={`${compact ? 'h-9 w-9' : 'h-10 w-10'} flex items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--accent-contrast)]`}>
        <Mountain size={compact ? 18 : 19} />
      </span>
      <span>
        <span className="block text-sm font-semibold tracking-tight">{copy.brand}</span>
        {!compact && <span className="block text-xs text-[var(--text-muted)]">{copy.subtitle}</span>}
      </span>
    </Link>
  );
}

function LanguageButton() {
  const { settings, setLanguage } = useAppStore();
  const next = settings.language === 'ne' ? 'en' : 'ne';
  const label = settings.language === 'ne' ? 'EN' : 'NE';
  return (
    <button
      type="button"
      onClick={() => setLanguage(next)}
      data-label={label}
      aria-label={settings.language === 'ne' ? 'Switch to English' : 'Switch to Nepali'}
      className="language-toggle rounded-lg px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
      title={languageName(settings.language)}
    >
      {label}
    </button>
  );
}

function PublicHeader({ copy, isAuthenticated }: { copy: PublicCopy; isAuthenticated: boolean }) {
  return (
    <header className="fixed left-0 right-0 top-0 z-40 border-b border-[var(--border-subtle)] bg-[color-mix(in_oklch,var(--surface-page)_90%,transparent)] backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Brand compact copy={copy} />
        <div className="hidden items-center gap-7 text-sm font-medium text-[var(--text-secondary)] md:flex">
          <a href="#workflow">{copy.nav.workflow}</a>
          <a href="#platform">{copy.nav.platform}</a>
          <a href="#pricing">{copy.nav.pricing}</a>
        </div>
        <div className="flex items-center gap-2">
          <LanguageButton />
          {isAuthenticated ? (
            <Link href="/dashboard" className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-contrast)] transition hover:bg-[var(--accent-strong)]">
              {copy.nav.dashboard}
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)] sm:inline-flex">
                {copy.nav.login}
              </Link>
              <Link href="/register" className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-contrast)] transition hover:bg-[var(--accent-strong)]">
                {copy.nav.start}
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

function LandingFlow() {
  const copy = usePublicCopy();
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);

  return (
    <main className="rhinopeak-connect-public min-h-screen bg-[var(--surface-page)] text-[var(--text-primary)]">
      <PublicHeader copy={copy} isAuthenticated={isAuthenticated} />

      <section className="relative min-h-[100svh] overflow-hidden pt-16">
        <div className="absolute inset-0 bg-[#071819]">
          <Image
            src={PRODUCT_IMAGE}
            alt={copy.hero.alt}
            fill
            priority
            unoptimized
            sizes="100vw"
            className="h-full w-full object-cover object-[62%_50%] opacity-80"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,oklch(12%_0.03_190/.96)_0%,oklch(14%_0.04_190/.82)_42%,oklch(14%_0.04_190/.34)_100%)]" />
        </div>
        <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-7xl items-center px-5 py-20 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-3xl text-white"
          >
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-[oklch(86%_0.09_160)]">
              {copy.hero.kicker}
            </p>
            <h1 className="max-w-4xl text-5xl font-semibold leading-[0.98] sm:text-7xl lg:text-8xl">
              {copy.hero.title}
            </h1>
            <p className="mt-7 max-w-2xl text-xl font-semibold leading-8 text-white sm:text-2xl">
              {copy.hero.lead}
            </p>
            <p className="mt-4 max-w-2xl text-base leading-8 text-[oklch(92%_0.01_230/.82)] sm:text-lg">
              {copy.hero.body}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              {isAuthenticated ? (
                <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-warm)] px-5 py-3 text-sm font-bold text-[var(--text-primary)] transition hover:brightness-95">
                  {copy.hero.dashboard} <ArrowRight size={16} />
                </Link>
              ) : (
                <>
                  <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-warm)] px-5 py-3 text-sm font-bold text-[var(--text-primary)] transition hover:brightness-95">
                    {copy.hero.primary} <ArrowRight size={16} />
                  </Link>
                  <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[oklch(94%_0.02_230/.28)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[oklch(98%_0.01_230/.1)]">
                    {copy.hero.secondary}
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      <section id="workflow" className="px-5 py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">{copy.workflow.kicker}</p>
              <h2 className="mt-4 max-w-xl text-4xl font-semibold sm:text-5xl">
                {copy.workflow.title}
              </h2>
              <p className="mt-5 max-w-lg leading-7 text-[var(--text-secondary)]">
                {copy.workflow.body}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {copy.workflow.items.map(([label, detail], index) => {
                const Icon = [CalendarCheck, Users, PackageCheck, MessageSquareText][index];
                return (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.35 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5"
                  >
                    <Icon size={20} className="text-[var(--accent)]" />
                    <h3 className="mt-5 text-base font-semibold">{label}</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{detail}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="border-y border-[var(--border-subtle)] bg-[var(--surface-muted)] px-5 py-24 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.45 }}
            className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-[var(--shadow-soft)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
              <div>
                <p className="text-sm font-semibold">{copy.platform.previewTitle}</p>
                <p className="text-xs text-[var(--text-muted)]">{copy.platform.previewDate}</p>
              </div>
              <span className="rounded-full bg-[var(--success-bg)] px-3 py-1 text-xs font-semibold text-[var(--success-text)]">{copy.platform.online}</span>
            </div>
            <div className="grid gap-px bg-[var(--border-subtle)] sm:grid-cols-3">
              {productStats.map((index) => (
                <div key={copy.platform.stats[index][1]} className="bg-[var(--surface-raised)] p-5">
                  <p className="text-2xl font-semibold">{copy.platform.stats[index][0]}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{copy.platform.stats[index][1]}</p>
                </div>
              ))}
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{copy.platform.queueTitle}</h3>
                <BarChart3 size={18} className="text-[var(--accent)]" />
              </div>
              <div className="mt-5 space-y-3">
                {copy.platform.queue.map(([item, detail], index) => (
                  <div key={item} className="flex items-center justify-between rounded-lg bg-[var(--surface-muted)] px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{item}</p>
                      <p className="text-xs text-[var(--text-muted)]">{detail}</p>
                    </div>
                    <CheckCircle2 size={16} className={index === 1 ? 'text-[var(--warning-text)]' : 'text-[var(--success-text)]'} />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">{copy.platform.kicker}</p>
            <h2 className="mt-4 text-4xl font-semibold sm:text-5xl">
              {copy.platform.title}
            </h2>
            <p className="mt-5 leading-7 text-[var(--text-secondary)]">
              {copy.platform.body}
            </p>
            <div className="mt-8 space-y-4">
              {copy.platform.checks.map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm font-medium">
                  <CheckCircle2 size={17} className="text-[var(--success-text)]" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="px-5 py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">{copy.pricing.kicker}</p>
            <h2 className="mt-4 text-4xl font-semibold sm:text-5xl">{copy.pricing.title}</h2>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {copy.pricing.plans.map(([name, price, detail, features]) => (
              <div key={name} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 shadow-[var(--shadow-soft)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">{name}</h3>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">{detail}</p>
                  </div>
                  <p className="text-2xl font-semibold">{price}</p>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <CheckCircle2 size={15} className="text-[var(--success-text)]" />
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-start justify-between gap-5 rounded-2xl bg-[var(--text-primary)] p-7 text-[var(--surface-page)] sm:flex-row sm:items-center">
            <div>
              <h2 className="text-2xl font-semibold">{copy.pricing.finalTitle}</h2>
              <p className="mt-2 text-sm text-[oklch(92%_0.01_230/.72)]">{copy.pricing.finalBody}</p>
            </div>
            <Link href={isAuthenticated ? '/dashboard' : '/register'} className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-warm)] px-5 py-3 text-sm font-bold text-[var(--text-primary)]">
              {isAuthenticated ? copy.hero.dashboard : copy.pricing.finalCta} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function LoginFlow() {
  const router = useRouter();
  const copy = usePublicCopy();
  const { completeAuth, markBackendOffline } = useAppStore();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    try {
      if (mode === 'reset') {
        await resetPassword(email, resetToken, password);
        setMode('login');
        setPassword('');
        setResetToken('');
        setMessage(copy.login.passwordUpdated);
        return;
      }
      const response = await loginWithBackend(email, password);
      completeAuth(response.user, response.session, response.bootstrap, `${copy.login.welcome}, ${response.user.name}.`);
      router.push('/dashboard');
    } catch (caught) {
      const nextError = caught instanceof Error ? caught.message : 'Authentication request failed.';
      if (/fetch|network|failed/i.test(nextError)) markBackendOffline(nextError);
      setError(nextError);
    } finally {
      setLoading(false);
    }
  };

  const sendResetToken = async () => {
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const response = await requestPasswordReset(email);
      setMessage(response.resetToken ? `Reset code generated: ${response.resetToken}` : response.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start password reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="rhinopeak-connect-public grid min-h-screen bg-[var(--surface-page)] text-[var(--text-primary)] lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden overflow-hidden bg-[#071819] lg:block">
        <Image
          src={PRODUCT_IMAGE}
          alt={copy.hero.alt}
          fill
          priority
          unoptimized
          sizes="50vw"
          className="object-cover object-[62%_50%] opacity-82"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,oklch(12%_0.03_190/.36),oklch(12%_0.03_190/.92))]" />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[oklch(86%_0.09_160)]">{copy.login.sideKicker}</p>
          <h1 className="mt-4 max-w-xl text-5xl font-semibold leading-tight">
            {copy.login.sideTitle}
          </h1>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-[var(--surface-muted)] px-5 py-10 sm:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-[460px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-7 shadow-[var(--shadow-soft)] sm:p-8"
        >
          <div className="mb-8 flex items-center justify-between gap-4">
            <Brand copy={copy} />
            <LanguageButton />
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">{mode === 'reset' ? copy.login.resetKicker : copy.login.welcome}</p>
            <h2 className="mt-2 text-3xl font-semibold">{mode === 'reset' ? copy.login.resetTitle : copy.login.title}</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              {mode === 'reset' ? copy.login.resetBody : copy.login.body}
            </p>
          </div>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">{copy.login.email}</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="input-dark w-full rounded-xl py-3 pl-10 pr-4 text-sm"
                  placeholder={copy.login.emailPlaceholder}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {mode === 'reset' && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">{copy.login.resetCode}</label>
                  <button type="button" onClick={sendResetToken} disabled={loading || !email.trim()} className="text-sm font-semibold text-[var(--accent)]">
                    {copy.login.sendCode}
                  </button>
                </div>
                <input
                  value={resetToken}
                  onChange={(event) => setResetToken(event.target.value)}
                  className="input-dark w-full rounded-xl px-4 py-3 text-sm"
                  placeholder={copy.login.resetCodePlaceholder}
                  required
                />
              </div>
            )}

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium text-[var(--text-secondary)]">{mode === 'reset' ? copy.login.newPassword : copy.login.password}</label>
                <button type="button" onClick={() => setMode(mode === 'reset' ? 'login' : 'reset')} className="text-sm font-semibold text-[var(--accent)]">
                  {mode === 'reset' ? copy.login.backToLogin : copy.login.resetLink}
                </button>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="input-dark w-full rounded-xl py-3 pl-10 pr-11 text-sm"
                  placeholder={mode === 'reset' ? copy.login.newPasswordPlaceholder : copy.login.passwordPlaceholder}
                  autoComplete={mode === 'reset' ? 'new-password' : 'current-password'}
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                  aria-label={showPassword ? copy.login.hidePassword : copy.login.showPassword}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-4 py-3 text-sm font-bold text-[var(--accent-contrast)]">
              {loading ? copy.login.working : mode === 'reset' ? <>{copy.login.resetSubmit} <ArrowRight size={16} /></> : <>{copy.login.submit} <ArrowRight size={16} /></>}
            </button>
          </form>

          {(message || error) && (
            <div className={`mt-7 rounded-xl border p-4 text-sm ${error ? 'border-[var(--danger-bg)] bg-[var(--danger-bg)] text-[var(--danger-text)]' : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)]'}`}>
              {error || message}
            </div>
          )}

          <p className="mt-8 text-center text-sm text-[var(--text-secondary)]">
            {copy.login.newHere}{' '}
            <Link href="/register" className="font-semibold text-[var(--accent)]">{copy.login.createAccount}</Link>
          </p>
        </motion.div>
      </section>
    </main>
  );
}

function RegisterFlow() {
  const router = useRouter();
  const copy = usePublicCopy();
  const { completeAuth, markBackendOffline } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    businessName: '',
    businessType: businessTypeValues[0],
    plan: 'free',
  });

  const set = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await registerWithBackend(form.name, form.email, form.password, form.businessName);
      completeAuth(response.user, response.session, response.bootstrap, copy.register.successNotice);
      router.push('/dashboard');
    } catch (caught) {
      const nextError = caught instanceof Error ? caught.message : 'Registration request failed.';
      if (/fetch|network|failed/i.test(nextError)) markBackendOffline(nextError);
      setError(nextError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="rhinopeak-connect-public min-h-screen bg-[var(--surface-page)] text-[var(--text-primary)]">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Brand compact copy={copy} />
        <div className="flex items-center gap-3">
          <LanguageButton />
          <Link href="/login" className="text-sm font-semibold text-[var(--accent)]">{copy.register.login}</Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:py-20">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">{copy.register.kicker}</p>
          <h1 className="mt-4 text-5xl font-semibold leading-tight">
            {copy.register.title}
          </h1>
          <p className="mt-5 max-w-xl leading-7 text-[var(--text-secondary)]">
            {copy.register.body}
          </p>
          <div className="mt-9 space-y-4">
            {copy.register.bullets.map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm font-medium">
                <CheckCircle2 size={18} className="text-[var(--success-text)]" />
                {item}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
          onSubmit={submit}
          className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 shadow-[var(--shadow-soft)]"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">{copy.register.name}</label>
              <div className="relative">
                <UserRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input value={form.name} onChange={(event) => set('name', event.target.value)} className="input-dark w-full rounded-xl py-3 pl-10 pr-4 text-sm" placeholder={copy.register.namePlaceholder} required />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">{copy.register.email}</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input type="email" value={form.email} onChange={(event) => set('email', event.target.value)} className="input-dark w-full rounded-xl py-3 pl-10 pr-4 text-sm" placeholder={copy.register.emailPlaceholder} required />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">{copy.register.businessName}</label>
            <div className="relative">
              <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input value={form.businessName} onChange={(event) => set('businessName', event.target.value)} className="input-dark w-full rounded-xl py-3 pl-10 pr-4 text-sm" placeholder={copy.register.businessNamePlaceholder} required />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">{copy.register.password}</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input type="password" value={form.password} onChange={(event) => set('password', event.target.value)} className="input-dark w-full rounded-xl py-3 pl-10 pr-4 text-sm" placeholder={copy.register.passwordPlaceholder} minLength={8} required />
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="register-business-type" className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">{copy.register.businessType}</label>
              <select id="register-business-type" value={form.businessType} onChange={(event) => set('businessType', event.target.value)} className="input-dark w-full rounded-xl px-3 py-3 text-sm">
                {businessTypeValues.map((type, index) => <option key={type} value={type}>{copy.register.types[index]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="register-plan" className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">{copy.register.plan}</label>
              <select id="register-plan" value={form.plan} onChange={(event) => set('plan', event.target.value)} className="input-dark w-full rounded-xl px-3 py-3 text-sm">
                <option value="free">{copy.register.free}</option>
                <option value="pro">{copy.register.proTrial}</option>
              </select>
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-[var(--surface-muted)] p-4">
            <p className="text-sm font-semibold">{copy.register.recommended}</p>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              {copy.register.recommendedBody}
            </p>
          </div>

          {error && (
            <div className="mt-5 rounded-xl border border-[var(--danger-bg)] bg-[var(--danger-bg)] p-4 text-sm text-[var(--danger-text)]">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-4 py-3 text-sm font-bold text-[var(--accent-contrast)]">
            {loading ? copy.register.working : <>{copy.register.submit} <ArrowRight size={16} /></>}
          </button>

          <p className="mt-5 text-center text-xs leading-5 text-[var(--text-muted)]">
            {copy.register.footnote}
          </p>
        </motion.form>
      </section>
    </main>
  );
}

export function AuthPage({ initialMode = 'login' }: { initialMode?: PublicMode }) {
  if (initialMode === 'landing') return <LandingFlow />;
  if (initialMode === 'register') return <RegisterFlow />;
  return <LoginFlow />;
}
