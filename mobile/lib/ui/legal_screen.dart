import 'package:material_ui/material_ui.dart';

import '../l10n.dart';
import '../state/app_state.dart';

/// Plain-language safety notice, privacy and terms. Draft: have a lawyer read it before relying on it.
class LegalScreen extends StatelessWidget {
  const LegalScreen({super.key, required this.app});
  final AppState app;

  static const _tabs = {
    'legalTabNotice': ['legalNotice1', 'legalNotice2', 'legalNotice3'],
    'legalTabPrivacy': ['legalPrivacy1', 'legalPrivacy2', 'legalPrivacy3', 'legalPrivacy4', 'legalPrivacy5'],
    'legalTabTerms': ['legalTerms1', 'legalTerms2', 'legalTerms3', 'legalTerms4'],
  };

  @override
  Widget build(BuildContext context) {
    final lang = app.lang;
    return Directionality(
      textDirection: isRtl(lang) ? TextDirection.rtl : TextDirection.ltr,
      child: DefaultTabController(
        length: _tabs.length,
        child: Scaffold(
          appBar: AppBar(
            title: Text(tr(lang, 'legalTitle')),
            bottom: TabBar(tabs: [for (final k in _tabs.keys) Tab(text: tr(lang, k))]),
          ),
          body: TabBarView(children: [
            for (final keys in _tabs.values)
              ListView(padding: const EdgeInsets.all(16), children: [
                for (final k in keys) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(tr(lang, k), style: Theme.of(context).textTheme.bodyMedium)),
              ]),
          ]),
        ),
      ),
    );
  }
}
