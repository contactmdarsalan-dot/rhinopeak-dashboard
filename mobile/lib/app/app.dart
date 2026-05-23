import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/auth/presentation/auth_screen.dart';
import '../features/home/presentation/app_shell.dart';
import 'localization/app_strings.dart';
import 'state/app_controller.dart';
import 'theme/app_theme.dart';

class RhinoPeakMobileApp extends ConsumerStatefulWidget {
  const RhinoPeakMobileApp({super.key});

  @override
  ConsumerState<RhinoPeakMobileApp> createState() => _RhinoPeakMobileAppState();
}

class _RhinoPeakMobileAppState extends ConsumerState<RhinoPeakMobileApp> {
  @override
  void initState() {
    super.initState();
    Future.microtask(
      () => ref.read(appControllerProvider.notifier).initialize(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appControllerProvider);
    final locale = state.language == AppLanguage.ne
        ? const Locale('ne')
        : const Locale('en');

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'RhinoPeak Business',
      locale: locale,
      supportedLocales: const [Locale('en'), Locale('ne')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ],
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: ThemeMode.system,
      home: state.initializing
          ? const _BootScreen()
          : state.authenticated
          ? const AppShell()
          : const AuthScreen(),
    );
  }
}

class _BootScreen extends StatelessWidget {
  const _BootScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: SizedBox.square(
          dimension: 42,
          child: CircularProgressIndicator(strokeWidth: 3),
        ),
      ),
    );
  }
}
