import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/app_strings.dart';
import '../../../app/state/app_controller.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/widgets/rp_widgets.dart';
import '../../quick_add/presentation/scan_bill_screen.dart';

class AssistantChatSheet extends ConsumerStatefulWidget {
  const AssistantChatSheet({super.key});

  @override
  ConsumerState<AssistantChatSheet> createState() => _AssistantChatSheetState();
}

class _AssistantChatSheetState extends ConsumerState<AssistantChatSheet> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  final List<_ChatMessage> _messages = [];
  bool _loading = false;
  Map<String, dynamic>? _pendingCommand;
  bool _voiceListening = false;

  void _startVoiceAssistant() {
    setState(() {
      _voiceListening = true;
    });
  }

  void _simulateVoiceDictation(String targetText) {
    _controller.clear();
    int index = 0;

    setState(() {
      _loading = true;
    });

    Timer.periodic(const Duration(milliseconds: 30), (timer) {
      if (index < targetText.length) {
        _controller.text = targetText.substring(0, index + 1);
        _controller.selection = TextSelection.fromPosition(
          TextPosition(offset: _controller.text.length),
        );
        index++;
      } else {
        timer.cancel();
        Future.delayed(const Duration(milliseconds: 250), () {
          _sendMessage(targetText);
        });
      }
    });
  }

  @override
  void initState() {
    super.initState();
    _messages.add(
      _ChatMessage(
        text: AppStrings.tr(
          ref.read(appControllerProvider).language,
          'assistantWelcome',
        ),
        isUser: false,
      ),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage(String text) async {
    if (text.trim().isEmpty) return;
    setState(() {
      _messages.add(_ChatMessage(text: text, isUser: true));
      _loading = true;
      _pendingCommand = null;
    });
    _controller.clear();
    _scrollToBottom();

    try {
      final api = ref.read(apiClientProvider);
      final response = await api.post(
        '/assistant/command',
        data: {
          'transcript': text,
          'language': ref.read(appControllerProvider).language.code,
        },
      );

      final assistantCommand =
          response['assistantCommand'] as Map<String, dynamic>?;
      if (assistantCommand == null) {
        throw Exception("Invalid response from assistant");
      }

      final language = ref.read(appControllerProvider).language;
      final reply = AppStrings.tr(
        language,
        assistantCommand['reply']?.toString() ?? 'I could not understand that.',
      );
      final requiresConfirmation =
          assistantCommand['requiresConfirmation'] == true;
      final canExecute = assistantCommand['canExecute'] == true;

      setState(() {
        _messages.add(_ChatMessage(text: reply, isUser: false));
        if (requiresConfirmation && canExecute) {
          _pendingCommand = assistantCommand;
        }
      });
      _handleRouteAction(assistantCommand);
    } catch (e) {
      setState(() {
        _messages.add(
          _ChatMessage(text: "Error: ${e.toString()}", isUser: false),
        );
      });
    } finally {
      setState(() {
        _loading = false;
      });
      _scrollToBottom();
    }
  }

  void _handleRouteAction(Map<String, dynamic> assistantCommand) {
    final intent = assistantCommand['intent']?.toString() ?? '';
    if (intent != 'scan_bill') return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final navigator = Navigator.of(context);
      navigator.pop();
      navigator.push(MaterialPageRoute(builder: (_) => const ScanBillScreen()));
    });
  }

  Future<void> _confirmCommand() async {
    final cmd = _pendingCommand;
    if (cmd == null) return;

    setState(() {
      _loading = true;
      _pendingCommand = null;
    });
    _scrollToBottom();

    try {
      final api = ref.read(apiClientProvider);
      final response = await api.post(
        '/assistant/command',
        data: {
          'transcript': cmd['transcript'],
          'language': ref.read(appControllerProvider).language.code,
          'confirm': true,
          'overrides': cmd['slots'],
        },
      );

      final assistantCommand =
          response['assistantCommand'] as Map<String, dynamic>?;
      final language = ref.read(appControllerProvider).language;
      final reply = AppStrings.tr(
        language,
        assistantCommand?['reply']?.toString() ??
            'Command executed successfully.',
      );

      setState(() {
        _messages.add(_ChatMessage(text: reply, isUser: false));
      });

      // Refresh the application state to reflect the new record
      await ref.read(appControllerProvider.notifier).refreshBootstrap();
    } catch (e) {
      setState(() {
        _messages.add(
          _ChatMessage(
            text: "Execution failed: ${e.toString()}",
            isUser: false,
          ),
        );
      });
    } finally {
      setState(() {
        _loading = false;
      });
      _scrollToBottom();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;

    final suggestions = [
      _AssistantSuggestion(
        label: tr(ref, 'assistantSuggestionRevenue'),
        command: 'What is my revenue today?',
      ),
      _AssistantSuggestion(
        label: tr(ref, 'assistantSuggestionExpense'),
        command: 'Add expense 1500 for rent',
      ),
      _AssistantSuggestion(
        label: tr(ref, 'assistantSuggestionStock'),
        command: 'Show low stock products',
      ),
      _AssistantSuggestion(
        label: tr(ref, 'assistantSuggestionBalance'),
        command: 'List customer balance',
      ),
    ];

    return Container(
      height: MediaQuery.of(context).size.height * 0.82,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF16161F) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: Border(
          top: BorderSide(
            color: colorScheme.outlineVariant.withValues(
              alpha: isDark ? 0.15 : 0.3,
            ),
            width: 1,
          ),
        ),
      ),
      child: Column(
        children: [
          // Header handle & title
          Padding(
            padding: const EdgeInsets.only(top: 14, bottom: 6),
            child: Column(
              children: [
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: colorScheme.outlineVariant.withValues(alpha: 0.6),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.document_scanner_outlined),
                      tooltip: tr(ref, 'scanBill'),
                      onPressed: () {
                        Navigator.of(context).pop();
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const ScanBillScreen(),
                          ),
                        );
                      },
                    ),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: colorScheme.primary.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(
                            Icons.auto_awesome_rounded,
                            color: colorScheme.primary,
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Text(
                          tr(ref, 'aiAssistant'),
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
                Divider(
                  color: colorScheme.outlineVariant.withValues(alpha: 0.25),
                  height: 16,
                ),
              ],
            ),
          ),

          // Messages List
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              itemCount:
                  _messages.length +
                  (_loading ? 1 : 0) +
                  (_pendingCommand != null ? 1 : 0),
              itemBuilder: (context, index) {
                if (index < _messages.length) {
                  final msg = _messages[index];
                  return _ChatBubble(message: msg);
                }

                // Loading indicator
                if (index == _messages.length && _loading) {
                  return const _ChatLoadingBubble();
                }

                // Pending execution confirmation card
                final cmd = _pendingCommand;
                if (cmd != null) {
                  return _ConfirmationCard(
                    command: cmd,
                    onConfirm: _confirmCommand,
                    onCancel: () {
                      setState(() {
                        _pendingCommand = null;
                        _messages.add(
                          _ChatMessage(
                            text: tr(ref, 'operationCancelled'),
                            isUser: false,
                          ),
                        );
                      });
                      _scrollToBottom();
                    },
                  );
                }

                return const SizedBox.shrink();
              },
            ),
          ),

          if (_voiceListening)
            _VoiceListeningPanel(
              onSelectText: (spokenText) {
                setState(() {
                  _voiceListening = false;
                });
                _simulateVoiceDictation(spokenText);
              },
              onCancel: () {
                setState(() {
                  _voiceListening = false;
                });
              },
            )
          else ...[
            // Suggestions Row
            if (_pendingCommand == null)
              Container(
                height: 48,
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: suggestions.length,
                  itemBuilder: (context, index) {
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ActionChip(
                        label: Text(
                          suggestions[index].label,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: colorScheme.primary,
                          ),
                        ),
                        onPressed: _loading
                            ? null
                            : () => _sendMessage(suggestions[index].command),
                        backgroundColor: colorScheme.primary.withValues(
                          alpha: 0.05,
                        ),
                        side: BorderSide(
                          color: colorScheme.primary.withValues(alpha: 0.15),
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                        ),
                      ),
                    );
                  },
                ),
              ),

            // Input field
            SafeArea(
              minimum: const EdgeInsets.only(bottom: 16),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: Row(
                  children: [
                    Expanded(
                      child: Container(
                        decoration: BoxDecoration(
                          color: isDark
                              ? Colors.black.withValues(alpha: 0.2)
                              : Colors.grey.withValues(alpha: 0.06),
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(
                            color: colorScheme.outlineVariant.withValues(
                              alpha: 0.35,
                            ),
                            width: 1,
                          ),
                        ),
                        child: Row(
                          children: [
                            const SizedBox(width: 14),
                            Expanded(
                              child: TextField(
                                controller: _controller,
                                enabled: !_loading && _pendingCommand == null,
                                decoration: InputDecoration(
                                  hintText: tr(ref, 'assistantInputHint'),
                                  border: InputBorder.none,
                                  enabledBorder: InputBorder.none,
                                  focusedBorder: InputBorder.none,
                                  isDense: true,
                                  contentPadding: const EdgeInsets.symmetric(
                                    vertical: 12,
                                  ),
                                ),
                                textInputAction: TextInputAction.send,
                                onSubmitted: _sendMessage,
                              ),
                            ),
                            IconButton(
                              icon: Icon(
                                Icons.mic_none_rounded,
                                color: colorScheme.primary,
                              ),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                              onPressed: _loading || _pendingCommand != null
                                  ? null
                                  : () => _startVoiceAssistant(),
                            ),
                            const SizedBox(width: 12),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          colors: [colorScheme.primary, colorScheme.secondary],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: colorScheme.primary.withValues(alpha: 0.35),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: IconButton(
                        icon: const Icon(
                          Icons.send_rounded,
                          color: Colors.white,
                          size: 18,
                        ),
                        onPressed: _loading || _pendingCommand != null
                            ? null
                            : () => _sendMessage(_controller.text),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ChatMessage {
  const _ChatMessage({required this.text, required this.isUser});
  final String text;
  final bool isUser;
}

class _AssistantSuggestion {
  const _AssistantSuggestion({required this.label, required this.command});

  final String label;
  final String command;
}

class _ChatBubble extends StatelessWidget {
  const _ChatBubble({required this.message});
  final _ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;

    final align = message.isUser
        ? CrossAxisAlignment.end
        : CrossAxisAlignment.start;
    final bubbleColor = message.isUser
        ? colorScheme.primary
        : (isDark ? const Color(0xFF23232E) : const Color(0xFFF3F4F6));
    final textColor = message.isUser
        ? Colors.white
        : (isDark ? Colors.white : Colors.black87);
    final radius = message.isUser
        ? const BorderRadius.only(
            topLeft: Radius.circular(20),
            topRight: Radius.circular(20),
            bottomLeft: Radius.circular(20),
            bottomRight: Radius.circular(4),
          )
        : const BorderRadius.only(
            topLeft: Radius.circular(20),
            topRight: Radius.circular(20),
            bottomLeft: Radius.circular(4),
            bottomRight: Radius.circular(20),
          );

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: align,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            constraints: BoxConstraints(
              maxWidth: MediaQuery.of(context).size.width * 0.75,
            ),
            decoration: BoxDecoration(
              color: bubbleColor,
              borderRadius: radius,
              border: message.isUser
                  ? null
                  : Border.all(
                      color: colorScheme.outlineVariant.withValues(
                        alpha: isDark ? 0.15 : 0.4,
                      ),
                      width: 1,
                    ),
            ),
            child: Text(
              message.text,
              style: TextStyle(color: textColor, fontSize: 14, height: 1.4),
            ),
          ),
        ],
      ),
    );
  }
}

class _ChatLoadingBubble extends StatelessWidget {
  const _ChatLoadingBubble();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        margin: const EdgeInsets.symmetric(vertical: 6),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF23232E) : const Color(0xFFF3F4F6),
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(20),
            topRight: Radius.circular(20),
            bottomLeft: Radius.circular(4),
            bottomRight: Radius.circular(20),
          ),
        ),
        child: SizedBox(
          width: 16,
          height: 16,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            valueColor: AlwaysStoppedAnimation<Color>(
              theme.colorScheme.primary,
            ),
          ),
        ),
      ),
    );
  }
}

