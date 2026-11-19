import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../core/geo.dart';
import '../core/incidents.dart';
import '../l10n.dart';
import '../services/api_client.dart';
import '../services/reports_api.dart';
import '../state/app_state.dart';
import 'map_screen.dart' show formatDistance;

const _catKey = {
  'accident': 'catAccident', 'congestion': 'catCongestion', 'closure': 'catClosure', 'construction': 'catConstruction',
  'flooding': 'catFlooding', 'roadblock': 'catRoadblock', 'police_naka': 'catPoliceNaka', 'hazard': 'catHazard',
};
const _catIcon = {
  'accident': Icons.car_crash, 'congestion': Icons.traffic, 'closure': Icons.block, 'construction': Icons.construction,
  'flooding': Icons.water, 'roadblock': Icons.do_not_disturb_on, 'police_naka': Icons.local_police, 'hazard': Icons.warning_amber,
};

String reportErrorKey(Object e, {String fallback = 'roadFail'}) {
  final code = e is ApiError ? e.code : '';
  return code == 'duplicate_report' ? 'roadDup' : code == 'rate_limited' ? 'roadLimit' : fallback;
}

/// Community road reports. Polls every 20 s while this tab is shown, like the web app.
class IncidentsScreen extends StatefulWidget {
  const IncidentsScreen({super.key, required this.app, required this.api, required this.active});
  final AppState app;
  final ReportsApi api;
  final bool active;
  @override
  State<IncidentsScreen> createState() => _IncidentsScreenState();
}

class _IncidentsScreenState extends State<IncidentsScreen> {
  List<Incident>? _items;
  bool _failed = false;
  bool _loading = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _syncTimer();
  }

  @override
  void didUpdateWidget(IncidentsScreen old) {
    super.didUpdateWidget(old);
    if (old.active != widget.active) _syncTimer();
  }

  void _syncTimer() {
    _timer?.cancel();
    _timer = null;
    if (!widget.active) return;
    _load();
    _timer = Timer.periodic(const Duration(seconds: 20), (_) => _load());
  }

  Future<void> _load() async {
    if (_loading) return;
    _loading = true;
    try {
      final list = await widget.api.listIncidents();
      if (mounted) setState(() { _items = list; _failed = false; });
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    } finally {
      _loading = false;
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _note(String key) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr(widget.app.lang, key))));

  Future<void> _act(Incident i, bool confirm) async {
    try {
      await (confirm ? widget.api.confirm(i.id) : widget.api.flag(i.id));
      if (!mounted) return;
      if (confirm) {
        setState(() => _items = [for (final x in _items!) x.id == i.id ? x.copyWith(confirmations: x.confirmations + 1, confirmed: true) : x]);
      } else {
        setState(() => _items = _items!.where((x) => x.id != i.id).toList());
        _note('roadFlagged');
      }
    } catch (e) {
      if (mounted) _note(reportErrorKey(e));
    }
  }

  Future<void> _add() async {
    final here = widget.app.fix?.point;
    if (here == null) return _note('roadNeedGps');
    final sent = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _ReportForm(app: widget.app, api: widget.api, at: here),
    );
    if (sent == true) {
      _note('roadSent');
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = widget.app.lang;
    final here = widget.app.fix?.point;
    final items = _items == null ? null : sortIncidents(_items!, here);
    return Scaffold(
      appBar: AppBar(title: Text(tr(lang, 'roadTitle')), actions: [IconButton(tooltip: tr(lang, 'roadRefresh'), icon: const Icon(Icons.refresh), onPressed: _load)]),
      floatingActionButton: FloatingActionButton.extended(onPressed: _add, icon: const Icon(Icons.add_alert), label: Text(tr(lang, 'roadAdd'))),
      body: Column(children: [
        Padding(padding: const EdgeInsets.fromLTRB(16, 8, 16, 4), child: Text(tr(lang, 'roadSub'), style: Theme.of(context).textTheme.bodySmall)),
        if (_failed) Padding(padding: const EdgeInsets.all(16), child: Text(tr(lang, 'roadOffline'))),
        Expanded(
          child: items == null
              ? (_failed ? const SizedBox.shrink() : const Center(child: CircularProgressIndicator()))
              : items.isEmpty
                  ? Center(child: Text(tr(lang, 'roadEmpty')))
                  : ListView.builder(
                      padding: const EdgeInsets.only(bottom: 88),
                      itemCount: items.length,
                      itemBuilder: (_, k) => _IncidentTile(app: widget.app, i: items[k], from: here, onConfirm: () => _act(items[k], true), onFlag: () => _act(items[k], false)),
                    ),
        ),
      ]),
    );
  }
}

