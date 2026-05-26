import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../shared/widgets/rp_widgets.dart';

class DeviceHubScreen extends ConsumerStatefulWidget {
  const DeviceHubScreen({super.key});

  @override
  ConsumerState<DeviceHubScreen> createState() => _DeviceHubScreenState();
}

class _DeviceHubScreenState extends ConsumerState<DeviceHubScreen> {
  Timer? _timer;
  final Random _random = Random();

  // Simulated live sensor values
  double _lat = 27.71724;
  double _lng = 85.32396;
  double _accelX = 0.02;
  double _accelY = 9.80;
  double _accelZ = -0.15;
  int _batteryTemp = 34;
  int _batteryLevel = 84;
  int _ping = 32;

  bool _isStreaming = true;
  final List<String> _telemetryLogs = [];
  final ScrollController _scrollController = ScrollController();

  // Simulated smart shelf beacons
  final List<Map<String, dynamic>> _beacons = [
    {
      'uuid': 'RH-S1-0982-A3',
      'name': 'Cold Storage Shelf A',
      'rssi': -68,
      'status': 'Connected',
      'proximity': 'Immediate',
    },
    {
      'uuid': 'RH-S2-1140-B7',
      'name': 'Dry Goods Aisles B',
      'rssi': -82,
      'status': 'Connected',
      'proximity': 'Near',
    },
    {
      'uuid': 'RH-S3-9908-C1',
      'name': 'Checkout Counter Shelf',
      'rssi': -95,
      'status': 'Scanning',
      'proximity': 'Far',
    },
  ];

