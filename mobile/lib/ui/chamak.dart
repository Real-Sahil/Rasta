import 'dart:math' as math;

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

/// The standard look's tokens, the same values as the web app's `:root` / `html.dark` in `src/index.css`.
class BuraqTokens {
  const BuraqTokens({required this.ink, required this.ink2, required this.paper, required this.surface, required this.line, required this.brand, required this.onBrand});
  final Color ink, ink2, paper, surface, line, brand, onBrand;
  static const signal = Color(0xFFFFC83D); // road yellow: turn tile, "Fastest"
  static const danger = Color(0xFFE23A3F);
  static const hud = Color(0xFF0E1A14); // the driving card is dark in both themes

  static BuraqTokens of(Brightness b) => b == Brightness.dark
      ? const BuraqTokens(ink: Color(0xFFECF2EE), ink2: Color(0xFF9AABA2), paper: Color(0xFF0A0F0D), surface: Color(0xFF131A17), line: Color(0x14FFFFFF), brand: Color(0xFF1DAE72), onBrand: Color(0xFF04140C))
      : const BuraqTokens(ink: Color(0xFF0E1A14), ink2: Color(0xFF55645C), paper: Color(0xFFF3F2EC), surface: Colors.white, line: Color(0x170E1A14), brand: Color(0xFF0E7A50), onBrand: Colors.white);
}

/// Standard look: ink-filled selection, pill buttons, soft surfaces, heavy numbers.
ThemeData standardTheme(Brightness b) {
  final t = BuraqTokens.of(b);
  final scheme = ColorScheme.fromSeed(seedColor: t.brand, brightness: b).copyWith(
    primary: t.brand,
    onPrimary: t.onBrand,
    secondary: t.ink,
    onSecondary: t.paper,
    tertiary: BuraqTokens.signal,
    onTertiary: const Color(0xFF0E1A14),
    error: BuraqTokens.danger,
    onError: Colors.white,
    surface: t.surface,
    onSurface: t.ink,
    onSurfaceVariant: t.ink2,
    surfaceContainerLowest: t.surface,
    surfaceContainerLow: t.paper,
    surfaceContainer: t.paper,
    surfaceContainerHigh: t.paper,
    surfaceContainerHighest: t.paper,
    outline: t.ink2,
    outlineVariant: t.line,
  );
  const pill = StadiumBorder();
  const bold = TextStyle(fontWeight: FontWeight.w800, letterSpacing: -0.2);
  final base = ThemeData(colorScheme: scheme, useMaterial3: true, brightness: b);
  return base.copyWith(
    scaffoldBackgroundColor: t.paper,
    textTheme: base.textTheme.copyWith(
      headlineSmall: base.textTheme.headlineSmall?.merge(bold),
      titleLarge: base.textTheme.titleLarge?.merge(bold),
      titleMedium: base.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        shape: pill,
        minimumSize: const Size(64, 52),
        padding: const EdgeInsets.symmetric(horizontal: 22),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
        elevation: 0,
      ).copyWith(
        // A slight top-to-bottom sheen so the main action reads as something to press.
        backgroundBuilder: (context, states, child) {
          if (states.contains(WidgetState.disabled)) return child ?? const SizedBox.shrink();
          final pressed = states.contains(WidgetState.pressed);
          return DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(999),
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color.lerp(t.brand, Colors.white, pressed ? 0.04 : 0.14)!, Color.lerp(t.brand, Colors.black, 0.12)!],
              ),
              boxShadow: pressed ? null : [BoxShadow(color: t.brand.withValues(alpha: 0.35), blurRadius: 16, offset: const Offset(0, 6), spreadRadius: -6)],
            ),
            child: child,
          );
        },
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(shape: pill, minimumSize: const Size(48, 44), foregroundColor: t.ink, side: BorderSide(color: t.line, width: 1.5), textStyle: const TextStyle(fontWeight: FontWeight.w700)),
    ),
    textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(shape: pill, foregroundColor: t.ink, textStyle: const TextStyle(fontWeight: FontWeight.w700))),
    iconButtonTheme: IconButtonThemeData(style: IconButton.styleFrom(foregroundColor: t.ink)),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: SegmentedButton.styleFrom(
        shape: pill,
        side: BorderSide.none,
        backgroundColor: t.paper,
        foregroundColor: t.ink2,
        selectedBackgroundColor: t.ink,
        selectedForegroundColor: t.paper,
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    chipTheme: ChipThemeData(
      shape: StadiumBorder(side: BorderSide(color: t.line)),
      backgroundColor: t.surface,
      selectedColor: t.ink,
      labelStyle: TextStyle(color: t.ink, fontWeight: FontWeight.w700),
      secondaryLabelStyle: TextStyle(color: t.paper, fontWeight: FontWeight.w700),
      checkmarkColor: t.paper,
      showCheckmark: false,
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
    ),
    cardTheme: CardThemeData(color: t.surface, elevation: 0, margin: EdgeInsets.zero, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22), side: BorderSide(color: t.line))),
    listTileTheme: ListTileThemeData(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)), iconColor: t.ink2, titleTextStyle: TextStyle(color: t.ink, fontSize: 15, fontWeight: FontWeight.w700)),
    dividerTheme: DividerThemeData(color: t.line, space: 1, thickness: 1),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: t.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(18), borderSide: BorderSide(color: t.line)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(18), borderSide: BorderSide(color: t.line)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(18), borderSide: BorderSide(color: t.ink, width: 2)),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: t.surface,
      surfaceTintColor: Colors.transparent,
      indicatorColor: t.ink,
      indicatorShape: pill,
      height: 68,
      iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(color: s.contains(WidgetState.selected) ? t.paper : t.ink2)),
      labelTextStyle: WidgetStateProperty.resolveWith((s) => TextStyle(fontSize: 11, fontWeight: s.contains(WidgetState.selected) ? FontWeight.w800 : FontWeight.w600, color: s.contains(WidgetState.selected) ? t.ink : t.ink2)),
    ),
    bottomSheetTheme: BottomSheetThemeData(backgroundColor: t.surface, surfaceTintColor: Colors.transparent, showDragHandle: true, dragHandleColor: t.line, shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28)))),
    dialogTheme: DialogThemeData(backgroundColor: t.surface, surfaceTintColor: Colors.transparent, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28))),
    snackBarTheme: SnackBarThemeData(behavior: SnackBarBehavior.floating, backgroundColor: t.ink, contentTextStyle: TextStyle(color: t.paper, fontWeight: FontWeight.w600), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
    floatingActionButtonTheme: FloatingActionButtonThemeData(backgroundColor: t.surface, foregroundColor: t.ink, elevation: 3, shape: const CircleBorder()),
  );
}

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
  if (skin == 'standard' || !kSkins.contains(skin)) return standardTheme(brightness);
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
      labelTextStyle: WidgetStateProperty.resolveWith((s) => TextStyle(fontSize: 11, fontWeight: s.contains(WidgetState.selected) ? FontWeight.w800 : FontWeight.w600, color: p.ink)),
    ),
    // The same kinds of text style as standardTheme (plain TextStyle, inherit: true), only recoloured. Chips, buttons
    // and list tiles animate their text style when the look changes; a plain style on one side and a full theme style
    // on the other can't be blended, which threw the red error screen when switching Standard <-> a skin.
    chipTheme: ChipThemeData(
      labelStyle: TextStyle(color: p.ink, fontWeight: FontWeight.w700),
      secondaryLabelStyle: TextStyle(color: p.ink, fontWeight: FontWeight.w700),
    ),
    filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800))),
    outlinedButtonTheme: OutlinedButtonThemeData(style: OutlinedButton.styleFrom(textStyle: const TextStyle(fontWeight: FontWeight.w700))),
    textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(textStyle: const TextStyle(fontWeight: FontWeight.w700))),
    segmentedButtonTheme: SegmentedButtonThemeData(style: SegmentedButton.styleFrom(textStyle: const TextStyle(fontWeight: FontWeight.w700))),
    listTileTheme: ListTileThemeData(titleTextStyle: TextStyle(color: p.ink, fontSize: 15, fontWeight: FontWeight.w700)),
    snackBarTheme: SnackBarThemeData(contentTextStyle: TextStyle(color: scheme.onInverseSurface, fontWeight: FontWeight.w600)),
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

