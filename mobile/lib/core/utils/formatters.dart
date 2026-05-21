import 'package:intl/intl.dart';

String money(num value, {String currency = 'NPR'}) {
  final formatter = NumberFormat.decimalPattern('en_NP');
  return '$currency ${formatter.format(value.round())}';
}

String quantity(num value, String unit) {
  final number =
      value % 1 == 0 ? value.toInt().toString() : value.toStringAsFixed(2);
  return '$number $unit';
}

String compactNumber(num value) {
  return value % 1 == 0 ? value.toInt().toString() : value.toStringAsFixed(2);
}

String shortDate(String value) {
  if (value.length >= 10) return value.substring(0, 10);
  return value;
}
