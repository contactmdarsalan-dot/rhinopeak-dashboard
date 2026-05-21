class AppConfig {
  static const String apiBaseUrl = String.fromEnvironment(
    'RHINOPEAK_API_URL',
    defaultValue: 'http://10.0.2.2:8010/api',
  );
}
