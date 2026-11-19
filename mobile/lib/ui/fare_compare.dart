import 'package:material_ui/material_ui.dart';

import '../core/fares.dart';
import '../core/route.dart';
import '../l10n.dart';

String _cap(String k) => k[0].toUpperCase() + k.substring(1);

/// "Compare ways to travel": estimates only, labelled as such. Hidden for offline-estimate routes (their distance is a guess).
class FareCompare extends StatefulWidget {
  const FareCompare({super.key, required this.lang, required this.route, required this.lahore});
  final String lang;
  final RouteOption route;
  final bool lahore;
  @override
  State<FareCompare> createState() => _FareCompareState();
}

class _FareCompareState extends State<FareCompare> {
  bool _student = false;

  @override
  Widget build(BuildContext context) {
    final lang = widget.lang;
    final opts = compareModes(distanceKm: widget.route.distanceKm, durationMinutes: widget.route.durationMinutes, student: _student, lahore: widget.lahore);
    return ExpansionTile(
      tilePadding: EdgeInsets.zero,
      title: Text(tr(lang, 'fareTitle'), style: Theme.of(context).textTheme.titleSmall),
      children: [
        for (final o in opts)
          ListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            title: Text(tr(lang, 'fm${_cap(o.mode)}')),
            subtitle: Text([
              tr(lang, 'fareLine').replaceAll('{min}', '${o.minutes}').replaceAll('{cost}', '${o.costPkr}'),
              if (o.co2g > 0) tr(lang, 'fareCo2').replaceAll('{g}', '${o.co2g}'),
              if (o.cheapest) tr(lang, 'fareCheapest'),
              if (o.fastest) tr(lang, 'fareFastest'),
            ].join(' · ')),
          ),
        if (widget.lahore) SwitchListTile(dense: true, contentPadding: EdgeInsets.zero, title: Text(tr(lang, 'fareStudent')), value: _student, onChanged: (v) => setState(() => _student = v)),
        Align(alignment: AlignmentDirectional.centerStart, child: Text('${tr(lang, 'fareNote')}${widget.lahore ? '' : ' ${tr(lang, 'fareLahoreOnly')}'}', style: Theme.of(context).textTheme.labelSmall)),
        const SizedBox(height: 8),
      ],
    );
  }
}