class _ConfirmationCard extends ConsumerWidget {
  const _ConfirmationCard({
    required this.command,
    required this.onConfirm,
    required this.onCancel,
  });

  final Map<String, dynamic> command;
  final VoidCallback onConfirm;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final slots = Map<String, dynamic>.from(command['slots'] as Map? ?? {});
    final intent = command['intent']?.toString() ?? 'Record Action';

    String title = tr(ref, 'confirmAction');
    List<Widget> details = [];

    if (intent == 'add_expense') {
      title = tr(ref, 'confirmNewExpense');
      details = [
        _buildRow(
          context,
          tr(ref, 'category'),
          trValue(ref, slots['category']?.toString() ?? 'General'),
        ),
        _buildRow(
          context,
          tr(ref, 'amount'),
          money(num.tryParse(slots['amount']?.toString() ?? '') ?? 0),
        ),
        _buildRow(
          context,
          tr(ref, 'vendor'),
          slots['vendor']?.toString() ?? 'Voice entry',
        ),
        _buildRow(
          context,
          tr(ref, 'payment'),
          trValue(ref, slots['paymentMethod']?.toString() ?? 'Cash'),
        ),
      ];
    } else if (intent == 'add_customer') {
      title = tr(ref, 'confirmNewCustomer');
      details = [
        _buildRow(context, tr(ref, 'name'), slots['name']?.toString() ?? '—'),
        _buildRow(context, tr(ref, 'phone'), slots['phone']?.toString() ?? '—'),
      ];
    } else if (intent == 'add_supplier') {
      title = tr(ref, 'confirmNewSupplier');
      details = [
        _buildRow(context, tr(ref, 'name'), slots['name']?.toString() ?? '—'),
        _buildRow(context, tr(ref, 'phone'), slots['phone']?.toString() ?? '—'),
      ];
    } else if (intent == 'add_product') {
      title = tr(ref, 'confirmNewProduct');
      details = [
        _buildRow(context, tr(ref, 'name'), slots['name']?.toString() ?? '—'),
        _buildRow(context, tr(ref, 'unit'), slots['unit']?.toString() ?? 'pcs'),
        _buildRow(
          context,
          tr(ref, 'initialStock'),
          slots['stock']?.toString() ?? '0',
        ),
      ];
    } else {
      title = tr(ref, 'confirmAction');
      for (final entry in slots.entries) {
        details.add(
          _buildRow(context, entry.key, entry.value?.toString() ?? '—'),
        );
      }
    }

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: colorScheme.primary.withValues(alpha: 0.35),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: colorScheme.primary.withValues(alpha: 0.08),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.assignment_turned_in_rounded,
                color: colorScheme.primary,
                size: 20,
              ),
              const SizedBox(width: 10),
              Text(
                title,
                style: const TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 15,
                ),
              ),
            ],
          ),
          const Divider(height: 20),
          ...details,
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: onCancel,
                  style: OutlinedButton.styleFrom(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: Text(tr(ref, 'cancel')),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  onPressed: onConfirm,
                  style: FilledButton.styleFrom(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: Text(tr(ref, 'confirmAndSave')),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRow(BuildContext context, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
              fontSize: 13,
            ),
          ),
          Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          ),
        ],
      ),
    );
  }
}

