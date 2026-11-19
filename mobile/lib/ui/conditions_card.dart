import 'package:material_ui/material_ui.dart';

import '../core/conditions.dart';
import '../core/coverage.dart';
import '../l10n.dart';
import '../services/conditions_service.dart';
import '../state/app_state.dart';

String _cap(String k) => k[0].toUpperCase() + k.substring(1);

/// Weather and air quality for a chosen city. The city comes from the user's real fix when it is near one; otherwise the
/// user picks (and the card says no location was used). Nothing is shown unless Open-Meteo answered.
class ConditionsCard extends StatefulWidget {
  const ConditionsCard({super.key, required this.app, this.fetch});
  final AppState app;
  final Fetch? fetch;
  @override
  State<ConditionsCard> createState() => _ConditionsCardState();
}

class _ConditionsCardState extends State<ConditionsCard> {
  String? _city; // null until chosen or derived
  bool _auto = false;
  Conditions? _c;
  bool _loading = false;

  static const _here = 'here';
  bool get _hasLocalFix {
    final f = widget.app.fix?.point;
    return f != null && inPakistan(f);
  }

  @override
  void initState() {
    super.initState();
    // Nearest listed city if there is one within 80 km (sends only that city's centre); otherwise, with a real fix in
    // Pakistan, "my location" rounded to ~10 km; with no fix, Lahore until the user picks.
    final near = nearestCity(widget.app.fix?.point);
    _city = near ?? (_hasLocalFix ? _here : 'lahore');
    _auto = near != null || _city == _here;
    _load();
  }

  Future<void> _load() async {
    final city = _city!;
    final fix = widget.app.fix?.point;
    setState(() { _loading = true; });
    final c = city == _here && fix != null
        ? await fetchConditionsAt(roundedForWeather(fix), fetch: widget.fetch)
        : await fetchConditions(city == _here ? 'lahore' : city, fetch: widget.fetch);
    if (mounted && city == _city) setState(() { _c = c; _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    final lang = widget.app.lang;
    final c = _c;
    final lines = <String>[
      if (c?.tempC != null) '${tr(lang, 'condTemp').replaceAll('{t}', '${c!.tempC}')}${c.condition == null ? '' : ' · ${tr(lang, 'wx${_cap(c.condition!)}')}'}',
      if (c?.rainMm != null) tr(lang, 'condRain').replaceAll('{r}', c!.rainMm!.toStringAsFixed(1)),
      if (c?.rainMm != null) tr(lang, 'condRisk').replaceAll('{risk}', tr(lang, 'risk${_cap(waterloggingRisk(c!.rainMm!))}')),
      if (c?.aqi != null) tr(lang, 'condAqi').replaceAll('{a}', '${c!.aqi}').replaceAll('{band}', tr(lang, 'aqi${_cap(aqiBand(c.aqi!))}')),
      if (c?.pm25 != null) tr(lang, 'condPm25').replaceAll('{p}', '${c!.pm25}'),
    ];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(tr(lang, 'condTitle'), style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            initialValue: _city,
            decoration: InputDecoration(labelText: tr(lang, 'condCity')),
            items: [
              if (_hasLocalFix || _city == _here) DropdownMenuItem(value: _here, child: Text(tr(lang, 'cityHere'))),
              for (final k in cityCentres.keys) DropdownMenuItem(value: k, child: Text(tr(lang, 'city${_cap(k)}'))),
            ],
            onChanged: (v) { if (v != null) { _auto = v == _here; _city = v; _load(); } },
          ),
          const SizedBox(height: 8),
          if (_loading && c == null) const LinearProgressIndicator()
          else if (c == null || c.isEmpty) Text(tr(lang, 'condNone'))
          else for (final l in lines) Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(l)),
          if (!_auto) Text(tr(lang, 'condCityNote'), style: Theme.of(context).textTheme.labelSmall),
          Text(tr(lang, 'condSource'), style: Theme.of(context).textTheme.labelSmall),
        ]),
      ),
    );
  }
}
