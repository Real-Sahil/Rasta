import 'package:material_ui/material_ui.dart';

/// Optional truck-art look. Chrome only (nav bar, driving HUD, buttons); the map and data screens stay plain.
/// Yatra One is not bundled in the app, so the system font is used.
const Color kChamakRed = Color(0xFFD7263D);
const Color kChamakGold = Color(0xFFF5B700);
const Color kChamakInk = Color(0xFF14161A);
const Color kChamakIvory = Color(0xFFFFFBF0);

ThemeData buildTheme({required bool chamak, required Brightness brightness}) {
  final dark = brightness == Brightness.dark;
  if (!chamak) {
    return ThemeData(colorSchemeSeed: const Color(0xFF059669), brightness: brightness, useMaterial3: true);
  }
  final scheme = ColorScheme.fromSeed(seedColor: kChamakRed, brightness: brightness).copyWith(
    primary: kChamakRed,
    onPrimary: Colors.white,
    secondary: dark ? kChamakGold : const Color(0xFF8A5A00),
    surface: dark ? kChamakInk : kChamakIvory,
  );
  return ThemeData(
    colorScheme: scheme,
    useMaterial3: true,
    scaffoldBackgroundColor: scheme.surface,
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: dark ? kChamakInk : kChamakIvory,
      indicatorColor: kChamakRed,
      iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(color: s.contains(WidgetState.selected) ? Colors.white : null)),
    ),
  );
}

/// Repeating gold/red diamond strip. Decorative only, so it is hidden from screen readers.
class ChamakStrip extends StatelessWidget {
  const ChamakStrip({super.key, this.height = 10, this.opacity = 1});
  final double height;
  final double opacity;
  @override
  Widget build(BuildContext context) => ExcludeSemantics(
        child: Opacity(
          opacity: opacity,
          child: SizedBox(height: height, width: double.infinity, child: CustomPaint(painter: _StripPainter())),
        ),
      );
}

class _StripPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = kChamakInk);
    final w = size.height * 2;
    final red = Paint()..color = kChamakRed;
    final gold = Paint()..color = kChamakGold;
    for (double x = 0; x < size.width; x += w) {
      final cx = x + w / 2, cy = size.height / 2;
      final d = Path()
        ..moveTo(cx, 0)
        ..lineTo(cx + w / 2 - 1, cy)
        ..lineTo(cx, size.height)
        ..lineTo(cx - w / 2 + 1, cy)
        ..close();
      canvas.drawPath(d, red);
      canvas.drawCircle(Offset(cx, cy), size.height / 5, gold);
    }
    canvas.drawRect(Rect.fromLTWH(0, size.height - 1, size.width, 1), gold);
  }

  @override
  bool shouldRepaint(covariant CustomPainter old) => false;
}
