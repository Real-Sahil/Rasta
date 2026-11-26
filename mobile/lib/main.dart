import 'dart:ui' show PlatformDispatcher;

import 'package:flutter/foundation.dart' show kReleaseMode;
import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'l10n.dart';
import 'state/app_state.dart';
import 'state/app_watch.dart';
import 'services/api_client.dart';
import 'services/error_reporter.dart';
import 'services/reports_api.dart';
import 'ui/chamak.dart';
import 'ui/home_shell.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Crash and error reports go to our own API only (no third party). Debug builds don't report.
  if (kReleaseMode) errorReporter = ErrorReporter();
  final previous = FlutterError.onError;
  FlutterError.onError = (details) {
    previous?.call(details);
    errorReporter.report('flutter', details.exception, details.stack);
  };
  PlatformDispatcher.instance.onError = (error, stack) {
    errorReporter.report('flutter', error, stack);
    return false; // keep the default handling (log) as well
  };
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp, DeviceOrientation.portraitDown]);
  runApp(const BuraqApp());
}

class BuraqApp extends StatefulWidget {
  const BuraqApp({super.key});
  @override
  State<BuraqApp> createState() => _BuraqAppState();
}

class _BuraqAppState extends State<BuraqApp> {
  final AppState app = AppState();
  final ReportsApi api = ReportsApi(ApiClient());

  @override
  void initState() {
    super.initState();
    app.init();
  }

  @override
  void dispose() {
    app.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Only a change of language or look rebuilds the app root (and its themes); GPS fixes don't.
    return AppWatch(
      app: app,
      select: (a) => (a.lang, a.skin, a.themeMode),
      builder: (context, _) => MaterialApp(
        title: tr(app.lang, 'appName'),
        debugShowCheckedModeBanner: false,
        theme: buildTheme(skin: app.skin, brightness: Brightness.light),
        darkTheme: buildTheme(skin: app.skin, brightness: Brightness.dark),
        themeMode: app.themeMode,
        // No blend between the old and new theme: the blend rebuilt every screen for 200 ms and, in debug builds,
        // threw a TextStyle assertion when the look changed (the red error screen).
        themeAnimationDuration: Duration.zero,
        builder: (context, child) => Directionality(textDirection: isRtl(app.lang) ? TextDirection.rtl : TextDirection.ltr, child: child!),
        home: SafetyGate(app: app, child: HomeShell(app: app, api: api)),
      ),
    );
  }
}

/// First-run driving-safety notice; stays dismissed once acknowledged.
class SafetyGate extends StatefulWidget {
  const SafetyGate({super.key, required this.app, required this.child});
  final AppState app;
  final Widget child;
  @override
  State<SafetyGate> createState() => _SafetyGateState();
}

class _SafetyGateState extends State<SafetyGate> {
  bool? _ack;

  @override
  void initState() {
    super.initState();
    SharedPreferences.getInstance().then((p) {
      if (mounted) setState(() => _ack = p.getBool('safetyAck') ?? false);
    }).catchError((_) {
      if (mounted) setState(() => _ack = false);
    });
  }

  Future<void> _accept() async {
    setState(() => _ack = true);
    try {
      (await SharedPreferences.getInstance()).setBool('safetyAck', true);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (_ack == null) return const Scaffold(body: SizedBox.shrink());
    if (_ack == true) return widget.child;
    final lang = widget.app.lang;
    return Scaffold(
      body: SafeArea(
        // Scrolls: with large system text on a small phone the button was pushed off-screen and the app couldn't be entered.
        child: LayoutBuilder(
          builder: (context, box) => SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: box.maxHeight - 48),
              child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(tr(lang, 'appName'), style: Theme.of(context).textTheme.headlineMedium, textAlign: TextAlign.center),
              const SizedBox(height: 24),
              Text(tr(lang, 'driveSafe'), style: Theme.of(context).textTheme.titleMedium, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              for (final k in ['legalNotice2', 'legalNotice3']) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(tr(lang, k), textAlign: TextAlign.center)),
              const SizedBox(height: 16),
              Wrap(alignment: WrapAlignment.center, spacing: 8, children: [
                for (final l in supportedLangs)
                  ChoiceChip(label: Text(l == 'en' ? 'English' : (l == 'ur' ? 'اردو' : 'پنجابی')), selected: lang == l, onSelected: (_) => widget.app.setLang(l)),
              ]),
              const SizedBox(height: 24),
              FilledButton(onPressed: _accept, child: Text(tr(lang, 'ok'))),
            ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
