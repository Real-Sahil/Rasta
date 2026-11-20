import 'package:material_ui/material_ui.dart';

// Motion for the app chrome, same rules as the web app (src/index.css "Motion"): one curve, short, no bounce,
// nothing loops while driving, and the phone's "remove animations" setting turns it all off.
// Built-in Flutter widgets only: no animation package needed for this, and none of it touches the map view.

/// The iOS sheet curve: quick start, long soft landing.
const Curve kEaseOut = Cubic(0.32, 0.72, 0, 1);

/// [ms], or zero when the user asked the OS to remove animations.
Duration motionMs(BuildContext context, int ms) => (MediaQuery.maybeDisableAnimationsOf(context) ?? false) ? Duration.zero : Duration(milliseconds: ms);

/// Fades and slides [child] in once, when it first appears. Rebuilds don't replay it.
class Entrance extends StatelessWidget {
  const Entrance({super.key, required this.child, this.dx = 0, this.dy = 24, this.ms = 260});
  final Widget child;
  final double dx, dy;
  final int ms;
  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: motionMs(context, ms),
        curve: kEaseOut,
        child: child,
        builder: (context, t, child) => Opacity(opacity: t, child: Transform.translate(offset: Offset(dx * (1 - t), dy * (1 - t)), child: child)),
      );
}

/// Cross-fades between children with a short slide from [from] (a fraction of the child's size).
/// Children need distinct keys or types; the new one sits where [alignment] says while the old one fades.
class SlideSwitcher extends StatelessWidget {
  const SlideSwitcher({super.key, required this.child, this.from = const Offset(0, -0.06), this.alignment = Alignment.topCenter, this.ms = 240});
  final Widget child;
  final Offset from;
  final AlignmentGeometry alignment;
  final int ms;
  @override
  Widget build(BuildContext context) => AnimatedSwitcher(
        duration: motionMs(context, ms),
        switchInCurve: kEaseOut,
        switchOutCurve: Curves.easeOut,
        layoutBuilder: (current, previous) => Stack(alignment: alignment, children: [...previous, ?current]),
        transitionBuilder: (child, a) => FadeTransition(
          opacity: a,
          child: SlideTransition(position: Tween(begin: from, end: Offset.zero).animate(a), child: child),
        ),
        child: child,
      );
}

/// A tab body inside an IndexedStack: fades up each time its tab is chosen (the stack keeps its state alive).
class TabEntrance extends StatefulWidget {
  const TabEntrance({super.key, required this.active, required this.child});
  final bool active;
  final Widget child;
  @override
  State<TabEntrance> createState() => _TabEntranceState();
}

class _TabEntranceState extends State<TabEntrance> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, value: 1);
  late final Animation<double> _a = CurvedAnimation(parent: _c, curve: kEaseOut);

  @override
  void didUpdateWidget(TabEntrance old) {
    super.didUpdateWidget(old);
    if (widget.active && !old.active) {
      _c.duration = motionMs(context, 220);
      _c.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FadeTransition(
        opacity: _a,
        child: SlideTransition(position: Tween(begin: const Offset(0, 0.015), end: Offset.zero).animate(_a), child: widget.child),
      );
}