class _VoiceRippleAnimation extends StatefulWidget {
  const _VoiceRippleAnimation();

  @override
  State<_VoiceRippleAnimation> createState() => _VoiceRippleAnimationState();
}

class _VoiceRippleAnimationState extends State<_VoiceRippleAnimation>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Stack(
          alignment: Alignment.center,
          children: [
            Opacity(
              opacity: (1.0 - _controller.value).clamp(0.0, 1.0),
              child: Transform.scale(
                scale: 1.0 + (_controller.value * 0.8),
                child: Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: colorScheme.primary.withValues(alpha: 0.15),
                    border: Border.all(
                      color: colorScheme.primary.withValues(alpha: 0.3),
                      width: 1.5,
                    ),
                  ),
                ),
              ),
            ),
            Opacity(
              opacity: (1.0 - ((_controller.value + 0.5) % 1.0)).clamp(
                0.0,
                1.0,
              ),
              child: Transform.scale(
                scale: 1.0 + (((_controller.value + 0.5) % 1.0) * 0.8),
                child: Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: colorScheme.secondary.withValues(alpha: 0.1),
                    border: Border.all(
                      color: colorScheme.secondary.withValues(alpha: 0.2),
                      width: 1.5,
                    ),
                  ),
                ),
              ),
            ),
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  colors: [colorScheme.primary, colorScheme.secondary],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: [
                  BoxShadow(
                    color: colorScheme.primary.withValues(alpha: 0.4),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Icon(
                Icons.mic_rounded,
                color: Colors.white,
                size: 28,
              ),
            ),
          ],
        );
      },
    );
  }
}

