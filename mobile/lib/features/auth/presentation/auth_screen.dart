import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/app_strings.dart';
import '../../../app/state/app_controller.dart';
import '../../../shared/widgets/rp_widgets.dart';

class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key});

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _businessController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _registerMode = false;
  bool _hidePassword = true;

  @override
  void dispose() {
    _nameController.dispose();
    _businessController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final controller = ref.read(appControllerProvider.notifier);
    if (_registerMode) {
      await controller.register(
        name: _nameController.text.trim(),
        email: _emailController.text.trim(),
        password: _passwordController.text,
        businessName: _businessController.text.trim(),
      );
      return;
    }
    await controller.login(
      _emailController.text.trim(),
      _passwordController.text,
    );
  }

  Future<void> _resetPassword() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(tr(ref, 'email')),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    await ref.read(appControllerProvider.notifier).requestPasswordReset(email);
  }

  Future<void> _toggleLanguage() async {
    final current = ref.read(appControllerProvider).language;
    final next = current == AppLanguage.en ? AppLanguage.ne : AppLanguage.en;
    await ref.read(appControllerProvider.notifier).setLanguage(next);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appControllerProvider);
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: Stack(
        children: [
          // Elegant Web-like Mesh Background Glowing Orbs
          Positioned(
            top: -150,
            right: -100,
            child: Container(
              width: 380,
              height: 380,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: scheme.primary.withValues(alpha: isDark ? 0.08 : 0.05),
              ),
            ),
          ),
          Positioned(
            bottom: -150,
            left: -100,
            child: Container(
              width: 420,
              height: 420,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: scheme.secondary.withValues(alpha: isDark ? 0.06 : 0.04),
              ),
            ),
          ),
          // Main Scrollable Panel
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 32,
                ),
                child: Container(
                  constraints: const BoxConstraints(maxWidth: 440),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Brand Header Row
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: scheme.primary.withValues(
                                alpha: isDark ? 0.15 : 0.08,
                              ),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: scheme.primary.withValues(
                                  alpha: isDark ? 0.3 : 0.2,
                                ),
                                width: 1.5,
                              ),
                            ),
                            child: Icon(
                              Icons.terrain_rounded,
                              color: scheme.primary,
                              size: 24,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              tr(ref, 'appName'),
                              style: Theme.of(context).textTheme.titleMedium
                                  ?.copyWith(
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: -0.3,
                                  ),
                            ),
                          ),
                          IconButton.filledTonal(
                            onPressed: state.loading ? null : _toggleLanguage,
                            icon: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 4,
                              ),
                              child: Text(
                                state.language == AppLanguage.en ? 'NE' : 'EN',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                            tooltip: tr(ref, 'language'),
                          ),
                        ],
                      ),
                      const SizedBox(height: 36),
                      // Floating SaaS Sign-in Card
                      RpCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              _registerMode
                                  ? tr(ref, 'registerTitle')
                                  : tr(ref, 'loginTitle'),
                              style: Theme.of(context).textTheme.headlineSmall
                                  ?.copyWith(
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: -0.5,
                                    height: 1.15,
                                  ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              _registerMode
                                  ? tr(ref, 'registerSubtitle')
                                  : tr(ref, 'loginSubtitle'),
                              style: TextStyle(
                                fontSize: 13.5,
                                color: scheme.onSurfaceVariant.withValues(
                                  alpha: 0.8,
                                ),
                                height: 1.35,
                              ),
                            ),
                            const SizedBox(height: 24),
                            const ErrorBanner(),
                            if (state.notice != null) ...[
                              _NoticeBanner(message: state.notice!),
                              const SizedBox(height: 14),
                            ],
                            Form(
                              key: _formKey,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  if (_registerMode) ...[
                                    _TextInput(
                                      controller: _nameController,
                                      label: tr(ref, 'name'),
                                      icon: Icons.person_outline_rounded,
                                    ),
                                    const SizedBox(height: 14),
                                    _TextInput(
                                      controller: _businessController,
                                      label: tr(ref, 'businessName'),
                                      icon: Icons.storefront_rounded,
                                    ),
                                    const SizedBox(height: 14),
                                  ],
                                  _TextInput(
                                    controller: _emailController,
                                    label: tr(ref, 'email'),
                                    icon: Icons.mail_outline_rounded,
                                    keyboardType: TextInputType.emailAddress,
                                  ),
                                  const SizedBox(height: 14),
                                  TextFormField(
                                    controller: _passwordController,
                                    obscureText: _hidePassword,
                                    validator: (value) =>
                                        value == null || value.length < 6
                                        ? tr(ref, 'required')
                                        : null,
                                    decoration: InputDecoration(
                                      labelText: tr(ref, 'password'),
                                      prefixIcon: const Icon(
                                        Icons.lock_outline_rounded,
                                      ),
                                      suffixIcon: IconButton(
                                        onPressed: () => setState(
                                          () => _hidePassword = !_hidePassword,
                                        ),
                                        icon: Icon(
                                          _hidePassword
                                              ? Icons.visibility_outlined
                                              : Icons.visibility_off_outlined,
                                        ),
                                      ),
                                    ),
                                  ),
                                  if (!_registerMode)
                                    Align(
                                      alignment: Alignment.centerRight,
                                      child: Padding(
                                        padding: const EdgeInsets.only(top: 4),
                                        child: TextButton(
                                          onPressed: state.loading
                                              ? null
                                              : _resetPassword,
                                          style: TextButton.styleFrom(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 8,
                                              vertical: 4,
                                            ),
                                            tapTargetSize: MaterialTapTargetSize
                                                .shrinkWrap,
                                          ),
                                          child: Text(
                                            tr(ref, 'forgotPassword'),
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  const SizedBox(height: 24),
                                  FilledButton(
                                    onPressed: state.loading ? null : _submit,
                                    child: state.loading
                                        ? const SizedBox.square(
                                            dimension: 22,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2.5,
                                              color: Colors.white,
                                            ),
                                          )
                                        : Text(
                                            _registerMode
                                                ? tr(ref, 'register')
                                                : tr(ref, 'login'),
                                          ),
                                  ),
                                  const SizedBox(height: 14),
                                  OutlinedButton(
                                    onPressed: state.loading
                                        ? null
                                        : () => setState(
                                            () =>
                                                _registerMode = !_registerMode,
                                          ),
                                    child: Text(
                                      _registerMode
                                          ? tr(ref, 'switchToLogin')
                                          : tr(ref, 'switchToRegister'),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TextInput extends ConsumerWidget {
  const _TextInput({
    required this.controller,
    required this.label,
    required this.icon,
    this.keyboardType,
  });

  final TextEditingController controller;
  final String label;
  final IconData icon;
  final TextInputType? keyboardType;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      textInputAction: TextInputAction.next,
      validator: (value) =>
          value == null || value.trim().isEmpty ? tr(ref, 'required') : null,
      decoration: InputDecoration(labelText: label, prefixIcon: Icon(icon)),
    );
  }
}

class _NoticeBanner extends StatelessWidget {
  const _NoticeBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: scheme.primaryContainer.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: scheme.primary.withValues(alpha: 0.25),
          width: 1,
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.info_outline_rounded,
            color: scheme.onPrimaryContainer,
            size: 20,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                color: scheme.onPrimaryContainer,
                fontWeight: FontWeight.w600,
                fontSize: 13.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
