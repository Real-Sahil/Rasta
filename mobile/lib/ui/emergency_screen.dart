import 'package:flutter/services.dart' show rootBundle;
import 'package:material_ui/material_ui.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/emergency.dart';
import '../core/places.dart';
import '../core/coverage.dart';
import '../core/geo.dart';
import '../l10n.dart';
import '../services/nearby_service.dart';
import '../services/search_service.dart' show Place;
import '../state/app_state.dart';
import 'map_screen.dart' show formatDistance;

class _Data {
  const _Data(this.hospitals, this.fuel);
  final PoiFile hospitals, fuel;
}

Future<_Data> _load() async => _Data(parsePoiFile(await rootBundle.loadString('assets/osm/hospitals.json')), parsePoiFile(await rootBundle.loadString('assets/osm/fuel.json')));

/// What the list shows: live places near a real fix, or the bundled Lahore extract.
class _Shown {
  const _Shown(this.items, {required this.live, this.fetchedAt, this.fellBack = false});
  final List<Poi> items;
  final bool live, fellBack; // fellBack: the server couldn't answer, so these are the bundled Lahore places
  final String? fetchedAt;
}

class EmergencyScreen extends StatefulWidget {
  const EmergencyScreen({super.key, required this.app, this.nearby, this.onRouteTo});
  final AppState app;
  final VoidCallback? onRouteTo; // switch to the map once a destination is set
  final NearbyService? nearby;
  @override
  State<EmergencyScreen> createState() => _EmergencyScreenState();
}

class _EmergencyScreenState extends State<EmergencyScreen> {
  late final Future<_Data> _data = _load();
  late final NearbyService _nearby = widget.nearby ?? NearbyService();
  bool _hospitals = true;
  String? _shownKey;
  Future<_Shown>? _shown;

  Future<_Shown> _resolve(String kind, LatLng? here) async {
    final d = await _data;
    final bundled = kind == 'fuel' ? d.fuel : d.hospitals;
    if (here != null && inPakistan(here)) {
      final live = await _nearby.nearby(kind, here);
      if (live != null) return _Shown(live, live: true);
      return _Shown(bundled.items, live: false, fetchedAt: bundled.fetchedAt, fellBack: true);
    }
    return _Shown(bundled.items, live: false, fetchedAt: bundled.fetchedAt);
  }

  Future<_Shown> _shownFor(String kind, LatLng? here) {
    // Re-query only when the kind changes or the fix moves to another ~1 km cell, not on every GPS update.
    final key = here == null ? '$kind|none' : NearbyService.roundedKey(kind, here);
    if (key != _shownKey || _shown == null) {
      _shownKey = key;
      _shown = _resolve(kind, here);
    }
    return _shown!;
  }

  /// Directions to a hospital or fuel station: the list used to be read-only, which left people copying names into search.
  Future<void> _routeTo(Poi p) async {
    widget.onRouteTo?.call();
    await widget.app.setDestination(Place(id: 'poi-${p.id}', name: p.label(widget.app.lang), detail: p.address ?? '', point: p.point));
  }