class _IncidentTile extends StatelessWidget {
  const _IncidentTile({required this.app, required this.i, required this.from, required this.onConfirm, required this.onFlag});
  final AppState app;
  final Incident i;
  final LatLng? from;
  final VoidCallback onConfirm, onFlag;

  @override
  Widget build(BuildContext context) {
    final lang = app.lang;
    final mins = DateTime.now().difference(i.createdAt).inMinutes.clamp(0, 100000);
    final bits = <String>[
      tr(lang, _catKey[i.category]!),
      if (i.locationName != null) i.locationName!,
      if (from != null) tr(lang, 'roadAway').replaceAll('{d}', formatDistance(haversineM(from!, i.point), lang)),
      tr(lang, 'roadAgo').replaceAll('{m}', '$mins'),
    ];
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(_catIcon[i.category], size: 20),
            const SizedBox(width: 8),
            Expanded(child: Text(i.title, style: Theme.of(context).textTheme.titleSmall)),
          ]),
          const SizedBox(height: 4),
          Text(bits.join(' · '), style: Theme.of(context).textTheme.bodySmall),
          if (i.description.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text(i.description)),
          if (i.advice != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(i.advice!, style: const TextStyle(fontStyle: FontStyle.italic))),
          const SizedBox(height: 6),
          Text(tr(lang, 'roadCred').replaceAll('{n}', '${i.credibility}').replaceAll('{c}', '${i.confirmations}'), style: Theme.of(context).textTheme.labelSmall),
          const SizedBox(height: 4),
          Wrap(spacing: 8, children: [
            if (i.mine)
              Chip(label: Text(tr(lang, 'roadMine')))
            else if (i.confirmed)
              Chip(label: Text(tr(lang, 'roadConfirmed')))
            else
              FilledButton.tonal(onPressed: onConfirm, child: Text(tr(lang, 'roadConfirm'))),
            if (!i.mine) TextButton(onPressed: onFlag, child: Text(tr(lang, 'roadFlag'))),
          ]),
        ]),
      ),
    );
  }
}

class _ReportForm extends StatefulWidget {
  const _ReportForm({required this.app, required this.api, required this.at});
  final AppState app;
  final ReportsApi api;
  final LatLng at;
  @override
  State<_ReportForm> createState() => _ReportFormState();
}

class _ReportFormState extends State<_ReportForm> {
  String _cat = 'congestion';
  final _title = TextEditingController(), _desc = TextEditingController(), _place = TextEditingController(), _advice = TextEditingController();
  bool _busy = false;
  String? _err;

  @override
  void dispose() {
    _title.dispose();
    _desc.dispose();
    _place.dispose();
    _advice.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (_busy || !validIncidentTitle(_title.text)) return;
    setState(() { _busy = true; _err = null; });
    try {
      await widget.api.submitIncident(category: _cat, title: _title.text, description: _desc.text, locationName: _place.text, advice: _advice.text, at: widget.at);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() { _busy = false; _err = reportErrorKey(e); });
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = widget.app.lang;
    return Directionality(
      textDirection: isRtl(lang) ? TextDirection.rtl : TextDirection.ltr,
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + MediaQuery.of(context).viewInsets.bottom),
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(tr(lang, 'roadWhat'), style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Wrap(spacing: 8, runSpacing: 4, children: [
              for (final c in incidentCategories) ChoiceChip(label: Text(tr(lang, _catKey[c]!)), selected: _cat == c, onSelected: (_) => setState(() => _cat = c)),
            ]),
            TextField(controller: _title, maxLength: 120, decoration: InputDecoration(labelText: tr(lang, 'roadTitleHint')), onChanged: (_) => setState(() {})),
            TextField(controller: _desc, maxLength: 500, decoration: InputDecoration(labelText: tr(lang, 'roadDescHint'))),
            TextField(controller: _place, maxLength: 160, decoration: InputDecoration(labelText: tr(lang, 'roadPlaceHint'))),
            TextField(controller: _advice, maxLength: 300, decoration: InputDecoration(labelText: tr(lang, 'roadAdviceHint'))),
            if (_err != null) Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Text(tr(lang, _err!), style: TextStyle(color: Theme.of(context).colorScheme.error))),
            const SizedBox(height: 8),
            Row(children: [
              TextButton(onPressed: () => Navigator.pop(context, false), child: Text(tr(lang, 'cancel'))),
              const Spacer(),
              FilledButton(onPressed: _busy || !validIncidentTitle(_title.text) ? null : _send, child: Text(tr(lang, 'roadSend'))),
            ]),
          ]),
        ),
      ),
    );
  }
}
