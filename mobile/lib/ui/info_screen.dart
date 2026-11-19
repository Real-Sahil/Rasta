import 'package:material_ui/material_ui.dart';

import '../l10n.dart';
import '../state/app_state.dart';
import 'legal_screen.dart';

class InfoScreen extends StatelessWidget {
  const InfoScreen({super.key, required this.app});
  final AppState app;

  @override
  Widget build(BuildContext context) {
    final lang = app.lang;
    return Scaffold(
      appBar: AppBar(title: Text(tr(lang, 'navInfo'))),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Text(tr(lang, 'infoLang'), style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        Wrap(spacing: 8, children: [
          for (final l in supportedLangs)
            ChoiceChip(label: Text(l == 'en' ? 'English' : (l == 'ur' ? 'اردو' : 'پنجابی')), selected: lang == l, onSelected: (_) => app.setLang(l)),
        ]),
        const SizedBox(height: 8),
        if (lang != 'en') Text(tr(lang, 'draft'), style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 16),
        ListTile(
          leading: const Icon(Icons.shield_outlined),
          title: Text(tr(lang, 'infoLegal')),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => LegalScreen(app: app))),
        ),
        const Divider(),
        const SizedBox(height: 8),
        Text(tr(lang, 'infoCredit'), style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 8),
        Text(tr(lang, 'infoVersion'), style: Theme.of(context).textTheme.bodySmall),
      ]),
    );
  }
}
