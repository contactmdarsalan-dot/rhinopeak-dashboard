import type { AppLanguage } from '@/lib/domain';

type TranslationKey =
  | 'app.subtitle'
  | 'workspace.free'
  | 'workspace.pro'
  | 'nav.dashboard'
  | 'nav.sales'
  | 'nav.analytics'
  | 'nav.customers'
  | 'nav.inventory'
  | 'nav.reports'
  | 'nav.team'
  | 'nav.billing'
  | 'nav.settings'
  | 'nav.collapse'
  | 'topbar.noWorkspace'
  | 'topbar.search'
  | 'topbar.dbOnline'
  | 'topbar.dbOffline'
  | 'topbar.dbCheck'
  | 'topbar.notifications'
  | 'topbar.activeAlerts'
  | 'topbar.noNotifications'
  | 'topbar.accountSettings'
  | 'topbar.logout'
  | 'settings.businessProfile'
  | 'settings.businessProfileCopy'
  | 'settings.businessName'
  | 'settings.currency'
  | 'settings.language'
  | 'settings.languageCopy'
  | 'settings.timezone'
  | 'settings.fiscalYear'
  | 'settings.taxRate'
  | 'settings.invoicePrefix'
  | 'settings.receiptFooter'
  | 'settings.defaultPayment'
  | 'settings.appearance'
  | 'settings.appearanceCopy'
  | 'settings.darkMode'
  | 'settings.compactTables'
  | 'settings.security'
  | 'settings.securityCopy'
  | 'settings.twoFactor'
  | 'settings.lowStock'
  | 'settings.dailySales'
  | 'settings.newCustomer'
  | 'settings.scheduledReports'
  | 'settings.accountData'
  | 'settings.accountDataCopy'
  | 'settings.exportData'
  | 'settings.deleteAccount'
  | 'auth.loginTitle'
  | 'auth.registerTitle'
  | 'auth.resetTitle'
  | 'auth.loginCopy'
  | 'auth.registerCopy'
  | 'auth.resetCopy'
  | 'auth.login'
  | 'auth.register'
  | 'auth.reset'
  | 'auth.email'
  | 'auth.password'
  | 'auth.newPassword'
  | 'auth.ownerName'
  | 'auth.businessName'
  | 'auth.resetCode'
  | 'auth.sendCode'
  | 'auth.working'
  | 'auth.signIn'
  | 'auth.createWorkspace'
  | 'auth.resetPassword'
  | 'auth.footnote';

