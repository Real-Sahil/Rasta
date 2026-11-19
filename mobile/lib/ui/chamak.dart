import 'package:material_ui/material_ui.dart';

/// Optional truck-art look. Chrome only (nav bar, driving HUD, buttons); the map and data screens stay plain.
/// Yatra One is not bundled in the app, so the system font is used.
const Color kChamakRed = Color(0xFFD7263D);
const Color kChamakGold = Color(0xFFF5B700);
const Color kChamakInk = Color(0xFF14161A);
const Color kChamakIvory = Color(0xFFFFFBF0);

/// The selectable looks. `standard` is the plain green app; the rest restyle chrome only (nav bar, driving HUD, buttons).
const List<String> kSkins = ['standard', 'luce', 'miniature', 'schematic', 'chamak', 'nastaliq'];
const Map<String, String> kSkinNames = {'standard': '', 'luce': 'Luce', 'miniature': 'Miniature', 'schematic': 'Schematic', 'chamak': 'Chamak', 'nastaliq': 'Nastaliq'};

/// Colours for one skin in one brightness. Used by the theme, nav bar and driving HUD.
class SkinPalette {
  const SkinPalette({required this.accent, required this.paper, required this.ink, required this.sub, required this.badge, required this.onBadge, required this.card, required this.rule});
  final Color accent, paper, ink, sub, badge, onBadge, card, rule;
}

SkinPalette skinPalette(String skin, Brightness b) {
  final dark = b == Brightness.dark;
  switch (skin) {
    case 'luce':
      return dark
          ? const SkinPalette(accent: Color(0xFFC9A24B), paper: Color(0xFF0B0B0C), ink: Color(0xFFEDE6D6), sub: Color(0xFFCFC7B4), badge: Color(0xFF0B0B0C), onBadge: Color(0xFFC9A24B), card: Color(0xFF0B0B0C), rule: Color(0xFF3A3224))
          : const SkinPalette(accent: Color(0xFF8A6A2F), paper: Color(0xFFFAF8F3), ink: Color(0xFF1A1814), sub: Color(0xFF3A352B), badge: Color(0xFFFAF8F3), onBadge: Color(0xFF8A6A2F), card: Color(0xFFFAF8F3), rule: Color(0xFFD9CFB8));
    case 'miniature':
      return dark
          ? const SkinPalette(accent: Color(0xFFE3B341), paper: Color(0xFF101A33), ink: Color(0xFFF3E7C6), sub: Color(0xFFE7DBB8), badge: Color(0xFFC4381F), onBadge: Color(0xFFFBF3DF), card: Color(0xFF101A33), rule: Color(0xFF26375F))
          : const SkinPalette(accent: Color(0xFF1F3A6E), paper: Color(0xFFFBF3DF), ink: Color(0xFF1F2F5C), sub: Color(0xFF2B3A66), badge: Color(0xFFC4381F), onBadge: Color(0xFFFBF3DF), card: Color(0xFFFBF3DF), rule: Color(0xFFD9C99B));
    case 'schematic':
      return dark
          ? const SkinPalette(accent: Color(0xFF7C8CFF), paper: Color(0xFF0B1020), ink: Color(0xFFF2F4FF), sub: Color(0xFFCBD1F5), badge: Color(0xFF4457FF), onBadge: Colors.white, card: Color(0xFF0B1020), rule: Color(0xFF27306B))
          : const SkinPalette(accent: Color(0xFF0019A8), paper: Colors.white, ink: Color(0xFF0B1020), sub: Color(0xFF2B3050), badge: Color(0xFF0019A8), onBadge: Colors.white, card: Colors.white, rule: Color(0xFFC9CEE8));
    case 'nastaliq':
      return dark
          ? const SkinPalette(accent: Color(0xFF4FC79C), paper: Color(0xFF0E1613), ink: Color(0xFFEDE9D8), sub: Color(0xFFE3DFC9), badge: Color(0xFF0F6B4F), onBadge: Colors.white, card: Color(0xFF0E1613), rule: Color(0xFF2E4A3D))
          : const SkinPalette(accent: Color(0xFF0F6B4F), paper: Color(0xFFFBF6E9), ink: Color(0xFF16241E), sub: Color(0xFF16241E), badge: Color(0xFF0F6B4F), onBadge: Colors.white, card: Color(0xFFFBF6E9), rule: Color(0xFFDDD2AE));
    default: // chamak
      return dark
          ? const SkinPalette(accent: kChamakGold, paper: kChamakInk, ink: Colors.white, sub: Colors.white70, badge: kChamakRed, onBadge: Colors.white, card: kChamakInk, rule: Color(0xFF2A2D33))
          : const SkinPalette(accent: Color(0xFF8A5A00), paper: kChamakIvory, ink: Color(0xFF1B1B1D), sub: Color(0xFF3B3B40), badge: kChamakRed, onBadge: Colors.white, card: kChamakIvory, rule: Color(0xFFE6DDC4));
  }
}

ThemeData buildTheme({required String skin, required Brightness brightness}) {
  if (skin == 'standard' || !kSkins.contains(skin)) {
    return ThemeData(colorSchemeSeed: const Color(0xFF059669), brightness: brightness, useMaterial3: true);
  }
  final p = skinPalette(skin, brightness);
  final primary = skin == 'chamak' ? kChamakRed : (brightness == Brightness.dark ? p.accent : p.accent);
  final scheme = ColorScheme.fromSeed(seedColor: primary, brightness: brightness).copyWith(
    primary: primary,
    onPrimary: skin == 'chamak' ? Colors.white : p.paper,
    secondary: p.accent,
    surface: p.paper,
    onSurface: p.ink,
  );
  return ThemeData(
    colorScheme: scheme,
    useMaterial3: true,
    scaffoldBackgroundColor: p.paper,
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: p.paper,
      indicatorColor: skin == 'chamak' ? kChamakRed : p.accent.withValues(alpha: 0.2),
      iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(color: s.contains(WidgetState.selected) ? (skin == 'chamak' ? Colors.white : p.accent) : p.sub)),
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
