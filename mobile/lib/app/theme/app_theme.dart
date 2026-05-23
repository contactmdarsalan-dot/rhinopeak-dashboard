import 'package:flutter/material.dart';

class AppTheme {
  static const Color primary = Color(0xFF8A4FFF); // oklch(0.60 0.22 285) approx
  static const Color primaryDark = Color(
    0xFF6B31DF,
  ); // oklch(0.50 0.20 285) approx
  static const Color accent = Color(0xFFE25CF5); // oklch(0.65 0.18 310) approx
  static const Color warning = Color(0xFFDB8014); // oklch(0.65 0.18 70) approx
  static const Color success = Color(0xFF0FA871); // oklch(0.55 0.15 160) approx
  static const Color danger = Color(0xFFD43C42); // oklch(0.55 0.20 25) approx
  static const Color ink = Color(0xFF0F101A); // oklch(0.12 0.01 280) approx
  static const Color muted = Color(0xFF757891); // oklch(0.55 0.03 280) approx
  static const Color surface = Color(
    0xFFF7F7FA,
  ); // oklch(0.98 0.005 280) approx

  static ThemeData light() {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: primary,
      brightness: Brightness.light,
      primary: primary,
      secondary: accent,
      error: danger,
      surface: Colors.white,
    );
    return _base(colorScheme).copyWith(scaffoldBackgroundColor: surface);
  }

  static ThemeData dark() {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: primary,
      brightness: Brightness.dark,
      primary: primary,
      secondary: accent,
      error: danger,
      surface: const Color(0xFF191A26), // oklch(0.16 0.02 280) approx
    );
    return _base(colorScheme).copyWith(
      scaffoldBackgroundColor: const Color(
        0xFF0F101A,
      ), // oklch(0.12 0.01 280) approx
    );
  }

  static ThemeData _base(ColorScheme colorScheme) {
    final isDark = colorScheme.brightness == Brightness.dark;
    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      fontFamily:
          'Inter', // Suggesting Inter as a geometric/neo-grotesque alternative to standard Roboto
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: Colors.transparent,
        foregroundColor: colorScheme.onSurface,
        titleTextStyle: TextStyle(
          color: colorScheme.onSurface,
          fontSize: 20,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.5,
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: colorScheme.surface,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(
            16,
          ), // Softer radius matching web App Panel
          side: BorderSide(
            color: colorScheme.outlineVariant.withValues(
              alpha: isDark ? 0.25 : 0.15,
            ),
            width: 1, // Thinner border
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: isDark
            ? const Color(0xFF191A26)
            : colorScheme.surfaceContainerHighest.withValues(alpha: 0.25),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(
            color: colorScheme.outlineVariant.withValues(alpha: 0.3),
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(
            color: colorScheme.outlineVariant.withValues(alpha: 0.3),
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(
            color: colorScheme.primary,
            width: 1.5,
          ), // Subtle focus ring
        ),
        labelStyle: TextStyle(
          color: colorScheme.onSurfaceVariant.withValues(alpha: 0.8),
          fontWeight: FontWeight.w500,
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 20,
          vertical: 16,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ), // Tighter radius
          textStyle: const TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 16,
            letterSpacing: 0.2,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(50),
          side: BorderSide(
            color: colorScheme.outlineVariant.withValues(alpha: 0.5),
            width: 1.0,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
        ),
      ),
    );
  }
}