const translations: Record<AppLanguage, Record<TranslationKey, string>> = {
  en: {
    'app.subtitle': 'Business Dashboard',
    'workspace.free': 'Free workspace',
    'workspace.pro': 'Pro workspace',
    'nav.dashboard': 'Dashboard',
    'nav.sales': 'Sales',
    'nav.analytics': 'Analytics',
    'nav.customers': 'Customers',
    'nav.inventory': 'Inventory',
    'nav.reports': 'Reports',
    'nav.team': 'Team & Roles',
    'nav.billing': 'Billing',
    'nav.settings': 'Settings',
    'nav.collapse': 'Collapse',
    'topbar.noWorkspace': 'No workspace',
    'topbar.search': 'Search modules...',
    'topbar.dbOnline': 'DB online',
    'topbar.dbOffline': 'DB offline',
    'topbar.dbCheck': 'DB check',
    'topbar.notifications': 'Notifications',
    'topbar.activeAlerts': 'active alerts',
    'topbar.noNotifications': 'No notifications.',
    'topbar.accountSettings': 'Account settings',
    'topbar.logout': 'Logout',
    'settings.businessProfile': 'Business Profile',
    'settings.businessProfileCopy': 'Used in reports, exports, invoices, and organization switching',
    'settings.businessName': 'Business Name',
    'settings.currency': 'Currency',
    'settings.language': 'Language',
    'settings.languageCopy': 'Switch the main portal shell between English and Nepali',
    'settings.timezone': 'Timezone',
    'settings.fiscalYear': 'Fiscal Year Start',
    'settings.taxRate': 'Default VAT / Tax Rate',
    'settings.invoicePrefix': 'Invoice Prefix',
    'settings.receiptFooter': 'Receipt Footer',
    'settings.defaultPayment': 'Default Payment Method',
    'settings.appearance': 'Appearance & Memory',
    'settings.appearanceCopy': 'Browser preference storage and UI density',
    'settings.darkMode': 'Dark Mode',
    'settings.compactTables': 'Compact Tables',
    'settings.security': 'Security & Notifications',
    'settings.securityCopy': '2FA, reminders, and operational alerts',
    'settings.twoFactor': 'Two-Factor Authentication',
    'settings.lowStock': 'Low Stock Alerts',
    'settings.dailySales': 'Daily Sales Summary',
    'settings.newCustomer': 'New Customer Signup',
    'settings.scheduledReports': 'Scheduled Reports',
    'settings.accountData': 'Account Data',
    'settings.accountDataCopy': 'GDPR export and account deletion workflow',
    'settings.exportData': 'Export Data',
    'settings.deleteAccount': 'Delete Account',
    'auth.loginTitle': 'Sign in to RhinoPeak',
    'auth.registerTitle': 'Create your workspace',
    'auth.resetTitle': 'Reset your password',
    'auth.loginCopy': 'Use your workspace email and password to continue.',
    'auth.registerCopy': 'Set up the first owner account and start with a clean company workspace.',
    'auth.resetCopy': 'Request a secure reset code and choose a new password.',
    'auth.login': 'Login',
    'auth.register': 'Register',
    'auth.reset': 'Reset',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.newPassword': 'New password',
    'auth.ownerName': 'Owner name',
    'auth.businessName': 'Business name',
    'auth.resetCode': 'Reset code',
    'auth.sendCode': 'Send code',
    'auth.working': 'Working...',
    'auth.signIn': 'Sign in',
    'auth.createWorkspace': 'Create workspace',
    'auth.resetPassword': 'Reset password',
    'auth.footnote': 'New installation? Register first. The database starts empty and creates your owner workspace on signup.',
  },
  ne: {
    'app.subtitle': 'व्यवसाय ड्यासबोर्ड',
    'workspace.free': 'निःशुल्क वर्कस्पेस',
    'workspace.pro': 'प्रो वर्कस्पेस',
    'nav.dashboard': 'ड्यासबोर्ड',
    'nav.sales': 'बिक्री',
    'nav.analytics': 'विश्लेषण',
    'nav.customers': 'ग्राहक',
    'nav.inventory': 'स्टक',
    'nav.reports': 'रिपोर्ट',
    'nav.team': 'टोली र भूमिका',
    'nav.billing': 'बिलिङ',
    'nav.settings': 'सेटिङ',
    'nav.collapse': 'खुम्च्याउनुहोस्',
    'topbar.noWorkspace': 'वर्कस्पेस छैन',
    'topbar.search': 'मोड्युल खोज्नुहोस्...',
    'topbar.dbOnline': 'DB अनलाइन',
    'topbar.dbOffline': 'DB अफलाइन',
    'topbar.dbCheck': 'DB जाँच',
    'topbar.notifications': 'सूचना',
    'topbar.activeAlerts': 'सक्रिय अलर्ट',
    'topbar.noNotifications': 'सूचना छैन।',
    'topbar.accountSettings': 'खाता सेटिङ',
    'topbar.logout': 'लग आउट',
    'settings.businessProfile': 'व्यवसाय प्रोफाइल',
    'settings.businessProfileCopy': 'रिपोर्ट, निर्यात, इनभ्वाइस र संस्था स्विचमा प्रयोग हुन्छ',
    'settings.businessName': 'व्यवसायको नाम',
    'settings.currency': 'मुद्रा',
    'settings.language': 'भाषा',
    'settings.languageCopy': 'मुख्य पोर्टल अंग्रेजी वा नेपालीमा चलाउनुहोस्',
    'settings.timezone': 'समय क्षेत्र',
    'settings.fiscalYear': 'आर्थिक वर्ष सुरु',
    'settings.taxRate': 'पूर्वनिर्धारित VAT / कर दर',
    'settings.invoicePrefix': 'इनभ्वाइस प्रिफिक्स',
    'settings.receiptFooter': 'रसिद फुटर',
    'settings.defaultPayment': 'पूर्वनिर्धारित भुक्तानी',
    'settings.appearance': 'रूप र मेमोरी',
    'settings.appearanceCopy': 'ब्राउजर प्राथमिकता र UI घनत्व',
    'settings.darkMode': 'डार्क मोड',
    'settings.compactTables': 'कम्प्याक्ट तालिका',
    'settings.security': 'सुरक्षा र सूचना',
    'settings.securityCopy': '2FA, सम्झना र सञ्चालन अलर्ट',
    'settings.twoFactor': 'दुई-चरण प्रमाणीकरण',
    'settings.lowStock': 'कम स्टक अलर्ट',
    'settings.dailySales': 'दैनिक बिक्री सारांश',
    'settings.newCustomer': 'नयाँ ग्राहक सूचना',
    'settings.scheduledReports': 'तालिकाबद्ध रिपोर्ट',
    'settings.accountData': 'खाता डाटा',
    'settings.accountDataCopy': 'डाटा निर्यात र खाता मेटाउने प्रक्रिया',
    'settings.exportData': 'डाटा निर्यात',
    'settings.deleteAccount': 'खाता मेटाउनुहोस्',
    'auth.loginTitle': 'राइनोपिकमा लग इन गर्नुहोस्',
    'auth.registerTitle': 'वर्कस्पेस बनाउनुहोस्',
    'auth.resetTitle': 'पासवर्ड रिसेट गर्नुहोस्',
    'auth.loginCopy': 'जारी राख्न आफ्नो वर्कस्पेस इमेल र पासवर्ड प्रयोग गर्नुहोस्।',
    'auth.registerCopy': 'पहिलो मालिक अकाउन्ट बनाएर सफा कम्पनी वर्कस्पेस सुरु गर्नुहोस्।',
    'auth.resetCopy': 'सुरक्षित रिसेट कोड माग्नुहोस् र नयाँ पासवर्ड राख्नुहोस्।',
    'auth.login': 'लग इन',
    'auth.register': 'दर्ता',
    'auth.reset': 'रिसेट',
    'auth.email': 'इमेल',
    'auth.password': 'पासवर्ड',
    'auth.newPassword': 'नयाँ पासवर्ड',
    'auth.ownerName': 'मालिकको नाम',
    'auth.businessName': 'व्यवसायको नाम',
    'auth.resetCode': 'रिसेट कोड',
    'auth.sendCode': 'कोड पठाउनुहोस्',
    'auth.working': 'काम हुँदैछ...',
    'auth.signIn': 'साइन इन',
    'auth.createWorkspace': 'वर्कस्पेस बनाउनुहोस्',
    'auth.resetPassword': 'पासवर्ड रिसेट',
    'auth.footnote': 'नयाँ स्थापना हो? पहिले दर्ता गर्नुहोस्। डाटाबेस खाली सुरु हुन्छ र साइनअप गर्दा मालिक वर्कस्पेस बनाउँछ।',
  },
};

export function translate(language: AppLanguage | undefined, key: TranslationKey) {
  return translations[language ?? 'en']?.[key] ?? translations.en[key];
}

export function languageName(language: AppLanguage) {
  return language === 'ne' ? 'नेपाली' : 'English';
}
