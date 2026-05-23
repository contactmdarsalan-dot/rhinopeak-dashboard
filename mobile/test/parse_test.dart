import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:rhinopeak_mobile/shared/models/rhino_models.dart';

void main() {
  test('Test bootstrap parsing', () {
    try {
      final file = File('test_bootstrap_payload.json');
      final jsonStr = file.readAsStringSync();
      final Map<String, dynamic> data = json.decode(jsonStr);
      print('JSON loaded. Map size: ${data.length}');
      final bootstrap = BootstrapData.fromJson(data);
      print('Parsed successfully: ${bootstrap.plan}');
    } catch (e, stack) {
      print('PARSING ERROR: $e');
      print('STACK TRACE: $stack');
      fail('Parsing failed');
    }
  });
}