  @override
  void initState() {
    super.initState();
    // Update live sensor metrics every 1.2 seconds
    _timer = Timer.periodic(const Duration(milliseconds: 1200), (timer) {
      if (!mounted) return;
      setState(() {
        // Small random walk on GPS
        _lat += (_random.nextDouble() - 0.5) * 0.0001;
        _lng += (_random.nextDouble() - 0.5) * 0.0001;

        // Fluctuations in Accelerometer
        _accelX = (_random.nextDouble() - 0.5) * 0.2;
        _accelY = 9.80 + (_random.nextDouble() - 0.5) * 0.15;
        _accelZ = -0.15 + (_random.nextDouble() - 0.5) * 0.25;

        // Ping latency jitter
        _ping = 28 + _random.nextInt(15);

        // Slow battery variations
        if (_random.nextDouble() > 0.95) {
          _batteryTemp = 33 + _random.nextInt(3);
        }

        // Proximity/RSSI changes
        for (var beacon in _beacons) {
          beacon['rssi'] = beacon['rssi'] + (_random.nextInt(5) - 2);
          if (beacon['rssi'] > -70) {
            beacon['proximity'] = 'Immediate';
          } else if (beacon['rssi'] > -88) {
            beacon['proximity'] = 'Near';
          } else {
            beacon['proximity'] = 'Far';
          }
        }

        if (_isStreaming) {
          final now = DateTime.now().toIso8601String().substring(11, 19);
          _telemetryLogs.insert(
            0,
            '[$now] POST: lat=${_lat.toStringAsFixed(5)}, lng=${_lng.toStringAsFixed(5)}, accelX=${_accelX.toStringAsFixed(2)}, ping=${_ping}ms - 200 OK',
          );
          if (_telemetryLogs.length > 50) {
            _telemetryLogs.removeLast();
          }
        }
      });
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: const Color(0xFFF7F7FA),
      appBar: AppBar(
        title: const Text('IoT Edge Device Hub'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Edge Node Status Card
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF0F101A), Color(0xFF0A6E46)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF0A6E46).withOpacity(0.18),
                    blurRadius: 16,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Stack(
                    alignment: Alignment.center,
                    children: [
                      // Pulsing Ring
                      _PulsingCircle(color: const Color(0xFF0FA871)),
                      Container(
                        width: 14,
                        height: 14,
                        decoration: const BoxDecoration(
                          color: Color(0xFF0FA871),
                          shape: BoxShape.circle,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text(
                          'Smartphone IoT Edge Node: Active',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                        SizedBox(height: 3),
                        Text(
                          'Device ID: RP-PHONE-NODE-89X2',
                          style: TextStyle(color: Colors.white70, fontSize: 11.5),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Live Telemetry Title
            const Text(
              'LIVE SENSOR TELEMETRY',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                letterSpacing: 1.0,
                color: Color(0xFF757891),
              ),
            ),
            const SizedBox(height: 10),

            // Grid of Live Sensors
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 1.45,
              children: [
                _SensorCard(
                  title: 'GPS Tracking',
                  value: '${_lat.toStringAsFixed(5)}° N\n${_lng.toStringAsFixed(5)}° E',
                  icon: Icons.gps_fixed_rounded,
                  color: const Color(0xFF0A6E46),
                ),
                _SensorCard(
                  title: 'Accelerometer',
                  value: 'X: ${_accelX.toStringAsFixed(2)}\nY: ${_accelY.toStringAsFixed(2)}\nZ: ${_accelZ.toStringAsFixed(2)}',
                  icon: Icons.screen_rotation_rounded,
                  color: const Color(0xFFFFA733),
                ),
                _SensorCard(
                  title: 'Battery & Thermal',
                  value: 'Temp: $_batteryTemp°C\nLevel: $_batteryLevel%',
                  icon: Icons.thermostat_rounded,
                  color: Colors.red.shade600,
                ),
                _SensorCard(
                  title: 'Network Sync Ping',
                  value: 'Latency: $_ping ms\nSignal: Stable',
                  icon: Icons.wifi_tethering_rounded,
                  color: const Color(0xFF0FA871),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Smart Shelf BLE Beacons scanned
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'SMART SHELF BLE SCANS',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.0,
                    color: Color(0xFF757891),
                  ),
                ),
                Text(
                  '${_beacons.length} Found',
                  style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: Color(0xFF0FA871)),
                ),
              ],
            ),
            const SizedBox(height: 10),

            ..._beacons.map((beacon) {
              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.015),
                      blurRadius: 8,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0FA871).withOpacity(0.08),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.bluetooth_searching_rounded, color: Color(0xFF0FA871), size: 20),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            beacon['name'],
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF0F101A)),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            'UUID: ${beacon['uuid']}',
                            style: const TextStyle(fontSize: 10.5, color: Color(0xFF757891)),
                          ),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          '${beacon['rssi']} dBm',
                          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: Color(0xFF0F101A)),
                        ),
                        const SizedBox(height: 3),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFA733).withOpacity(0.08),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            beacon['proximity'].toUpperCase(),
                            style: const TextStyle(fontSize: 8.5, fontWeight: FontWeight.bold, color: Color(0xFFFFA733)),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            }).toList(),

            const SizedBox(height: 20),

            // Cloud Synced Stream logs
            RpCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Cloud Sync Outbox Log',
                        style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15),
                      ),
                      Switch(
                        value: _isStreaming,
                        activeColor: const Color(0xFF0FA871),
                        onChanged: (val) {
                          setState(() => _isStreaming = val);
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Container(
                    height: 140,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F101A),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: _telemetryLogs.isEmpty
                        ? const Center(
                            child: Text(
                              'Outbox connection paused.',
                              style: TextStyle(color: Color(0xFF757891), fontSize: 12),
                            ),
                          )
                        : ListView.builder(
                            physics: const ClampingScrollPhysics(),
                            itemCount: _telemetryLogs.length,
                            itemBuilder: (context, index) {
                              return Padding(
                                padding: const EdgeInsets.symmetric(vertical: 3),
                                child: Text(
                                  _telemetryLogs[index],
                                  style: const TextStyle(
                                    color: Color(0xFF0FA871),
                                    fontFamily: 'monospace',
                                    fontSize: 10,
                                  ),
                                ),
                              );
                            },
                          ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }
}

class _SensorCard extends StatelessWidget {
  const _SensorCard({
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String title;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.015),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(color: Color(0xFF757891), fontSize: 11, fontWeight: FontWeight.bold),
              ),
              Icon(icon, color: color, size: 16),
            ],
          ),
          const Spacer(),
          Text(
            value,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.bold,
              color: Color(0xFF0F101A),
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }
}

class _PulsingCircle extends StatefulWidget {
  const _PulsingCircle({required this.color});

  final Color color;

  @override
  State<_PulsingCircle> createState() => _PulsingCircleState();
}

class _PulsingCircleState extends State<_PulsingCircle>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();

    _animation = Tween<double>(begin: 1.0, end: 2.2).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Container(
          width: 24 * _animation.value,
          height: 24 * _animation.value,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: widget.color.withOpacity(max(0.0, 0.4 * (2.2 - _animation.value))),
          ),
        );
      },
    );
  }
}
