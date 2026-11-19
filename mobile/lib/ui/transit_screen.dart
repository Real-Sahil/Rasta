import 'package:flutter/services.dart' show rootBundle;
import 'package:material_ui/material_ui.dart';

import '../core/conditions.dart' show nearestCity;
import '../core/transit.dart';
import '../l10n.dart';
import '../services/reports_api.dart';
import '../services/search_service.dart';
import '../state/app_state.dart';
import 'line_diagram.dart';
import 'riders_screen.dart';

class _Lines {
  const _Lines(this.metrobus, this.orange, this.others);
  final List<Station> metrobus, orange;
  final List<MetroLine> others; // lines outside Lahore
}

Future<List<MetroLine>> _others() async {
  try {
    return parseLines(await rootBundle.loadString('assets/osm/lines.json'));
  } catch (_) {
    return const []; // no extract bundled yet
  }
}

Future<_Lines> _load() async => _Lines(
      parseStations(await rootBundle.loadString('assets/osm/metrobus.json')),
      parseStations(await rootBundle.loadString('assets/osm/orangeline.json')),
      await _others(),
    );

const _fallbackColours = [Color(0xFF0E7490), Color(0xFF7C3AED), Color(0xFF16A34A), Color(0xFFDC2626), Color(0xFF2563EB), Color(0xFFCA8A04)];

/// Stations (tap one to route to it), a station-count fare estimate, and the riders' report card.
class TransitScreen extends StatefulWidget {
  const TransitScreen({super.key, required this.app, required this.api, required this.active, required this.onRouteTo});
  final AppState app;
  final ReportsApi api;
  final bool active;
  final VoidCallback onRouteTo; // switch to the map once a destination is set
  @override
  State<TransitScreen> createState() => _TransitScreenState();
}

class _TransitScreenState extends State<TransitScreen> {
  int _tab = 0; // 0 stations, 1 fare, 2 riders
  String _line = 'orangeline';
  bool _student = false;
  bool _diagram = false; // stations tab: list or schematic
  String? _from, _to;
  String? _city; // metro area on the stations tab; null = follow the fix (else Lahore)
  late final Future<_Lines> _data = _load();

  String _fill(String lang, String key, Map<String, Object> v) {
    var t = tr(lang, key);
    v.forEach((k, x) => t = t.replaceAll('{$k}', '$x'));
    return t;
  }

  Future<void> _routeTo(Station s) async {
    widget.onRouteTo();
    await widget.app.setDestination(Place(id: s.id, name: s.name, detail: s.code, point: s.point));
  }

