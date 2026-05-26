import 'package:flutter/services.dart';

class CapturedBillImage {
  const CapturedBillImage({
    required this.fileName,
    required this.mimeType,
    required this.dataUrl,
    required this.size,
  });

  final String fileName;
  final String mimeType;
  final String dataUrl;
  final int size;

  factory CapturedBillImage.fromMap(Map<dynamic, dynamic> data) {
    return CapturedBillImage(
      fileName: data['fileName']?.toString() ?? 'bill-photo.jpg',
      mimeType: data['mimeType']?.toString() ?? 'image/jpeg',
      dataUrl: data['dataUrl']?.toString() ?? '',
      size: data['size'] is int
          ? data['size'] as int
          : int.tryParse(data['size']?.toString() ?? '') ?? 0,
    );
  }
}

class CameraCaptureService {
  static const _channel = MethodChannel('com.rhinopeak.mobile/camera');

  Future<CapturedBillImage?> captureBillImage({required String source}) async {
    try {
      final result = await _channel.invokeMethod<Map<dynamic, dynamic>>(
        'captureBillImage',
        {'source': source},
      );
      if (result == null) return null;
      final image = CapturedBillImage.fromMap(result);
      if (image.dataUrl.isEmpty) return null;
      return image;
    } on MissingPluginException {
      return null;
    } on PlatformException {
      return null;
    }
  }
}

final cameraCaptureService = CameraCaptureService();