class _VoiceListeningPanel extends ConsumerWidget {
  const _VoiceListeningPanel({
    required this.onSelectText,
    required this.onCancel,
  });

  final ValueChanged<String> onSelectText;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;

    final voiceSuggestions = [
      _AssistantSuggestion(
        label: tr(ref, 'assistantSuggestionRevenue'),
        command: 'What is my revenue today?',
      ),
      _AssistantSuggestion(
        label: tr(ref, 'assistantSuggestionExpense'),
        command: 'Add expense 1500 for rent',
      ),
      _AssistantSuggestion(
        label: tr(ref, 'assistantSuggestionStock'),
        command: 'Show low stock products',
      ),
      _AssistantSuggestion(
        label: tr(ref, 'assistantSuggestionBalance'),
        command: 'List customer balance',
      ),
    ];

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1F1F2E) : const Color(0xFFF9FAFB),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(
          top: BorderSide(
            color: colorScheme.outlineVariant.withValues(alpha: 0.3),
            width: 1,
          ),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                tr(ref, 'listening'),
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                  color: colorScheme.primary,
                ),
              ),
              TextButton(
                onPressed: onCancel,
                style: TextButton.styleFrom(
                  foregroundColor: colorScheme.onSurfaceVariant,
                  visualDensity: VisualDensity.compact,
                ),
                child: Text(
                  tr(ref, 'cancel'),
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          const Center(child: _VoiceRippleAnimation()),
          const SizedBox(height: 28),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              tr(ref, 'trySpeaking'),
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: colorScheme.onSurfaceVariant.withValues(alpha: 0.8),
                letterSpacing: 0.3,
              ),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 38,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: voiceSuggestions.length,
              itemBuilder: (context, index) {
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ActionChip(
                    label: Text(
                      voiceSuggestions[index].label,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: colorScheme.onSurface,
                      ),
                    ),
                    onPressed: () =>
                        onSelectText(voiceSuggestions[index].command),
                    backgroundColor: colorScheme.surface,
                    side: BorderSide(
                      color: colorScheme.outlineVariant.withValues(alpha: 0.5),
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(18),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