  @override
  Widget build(BuildContext context) {
    final lang = widget.app.lang;
    return Scaffold(
      appBar: AppBar(title: Text(tr(lang, 'navTransit'))),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: SegmentedButton<int>(
            segments: [
              ButtonSegment(value: 0, label: Text(tr(lang, 'trTabStations'))),
              ButtonSegment(value: 1, label: Text(tr(lang, 'trTabFare'))),
              ButtonSegment(value: 2, label: Text(tr(lang, 'trTabRiders'))),
            ],
            selected: {_tab},
            onSelectionChanged: (s) => setState(() => _tab = s.first),
          ),
        ),
        Expanded(
          child: _tab == 2
              ? RidersScreen(app: widget.app, api: widget.api, active: widget.active && _tab == 2, embedded: true)
              : FutureBuilder<_Lines>(
                  future: _data,
                  builder: (context, snap) {
                    final d = snap.data;
                    if (d == null) return const Center(child: CircularProgressIndicator());
                    return _tab == 0 ? _stations(lang, d) : _fare(lang, d);
                  },
                ),
        ),
      ]),
    );
  }

  Widget _stations(String lang, _Lines d) {
    Widget section(String titleKey, List<Station> list) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Text('${tr(lang, titleKey)} · ${_fill(lang, 'trStops', {'n': list.length})}', style: Theme.of(context).textTheme.titleMedium),
          ),
          if (list.isEmpty) Padding(padding: const EdgeInsets.all(16), child: Text(tr(lang, 'trNoData'))),
          for (final s in list)
            ListTile(
              dense: true,
              leading: Text(s.code, style: const TextStyle(fontWeight: FontWeight.w600)),
              title: Text(s.label(lang)),
              trailing: const Icon(Icons.directions),
              onTap: () => _routeTo(s),
            ),
        ]);
    Widget diagram(String titleKey, List<Station> list, Color c) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Text('${tr(lang, titleKey)} · ${_fill(lang, 'trStops', {'n': list.length})}', style: Theme.of(context).textTheme.titleMedium),
          ),
          if (list.isEmpty) Padding(padding: const EdgeInsets.all(16), child: Text(tr(lang, 'trNoData'))),
          LineDiagram(stations: list, color: c, lang: lang, onPick: _routeTo, boardLabel: tr(lang, 'diagBoard'), alightLabel: tr(lang, 'diagAlight'), note: tr(lang, 'diagNote')),
        ]);
    final cities = ['lahore', ...{for (final l in d.others) l.city}.where((c) => c != 'lahore')];
    final auto = metroCityFor(nearestCity(widget.app.fix?.point));
    final city = _city ?? (cities.contains(auto) ? auto : 'lahore');
    final lines = d.others.where((l) => l.city == city).toList();
    Color colourOf(int i) => lines[i].colour != null ? Color(lines[i].colour!) : _fallbackColours[i % _fallbackColours.length];
    Widget otherSection(int i) {
      final l = lines[i];
      final head = Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
        child: Text('${l.label(lang)} · ${_fill(lang, 'trStops', {'n': l.stations.length})}', style: Theme.of(context).textTheme.titleMedium),
      );
      if (_diagram) {
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          head,
          LineDiagram(stations: l.stations, color: colourOf(i), lang: lang, onPick: _routeTo, boardLabel: tr(lang, 'diagBoard'), alightLabel: tr(lang, 'diagAlight'), note: tr(lang, 'diagNote')),
        ]);
      }
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        head,
        for (final s in l.stations)
          ListTile(
            dense: true,
            leading: CircleAvatar(radius: 12, backgroundColor: colourOf(i), child: Text(s.code, style: const TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.w700))),
            title: Text(s.label(lang)),
            trailing: const Icon(Icons.directions),
            onTap: () => _routeTo(s),
          ),
      ]);
    }
    return ListView(children: [
      if (cities.length > 1)
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: Row(children: [
            for (final c in cities)
              Padding(
                padding: const EdgeInsetsDirectional.only(end: 6),
                child: ChoiceChip(label: Text(tr(lang, 'mc_$c')), selected: c == city, onSelected: (_) => setState(() => _city = c)),
              ),
          ]),
        ),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: SegmentedButton<bool>(
          segments: [ButtonSegment(value: false, label: Text(tr(lang, 'diagList'))), ButtonSegment(value: true, label: Text(tr(lang, 'diagDiagram')))],
          selected: {_diagram},
          onSelectionChanged: (s) => setState(() => _diagram = s.first),
        ),
      ),
      Padding(padding: const EdgeInsets.fromLTRB(16, 8, 16, 0), child: Text(tr(lang, 'trTapHint'))),
      if (city != 'lahore') ...[
        for (var i = 0; i < lines.length; i++) otherSection(i),
        Padding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 0), child: Text(tr(lang, 'metroNoFares'))),
      ] else if (_diagram) ...[diagram('trOrange', d.orange, const Color(0xFFF26A21)), diagram('trMetrobus', d.metrobus, const Color(0xFFE11D48))] else ...[section('trOrange', d.orange), section('trMetrobus', d.metrobus)],
      Padding(padding: const EdgeInsets.all(16), child: Text(tr(lang, 'trCredit'), style: Theme.of(context).textTheme.bodySmall)),
    ]);
  }

  Widget _fare(String lang, _Lines d) {
    final list = _line == 'metrobus' ? d.metrobus : d.orange;
    final ids = list.map((s) => s.id).toSet();
    final from = ids.contains(_from) ? _from : null, to = ids.contains(_to) ? _to : null;
    
    final i = list.indexWhere((s) => s.id == from), j = list.indexWhere((s) => s.id == to);
    final count = (i >= 0 && j >= 0) ? (i - j).abs() : 0;
    DropdownMenuItem<String> item(Station s) => DropdownMenuItem(value: s.id, child: Text(s.label(lang), overflow: TextOverflow.ellipsis));
    return ListView(padding: const EdgeInsets.all(16), children: [
      SegmentedButton<String>(
        segments: [
          ButtonSegment(value: 'orangeline', label: Text(tr(lang, 'trOrange'))),
          ButtonSegment(value: 'metrobus', label: Text(tr(lang, 'trMetrobus'))),
        ],
        selected: {_line},
        onSelectionChanged: (s) => setState(() {
          _line = s.first;
          _from = _to = null;
        }),
      ),
      const SizedBox(height: 12),
      DropdownButtonFormField<String>(
        initialValue: from,
        isExpanded: true,
        decoration: InputDecoration(labelText: tr(lang, 'trFrom')),
        items: [for (final s in list) item(s)],
        onChanged: (v) => setState(() => _from = v),
      ),
      const SizedBox(height: 8),
      DropdownButtonFormField<String>(
        initialValue: to,
        isExpanded: true,
        decoration: InputDecoration(labelText: tr(lang, 'trTo')),
        items: [for (final s in list) item(s)],
        onChanged: (v) => setState(() => _to = v),
      ),
      if (list.isNotEmpty)
        LineDiagram(
          stations: list,
          color: _line == 'metrobus' ? const Color(0xFFE11D48) : const Color(0xFFF26A21),
          lang: lang,
          fromId: from,
          toId: to,
          boardLabel: tr(lang, 'diagBoard'),
          alightLabel: tr(lang, 'diagAlight'),
          note: tr(lang, 'diagNote'),
        ),
      SwitchListTile(contentPadding: EdgeInsets.zero, title: Text(tr(lang, 'trStudent')), value: _student, onChanged: (v) => setState(() => _student = v)),
      if (from != null && to != null)
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              count == 0
                  ? tr(lang, 'trSame')
                  : _fill(lang, 'trFareResult', {'n': count, 'min': transitMinutes(_line, count), 'fare': transitFare(_line, count, student: _student)}),
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
        ),
      const SizedBox(height: 8),
      Text(tr(lang, 'trEstimate'), style: Theme.of(context).textTheme.bodySmall),
    ]);
  }
}
