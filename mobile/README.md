# RhinoPeak Business Mobile

Flutter mobile app for the RhinoPeak Business Dashboard backend.

## Run

Install Flutter, then run:

```powershell
cd mobile
flutter create . --platforms android,ios
flutter pub get
flutter run --dart-define=RHINOPEAK_API_URL=http://10.0.2.2:8010/api
```

The `flutter create` command generates the native Android and iOS runner folders around the checked-in source. Use `10.0.2.2` for Android emulator access to the host machine. For a physical phone, use the LAN IP address of the backend machine.

## Architecture

```text
lib/
  app/              App root, state, theme, localization
  core/             Config, network, storage, utilities
  features/         Feature-first presentation modules
  shared/           Models, repositories, reusable widgets
```

The app talks to the existing Django API and starts by calling `/mobile/bootstrap` after login.

## Current MVP

- Login, register, password reset request
- Token storage and refresh-aware API client
- Cached bootstrap payload
- English/Nepali UI strings
- Home dashboard
- Center Quick Add mobile action
- Sales cards
- Inventory cards with liter/kg/pcs units
- Product add, quick sale, quick expense, quick stock movement
- Customer, supplier, credit, expense, bill, report, and billing mobile card views
- Parties, purchases, cash/bank, accounting journals, documents, reminders, team/roles, audit, sync, and support mobile views
- More menu and settings/language screen
