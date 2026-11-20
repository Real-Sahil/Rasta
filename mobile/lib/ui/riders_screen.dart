import 'package:material_ui/material_ui.dart';

import '../l10n.dart';
import '../services/reports_api.dart';
import '../state/app_state.dart';
import 'incidents_screen.dart' show reportErrorKey;

const _modeKey = {
  'metrobus': 'repModeMetrobus', 'orange_line': 'repModeOrange', 'bus': 'repModeBus', 'van': 'repModeVan',
  'rickshaw': 'repModeRickshaw', 'taxi': 'repModeTaxi', 'ride_hail': 'repModeRideHail',
};
const _cityKey = {
  'lahore': 'cityLahore', 'karachi': 'cityKarachi', 'islamabad': 'cityIslamabad', 'rawalpindi': 'cityRawalpindi', 'multan': 'cityMultan', 'faisalabad': 'cityFaisalabad',
};

String statLine(String lang, TransitStat s) => tr(lang, s.kind == 'fare' ? 'repTypicalFare' : 'repTypicalDelay')
    .replaceAll('{mode}', tr(lang, _modeKey[s.mode]!))
    .replaceAll('{median}', '${s.median}')
    .replaceAll('{lo}', '${s.p25}')
    .replaceAll('{hi}', '${s.p75}')
    .replaceAll('{n}', '${s.n}');

/// Riders report what they paid or how late a service was. Typical values show only when the server has enough
/// independent reports; otherwise we say so (never invented).
class RidersScreen extends StatefulWidget {
  const RidersScreen({super.key, required this.app, required this.api, required this.active, this.embedded = false});
  final AppState app;
  final ReportsApi api;
  final bool active;
  final bool embedded; // inside the Transit tab, which supplies the app bar
  @override
  State<RidersScreen> createState() => _RidersScreenState();
}

class _RidersScreenState extends State<RidersScreen> {
  String _city = 'lahore', _kind = 'fare', _mode = 'rickshaw';
  final _value = TextEditingController();
  List<TransitStat>? _stats;
  String? _msg;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  @override
  void didUpdateWidget(RidersScreen old) {
    super.didUpdateWidget(old);
    if (!old.active && widget.active) _loadStats();
  }

  @override
  void dispose() {
    _value.dispose();
    super.dispose();
  }

  Future<void> _loadStats() async {
    final city = _city;
    try {
      final s = await widget.api.transitStats(city);
      if (mounted && city == _city) setState(() => _stats = s);
    } catch (_) {
      if (mounted && city == _city) setState(() => _stats = null);
    }
  }

  Future<void> _send() async {
    final n = int.tryParse(_value.text.trim());
    if (_busy || !validReportValue(_kind, n)) return;
    setState(() { _busy = true; _msg = null; });
    try {
      await widget.api.sendTransitReport(city: _city, kind: _kind, mode: _mode, value: n!);
      _value.clear();
      if (mounted) setState(() => _msg = 'repThanks');
      _loadStats();
    } catch (e) {
      if (mounted) setState(() => _msg = switch (reportErrorKey(e)) { 'roadDup' => 'repDuplicate', 'roadLimit' => 'repLimit', _ => 'repNoBackend' });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = widget.app.lang;
    final n = int.tryParse(_value.text.trim());
    return Scaffold(
      appBar: widget.embedded ? null : AppBar(title: Text(tr(lang, 'repTitle'))),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        DropdownButtonFormField<String>(
          initialValue: _city,
          decoration: InputDecoration(labelText: tr(lang, 'ridersCity')),
          items: [for (final c in reportCities) DropdownMenuItem(value: c, child: Text(tr(lang, _cityKey[c]!)))],
          onChanged: (v) { if (v != null) { setState(() { _city = v; _stats = null; }); _loadStats(); } },
        ),
        const SizedBox(height: 12),
        if (_stats != null && _stats!.isNotEmpty)
          for (final s in _stats!) Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(statLine(lang, s)))
        else
          Text(tr(lang, 'repNoStats'), style: Theme.of(context).textTheme.bodySmall),
        const Divider(height: 32),
        SegmentedButton<String>(
          segments: [
            ButtonSegment(value: 'fare', label: Text(tr(lang, 'repFare'), overflow: TextOverflow.ellipsis)),
            ButtonSegment(value: 'delay', label: Text(tr(lang, 'repDelay'), overflow: TextOverflow.ellipsis)),
          ],
          selected: {_kind},
          onSelectionChanged: (s) => setState(() => _kind = s.first),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: _mode,
          decoration: InputDecoration(labelText: tr(lang, 'repMode')),
          items: [for (final m in reportModes) DropdownMenuItem(value: m, child: Text(tr(lang, _modeKey[m]!)))],
          onChanged: (v) { if (v != null) setState(() => _mode = v); },
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _value,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(labelText: _kind == 'fare' ? tr(lang, 'currencyRs') : tr(lang, 'min')),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 12),
        FilledButton(onPressed: _busy || !validReportValue(_kind, n) ? null : _send, child: Text(tr(lang, 'repSubmit'))),
        if (_msg != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(tr(lang, _msg!), style: const TextStyle(fontWeight: FontWeight.w600))),
        const SizedBox(height: 12),
        Text(tr(lang, 'repPrivacy'), style: Theme.of(context).textTheme.labelSmall),
      ]),
    );
  }
}
