import '../../app/localization/app_strings.dart';

class CurrentUser {
  const CurrentUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
  });

  final String id;
  final String name;
  final String email;
  final String role;

  factory CurrentUser.fromJson(Map<String, dynamic> json) {
    return CurrentUser(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      role: json['role']?.toString() ?? '',
    );
  }
}

class AppSettings {
  const AppSettings({
    required this.businessName,
    required this.currency,
    required this.language,
    required this.taxRate,
    required this.invoicePrefix,
  });

  final String businessName;
  final String currency;
  final AppLanguage language;
  final num taxRate;
  final String invoicePrefix;

  factory AppSettings.fromJson(Map<String, dynamic> json) {
    return AppSettings(
      businessName: json['businessName']?.toString() ?? '',
      currency: json['currency']?.toString() ?? 'NPR',
      language: languageFromCode(json['language']?.toString()),
      taxRate: num.tryParse(json['taxRate']?.toString() ?? '') ?? 13,
      invoicePrefix: json['invoicePrefix']?.toString() ?? 'RP',
    );
  }

  Map<String, dynamic> toPatch({AppLanguage? nextLanguage}) {
    return {
      'businessName': businessName,
      'currency': currency,
      'language': (nextLanguage ?? language).code,
      'taxRate': taxRate,
      'invoicePrefix': invoicePrefix,
    };
  }
}

class Product {
  const Product({
    required this.id,
    required this.name,
    required this.category,
    required this.unit,
    required this.stock,
    required this.reorderLevel,
    required this.price,
    required this.costPrice,
    required this.supplier,
    required this.status,
  });

  final String id;
  final String name;
  final String category;
  final String unit;
  final num stock;
  final num reorderLevel;
  final num price;
  final num costPrice;
  final String supplier;
  final String status;

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      category: json['category']?.toString() ?? 'General',
      unit: json['unit']?.toString() ?? 'pcs',
      stock: num.tryParse(json['stock']?.toString() ?? '') ?? 0,
      reorderLevel: num.tryParse(json['reorderLevel']?.toString() ?? '') ?? 0,
      price: num.tryParse(json['price']?.toString() ?? '') ?? 0,
      costPrice: num.tryParse(json['costPrice']?.toString() ?? '') ?? 0,
      supplier: json['supplier']?.toString() ?? '',
      status: json['status']?.toString() ?? 'In Stock',
    );
  }
}

class Sale {
  const Sale({
    required this.id,
    required this.customer,
    required this.products,
    required this.amount,
    required this.payment,
    required this.status,
    required this.date,
  });

  final String id;
  final String customer;
  final String products;
  final num amount;
  final String payment;
  final String status;
  final String date;

  factory Sale.fromJson(Map<String, dynamic> json) {
    return Sale(
      id: json['id']?.toString() ?? '',
      customer: json['customer']?.toString() ?? 'Walk-in customer',
      products: json['products']?.toString() ?? '',
      amount: num.tryParse(json['amount']?.toString() ?? '') ?? 0,
      payment: json['payment']?.toString() ?? 'Cash',
      status: json['status']?.toString() ?? 'Completed',
      date: json['date']?.toString() ?? '',
    );
  }
}

class BootstrapData {
  const BootstrapData({
    required this.plan,
    required this.billingCycle,
    required this.trialEndsAt,
    required this.activeBusinessId,
    required this.settings,
    required this.businesses,
    required this.teamMembers,
    required this.roleDefinitions,
    required this.sales,
    required this.parties,
    required this.partyLedger,
    required this.purchases,
    required this.products,
    required this.customers,
    required this.suppliers,
    required this.expenses,
    required this.expenseCategories,
    required this.creditLedger,
    required this.cashBankAccounts,
    required this.moneyMovements,
    required this.journalEntries,
    required this.documents,
    required this.reminderTemplates,
    required this.reminderLogs,
    required this.syncOperations,
    required this.inventoryCategories,
    required this.inventoryMovements,
    required this.reports,
    required this.auditLogs,
    required this.billingHistory,
    required this.featureFlags,
    required this.supportTickets,
    required this.permissions,
  });

  final String plan;
  final String billingCycle;
  final String trialEndsAt;
  final String activeBusinessId;
  final AppSettings settings;
  final List<Map<String, dynamic>> businesses;
  final List<Map<String, dynamic>> teamMembers;
  final List<Map<String, dynamic>> roleDefinitions;
  final List<Sale> sales;
  final List<Map<String, dynamic>> parties;
  final List<Map<String, dynamic>> partyLedger;
  final List<Map<String, dynamic>> purchases;
  final List<Product> products;
  final List<Map<String, dynamic>> customers;
  final List<Map<String, dynamic>> suppliers;
  final List<Map<String, dynamic>> expenses;
  final List<String> expenseCategories;
  final List<Map<String, dynamic>> creditLedger;
  final List<Map<String, dynamic>> cashBankAccounts;
  final List<Map<String, dynamic>> moneyMovements;
  final List<Map<String, dynamic>> journalEntries;
  final List<Map<String, dynamic>> documents;
  final List<Map<String, dynamic>> reminderTemplates;
  final List<Map<String, dynamic>> reminderLogs;
  final List<Map<String, dynamic>> syncOperations;
  final List<String> inventoryCategories;
  final List<Map<String, dynamic>> inventoryMovements;
  final List<Map<String, dynamic>> reports;
  final List<Map<String, dynamic>> auditLogs;
  final List<Map<String, dynamic>> billingHistory;
  final List<Map<String, dynamic>> featureFlags;
  final List<Map<String, dynamic>> supportTickets;
  final Set<String> permissions;