/// Luce's watch dial: 60 ticks that light clockwise as the turn nears, plus a thin arc.
class LuceDial extends StatelessWidget {
  const LuceDial({super.key, required this.progress, required this.lit, required this.dim, required this.child, this.size = 104});
  final double progress, size;
  final Color lit, dim;
  final Widget child;
  @override
  Widget build(BuildContext context) => SizedBox(
        width: size,
        height: size,
        child: CustomPaint(painter: _DialPainter(progress, lit, dim), child: Center(child: child)),
      );
}

class _DialPainter extends CustomPainter {
  _DialPainter(this.progress, this.lit, this.dim);
  final double progress;
  final Color lit, dim;
  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final k = size.width / 120;
    final litCount = (progress * 60).round();
    for (var i = 0; i < 60; i++) {
      final major = i % 5 == 0;
      final a = i / 60 * 2 * 3.141592653589793 - 3.141592653589793 / 2;
      final r1 = 57 * k, r2 = (major ? 49 : 52) * k;
      canvas.drawLine(
        c + Offset(r1 * _cos(a), r1 * _sin(a)),
        c + Offset(r2 * _cos(a), r2 * _sin(a)),
        Paint()
          ..color = i < litCount ? lit : dim
          ..strokeWidth = (major ? 2 : 1.2) * k
          ..strokeCap = StrokeCap.round,
      );
    }
    final rect = Rect.fromCircle(center: c, radius: 42 * k);
    canvas.drawArc(rect, 0, 6.283185307179586, false, Paint()..color = dim..style = PaintingStyle.stroke..strokeWidth = k);
    canvas.drawArc(rect, -3.141592653589793 / 2, progress * 6.283185307179586, false, Paint()..color = lit..style = PaintingStyle.stroke..strokeWidth = 2.5 * k..strokeCap = StrokeCap.round);
  }

  double _cos(double a) => math.cos(a);
  double _sin(double a) => math.sin(a);

  @override
  bool shouldRepaint(covariant _DialPainter o) => o.progress != progress || o.lit != lit || o.dim != dim;
}
