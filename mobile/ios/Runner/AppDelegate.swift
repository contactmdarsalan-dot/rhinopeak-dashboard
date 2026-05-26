import Flutter
import LocalAuthentication
import UIKit
import UserNotifications

final class RhinoPeakDeepLinks {
  static var pendingLink: String?
  static var channel: FlutterMethodChannel?

  static func open(_ url: URL) {
    let value = url.absoluteString
    if channel == nil {
      pendingLink = value
      return
    }
    channel?.invokeMethod("linkOpened", arguments: value)
  }
}

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
  private var pushChannel: FlutterMethodChannel?
  private var imagePickerResult: FlutterResult?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    UNUserNotificationCenter.current().delegate = self
    if let url = launchOptions?[.url] as? URL {
      RhinoPeakDeepLinks.pendingLink = url.absoluteString
    }
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    let messenger = engineBridge.applicationRegistrar.messenger()
    configureBiometricChannel(messenger)
    configureCameraChannel(messenger)
    configurePushChannel(messenger, application: UIApplication.shared)
    configureDeepLinkChannel(messenger)
  }

  override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey : Any] = [:]
  ) -> Bool {
    RhinoPeakDeepLinks.open(url)
    return true
  }

  override func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
    pushChannel?.invokeMethod("tokenUpdated", arguments: token)
  }

  override func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    let userInfo = response.notification.request.content.userInfo
    if let payload = userInfo["payload"] as? String {
      pushChannel?.invokeMethod("notificationOpened", arguments: ["payload": payload])
    } else {
      var payload: [String: Any] = [:]
      userInfo.forEach { key, value in
        payload[String(describing: key)] = value
      }
      pushChannel?.invokeMethod("notificationOpened", arguments: payload)
    }
    completionHandler()
  }

  private func configureBiometricChannel(_ messenger: FlutterBinaryMessenger) {
    FlutterMethodChannel(
      name: "com.rhinopeak.mobile/biometric",
      binaryMessenger: messenger
    ).setMethodCallHandler { call, result in
      let context = LAContext()
      var error: NSError?
      switch call.method {
      case "capability":
        let available = context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)
        result(["available": available, "enrolled": available, "type": "deviceOwnerAuthentication"])
      case "authenticate":
        let args = call.arguments as? [String: Any]
        let reason = args?["reason"] as? String ?? "Unlock RhinoPeak"
        context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, _ in
          DispatchQueue.main.async {
            result(success)
          }
        }
      default:
        result(FlutterMethodNotImplemented)
      }
    }
  }

  private func configureCameraChannel(_ messenger: FlutterBinaryMessenger) {
    FlutterMethodChannel(
      name: "com.rhinopeak.mobile/camera",
      binaryMessenger: messenger
    ).setMethodCallHandler { call, result in
      switch call.method {
      case "captureBillImage":
        if self.imagePickerResult != nil {
          result(FlutterError(code: "image_picker_busy", message: "Image picker is already open.", details: nil))
          return
        }
        let args = call.arguments as? [String: Any]
        let source = args?["source"] as? String ?? "camera"
        let sourceType: UIImagePickerController.SourceType = source == "gallery" ? .photoLibrary : .camera
        if !UIImagePickerController.isSourceTypeAvailable(sourceType) {
          result(FlutterError(code: "source_unavailable", message: "Requested image source is unavailable.", details: nil))
          return
        }
        guard let presenter = self.presentingViewController() else {
          result(FlutterError(code: "no_presenter", message: "Could not open image picker.", details: nil))
          return
        }
        self.imagePickerResult = result
        let picker = UIImagePickerController()
        picker.sourceType = sourceType
        picker.delegate = self
        presenter.present(picker, animated: true)
      default:
        result(FlutterMethodNotImplemented)
      }
    }
  }

  private func configurePushChannel(_ messenger: FlutterBinaryMessenger, application: UIApplication) {
    pushChannel = FlutterMethodChannel(name: "com.rhinopeak.mobile/push", binaryMessenger: messenger)
    pushChannel?.setMethodCallHandler { call, result in
      switch call.method {
      case "initialize":
        application.registerForRemoteNotifications()
        result(nil)
      case "requestPermission":
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
          DispatchQueue.main.async {
            if granted {
              application.registerForRemoteNotifications()
            }
            result(granted)
          }
        }
      case "showLocalNotification":
        let args = call.arguments as? [String: Any]
        let content = UNMutableNotificationContent()
        content.title = args?["title"] as? String ?? "RhinoPeak"
        content.body = args?["body"] as? String ?? ""
        content.sound = .default
        if let payload = args?["payload"] as? String {
          content.userInfo = ["payload": payload]
        }
        let request = UNNotificationRequest(
          identifier: UUID().uuidString,
          content: content,
          trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        )
        UNUserNotificationCenter.current().add(request)
        result(nil)
      default:
        result(FlutterMethodNotImplemented)
      }
    }
  }

  private func configureDeepLinkChannel(_ messenger: FlutterBinaryMessenger) {
    RhinoPeakDeepLinks.channel = FlutterMethodChannel(
      name: "com.rhinopeak.mobile/deep_links",
      binaryMessenger: messenger
    )
    RhinoPeakDeepLinks.channel?.setMethodCallHandler { call, result in
      switch call.method {
      case "initialLink":
        result(RhinoPeakDeepLinks.pendingLink)
        RhinoPeakDeepLinks.pendingLink = nil
      default:
        result(FlutterMethodNotImplemented)
      }
    }
  }

  func imagePickerController(
    _ picker: UIImagePickerController,
    didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]
  ) {
    picker.dismiss(animated: true)
    guard let result = imagePickerResult else { return }
    imagePickerResult = nil

    let selectedImage = (info[.editedImage] as? UIImage) ?? (info[.originalImage] as? UIImage)
    guard let image = selectedImage,
          let data = image.jpegData(compressionQuality: 0.92) else {
      result(FlutterError(code: "image_read_failed", message: "Could not read image.", details: nil))
      return
    }
    result([
      "fileName": "bill-\(Int(Date().timeIntervalSince1970 * 1000)).jpg",
      "mimeType": "image/jpeg",
      "dataUrl": "data:image/jpeg;base64,\(data.base64EncodedString())",
      "size": data.count,
    ])
  }

  func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
    picker.dismiss(animated: true)
    imagePickerResult?(nil)
    imagePickerResult = nil
  }

  private func presentingViewController() -> UIViewController? {
    let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
    let root = scene?.windows.first(where: { $0.isKeyWindow })?.rootViewController
    return topViewController(from: root)
  }

  private func topViewController(from controller: UIViewController?) -> UIViewController? {
    if let navigation = controller as? UINavigationController {
      return topViewController(from: navigation.visibleViewController)
    }
    if let tab = controller as? UITabBarController {
      return topViewController(from: tab.selectedViewController)
    }
    if let presented = controller?.presentedViewController {
      return topViewController(from: presented)
    }
    return controller
  }
}
