import 'package:material_ui/material_ui.dart';

import '../core/transit.dart';

/// Vertical schematic of one line: a tick per station in line order, the chosen ride drawn thick.
/// Not to scale (stations are evenly spaced), and it says so.
class LineDiagram extends StatelessWidget {
  const LineDiagram({super.key, required this.stations, required this.color, required this.lang, this.fromId, this.toId, this.onPick, required this.boardLabel, required this.alightLabel, required this.note});
  final List<Station> stations;
  final Color color;
  final String lang;
  final String? fromId, toId;
  final void Function(Station)? onPick;
  final String boardLabel, alightLabel, note;

  @override
  Widget build(BuildContext context) {
    final i = stations.indexWhere((s) => s.id == fromId), j = stations.indexWhere((s) => s.id == toId);
    final lo = (i >= 0 && j >= 0) ? (i < j ? i : j) : -1, hi = (i >= 0 && j >= 0) ? (i < j ? j : i) : -1;
    const row = 34.0;
    final ink = Theme.of(context).colorScheme.onSurface;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      for (var k = 0; k < stations.length; k++)
        InkWell(
          onTap: onPick == null ? null : () => onPick!(stations[k]),
          child: SizedBox(
            height: row,
            child: Row(children: [
              const SizedBox(width: 16),
              SizedBox(
                width: 36,
                child: CustomPaint(
                  painter: _Tick(color: color, ink: ink, first: k == 0, last: k == stations.length - 1, endpoint: k == i || k == j, rideUp: lo >= 0 && k > lo && k <= hi, rideDown: lo >= 0 && k >= lo && k < hi),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  stations[k].label(lang),
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontWeight: (k == i || k == j) ? FontWeight.w700 : FontWeight.w400),
                ),
              ),
              if (k == i) Padding(padding: const EdgeInsets.only(right: 16), child: Text(boardLabel, style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 12))),
              if (k == j) Padding(padding: const EdgeInsets.only(right: 16), child: Text(alightLabel, style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 12))),
            ]),
          ),
        ),
      Padding(padding: const EdgeInsets.fromLTRB(16, 8, 16, 0), child: Text(note, style: Theme.of(context).textTheme.bodySmall)),
    ]);
  }
}

class _Tick extends CustomPainter {
  _Tick({required this.color, required this.ink, required this.first, required this.last, required this.endpoint, required this.rideUp, required this.rideDown});
  final Color color, ink;
  final bool first, last, endpoint, rideUp, rideDown;
  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2, cy = size.height / 2;
    final under = Paint()..color = ink..strokeWidth = 12;
    final line = Paint()..color = color..strokeWidth = 6;
    if (rideUp) canvas.drawLine(Offset(cx, 0), Offset(cx, cy), under);
    if (rideDown) canvas.drawLine(Offset(cx, cy), Offset(cx, size.height), under);
    if (!first) canvas.drawLine(Offset(cx, 0), Offset(cx, cy), line);
    if (!last) canvas.drawLine(Offset(cx, cy), Offset(cx, size.height), line);
    final r = endpoint ? 9.0 : 5.0;
    canvas.drawCircle(Offset(cx, cy), r, Paint()..color = Colors.white);
    canvas.drawCircle(Offset(cx, cy), r, Paint()..color = endpoint ? ink : color..style = PaintingStyle.stroke..strokeWidth = endpoint ? 4 : 3);
  }

  @override
  bool shouldRepaint(covariant _Tick o) => o.color != color || o.endpoint != endpoint || o.rideUp != rideUp || o.rideDown != rideDown;
}