  void _note(String key) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr(widget.app.lang, key))));

  Future<void> _call(String number) async {
    final ok = await launchUrl(Uri(scheme: 'tel', path: number)).catchError((_) => false);
    if (!ok && mounted) _note('sosOpenFail');
  }

  Future<void> _sos() async {
    final here = widget.app.fix?.point;
    if (here == null) return _note('sosNoFix');
    final text = sosText(here, widget.app.lang);
    final ok = await launchUrl(whatsappUri(text), mode: LaunchMode.externalApplication).catchError((_) => false);
    if (!ok) await SharePlus.instance.share(ShareParams(text: text)); // no WhatsApp: the system share sheet
  }

  @override
  Widget build(BuildContext context) {
    final app = widget.app;
    final lang = app.lang;
    final rtl = lang != 'en';
    final here = app.fix?.point;
    return Scaffold(
      appBar: AppBar(title: Text(tr(lang, 'sosTitle'))),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Text(tr(lang, 'sosSub'), style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 12),
        FilledButton.icon(
          style: FilledButton.styleFrom(backgroundColor: const Color(0xFF059669)),
          onPressed: _sos,
          icon: const Icon(Icons.share_location),
          label: Text(tr(lang, 'sosWhatsapp')),
        ),
        const SizedBox(height: 12),
        for (final c in emergencyContacts)
          Card(
            color: const Color(0xFFFFF1F2),
            child: ListTile(
              title: Text(rtl ? c.titleUr : c.titleEn, style: const TextStyle(color: Colors.black87, fontWeight: FontWeight.w700)),
              subtitle: Text(rtl ? c.descUr : c.descEn, style: const TextStyle(color: Colors.black54)),
              trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                Text(c.number, style: const TextStyle(color: Color(0xFFBE123C), fontSize: 22, fontWeight: FontWeight.w900)),
                const SizedBox(width: 6),
                const Icon(Icons.call, color: Color(0xFFBE123C)),
              ]),
              onTap: () => _call(c.number),
            ),
          ),
        const Divider(height: 32),
        Row(children: [
          Expanded(child: Text(tr(lang, 'sosNearby'), style: Theme.of(context).textTheme.titleSmall)),
          ChoiceChip(label: Text(tr(lang, 'sosHospitals')), selected: _hospitals, onSelected: (_) => setState(() => _hospitals = true)),
          const SizedBox(width: 6),
          ChoiceChip(label: Text(tr(lang, 'sosFuel')), selected: !_hospitals, onSelected: (_) => setState(() => _hospitals = false)),
        ]),
        FutureBuilder<_Shown>(
          future: _shownFor(_hospitals ? 'hospital' : 'fuel', here),
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) return const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator()));
            final shown = snap.data;
            final live = shown?.live ?? false;
            final list = shown == null ? <NearPoi>[] : nearest(shown.items, here);
            final warn = TextStyle(color: Theme.of(context).colorScheme.error);
            return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (shown?.fellBack == true) Padding(padding: const EdgeInsets.only(top: 8), child: Text(tr(lang, 'sosLiveFail'), style: warn)),
              if (!live && outsideCoverage(here)) Padding(padding: const EdgeInsets.only(top: 8), child: Text(tr(lang, 'sosCoverage'), style: warn)),
              if (list.isEmpty) Padding(padding: const EdgeInsets.all(16), child: Text(tr(lang, live ? 'sosNoneNear' : 'sosNoData'))),
              for (final n in list)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(n.poi.kind == 'fuel' ? Icons.local_gas_station : Icons.local_hospital, color: n.poi.kind == 'fuel' ? Colors.green : Colors.red),
                  title: Text(n.poi.label(lang), maxLines: 2, overflow: TextOverflow.ellipsis),
                  subtitle: Text([
                    if (n.distanceM != null) formatDistance(n.distanceM!, lang),
                    if (n.poi.address != null) n.poi.address!,
                    if (n.poi.emergency == true) tr(lang, 'sosEmergency'),
                    if (n.poi.open24h == true) tr(lang, 'sos24'),
                  ].join(' · ')),
                  trailing: n.poi.phone == null ? const Icon(Icons.directions) : TextButton.icon(onPressed: () => _call(n.poi.phone!), icon: const Icon(Icons.call, size: 16), label: Text(tr(lang, 'sosCall'))),
                  onTap: () => _routeTo(n.poi),
                ),
              const SizedBox(height: 8),
              Text(
                live ? '$osmCredit, via Geoapify. ${tr(lang, 'sosCredit')}' : '$osmCredit${shown?.fetchedAt == null ? '' : ', ${shown!.fetchedAt}'}. ${tr(lang, 'sosCredit')}',
                style: Theme.of(context).textTheme.labelSmall,
              ),
            ]);
          },
        ),
      ]),
    );
  }
}
