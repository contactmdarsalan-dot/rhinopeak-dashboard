import 'package:flutter_test/flutter_test.dart';
import 'package:rhinopeak_mobile/app/localization/app_strings.dart';

void main() {
  test('returns Nepali strings for mobile navigation', () {
    expect(AppStrings.tr(AppLanguage.ne, 'dashboard'), 'ड्यासबोर्ड');
    expect(AppStrings.tr(AppLanguage.ne, 'quickAdd'), 'छिटो थप्नुहोस्');
  });

  test('falls back to English for unknown locale keys', () {
    expect(AppStrings.tr(AppLanguage.en, 'appName'), 'RhinoPeak Business');
    expect(AppStrings.tr(AppLanguage.en, 'missing-key'), 'missing-key');
  });
}
