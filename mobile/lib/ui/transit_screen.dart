import 'package:flutter/services.dart' show rootBundle;
import 'package:material_ui/material_ui.dart';

import '../core/transit.dart';
import '../l10n.dart';
import '../services/reports_api.dart';
import '../services/search_service.dart';
import '../state/app_state.dart';
import 'riders_screen.dart';

class _Lines {
  const _Lines(this.metrobus, this.orange);
  final List<Station> metrobus, orange;
}

Future<_Lines> _load() async => _Lines(
      parseStations(await rootBundle.loadString('assets/osm/metrobus.json')),
      parseStations(await rootBundle.loadString('assets/osm/orangeline.json')),
    );

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
  String? _from, _to;
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
    return ListView(children: [
      Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Text(tr(lang, 'trTapHint'))),
      section('trOrange', d.orange),
      section('trMetrobus', d.metrobus),
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
