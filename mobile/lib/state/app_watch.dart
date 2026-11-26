import 'package:material_ui/material_ui.dart';

import 'app_state.dart';

/// Rebuilds [builder] only when [select] returns a value different from last time (`==`; records compare by value).
///
/// AppState notifies on every GPS fix while driving. Without this, the whole app (theme included) and every tab
/// rebuilt once a second, which cheap phones feel. [child] is built once and handed to [builder] unchanged.
class AppWatch extends StatefulWidget {
  const AppWatch({super.key, required this.app, required this.select, required this.builder, this.child});
  final AppState app;
  final Object? Function(AppState app) select;
  final Widget Function(BuildContext context, Widget? child) builder;
  final Widget? child;

  @override
  State<AppWatch> createState() => _AppWatchState();
}

class _AppWatchState extends State<AppWatch> {
  late Object? _last = widget.select(widget.app);

  @override
  void initState() {
    super.initState();
    widget.app.addListener(_changed);
  }

  @override
  void didUpdateWidget(AppWatch old) {
    super.didUpdateWidget(old);
    if (old.app != widget.app) {
      old.app.removeListener(_changed);
      widget.app.addListener(_changed);
    }
    _last = widget.select(widget.app);
  }

  @override
  void dispose() {
    widget.app.removeListener(_changed);
    super.dispose();
  }

  void _changed() {
    final now = widget.select(widget.app);
    if (now == _last) return;
    _last = now;
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) => widget.builder(context, widget.child);
}