  factory BootstrapData.fromJson(Map<String, dynamic> json) {
    final team = _list(json['teamMembers']);
    final currentRole =
        team.isNotEmpty ? team.first['role']?.toString() : 'Owner';
    final roleDefinitions = _list(json['roleDefinitions']);
    final role = roleDefinitions.cast<Map<String, dynamic>?>().firstWhere(
          (item) => item?['name']?.toString() == currentRole,
          orElse: () => null,
        );
    final permissions = role?['permissions'] is List
        ? Set<String>.from(
            (role?['permissions'] as List).map((item) => item.toString()))
        : <String>{};

    return BootstrapData(
      plan: json['plan']?.toString() ?? 'free',
      billingCycle: json['billingCycle']?.toString() ?? 'monthly',
      trialEndsAt: json['trialEndsAt']?.toString() ?? '',
      activeBusinessId: json['activeBusinessId']?.toString() ?? '',
      settings: AppSettings.fromJson(_map(json['settings'])),
      businesses: _list(json['businesses']),
      teamMembers: team,
      roleDefinitions: roleDefinitions,
      sales: _list(json['sales']).map(Sale.fromJson).toList(),
      parties: _list(json['parties']),
      partyLedger: _list(json['partyLedger']),
      purchases: _list(json['purchases']),
      products: _list(json['inventory']).map(Product.fromJson).toList(),
      customers: _list(json['customers']),
      suppliers: _list(json['suppliers']),
      expenses: _list(json['expenses']),
      expenseCategories: _stringList(json['expenseCategories']),
      creditLedger: _list(json['creditLedger']),
      cashBankAccounts: _list(json['cashBankAccounts']),
      moneyMovements: _list(json['moneyMovements']),
      journalEntries: _list(json['journalEntries']),
      documents: _list(json['documents']),
      reminderTemplates: _list(json['reminderTemplates']),
      reminderLogs: _list(json['reminderLogs']),
      syncOperations: _list(json['syncOperations']),
      inventoryCategories: _stringList(json['inventoryCategories']),
      inventoryMovements: _list(json['inventoryMovements']),
      reports: _list(json['reports']),
      auditLogs: _list(json['auditLogs']),
      billingHistory: _list(json['billingHistory']),
      featureFlags: _list(json['featureFlags']),
      supportTickets: _list(json['supportTickets']),
      permissions: permissions,
    );
  }

  num get todayRevenue {
    final today = DateTime.now().toIso8601String().substring(0, 10);
    return sales
        .where(
            (sale) => sale.date.startsWith(today) && sale.status != 'Refunded')
        .fold<num>(0, (sum, sale) => sum + sale.amount);
  }

  num get monthlyRevenue {
    final month = DateTime.now().toIso8601String().substring(0, 7);
    return sales
        .where(
            (sale) => sale.date.startsWith(month) && sale.status != 'Refunded')
        .fold<num>(0, (sum, sale) => sum + sale.amount);
  }

  num get creditDue {
    return customers.fold<num>(0, (sum, customer) {
      return sum + (num.tryParse(customer['balance']?.toString() ?? '') ?? 0);
    });
  }

  int get lowStockCount =>
      products.where((item) => item.stock <= item.reorderLevel).length;

  num get expenseTotal => expenses.fold<num>(
      0,
      (sum, item) =>
          sum + (num.tryParse(item['amount']?.toString() ?? '') ?? 0));

  num get purchaseTotal => purchases.fold<num>(
      0,
      (sum, item) =>
          sum + (num.tryParse(item['amount']?.toString() ?? '') ?? 0));

  num get cashBankBalance => cashBankAccounts.fold<num>(
      0,
      (sum, item) =>
          sum + (num.tryParse(item['balance']?.toString() ?? '') ?? 0));

  bool can(String permission) =>
      permissions.isEmpty || permissions.contains(permission);

  static List<Map<String, dynamic>> _list(Object? value) {
    return _rawList(value)
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  static List<dynamic> _rawList(Object? value) =>
      value is List ? value : const [];

  static List<String> _stringList(Object? value) {
    return List<String>.from(_rawList(value).map((item) => item.toString()));
  }

  static Map<String, dynamic> _map(Object? value) {
    return value is Map
        ? Map<String, dynamic>.from(value)
        : <String, dynamic>{};
  }
}
