// Port of lib/main.js's `main()` + the route table from lib/flutter_flow/nav/nav.dart.

import { installStage } from './stage.js';
import { FFAppState } from './state.js';
import { defineRoute, startRouter, go } from './router.js';
import { FFLocalizations, onLanguageChange } from './i18n.js';

import { CadastroWidget } from './pages/cadastro.js';
import { InstrucoesWidget } from './pages/instrucoes.js';
import { TelaVideoTransisaoWidget } from './pages/tela_video_transisao.js';
import { RoletaWidget } from './pages/roleta.js';
import { CarroSleecionadoWidget } from './pages/carro_sleecionado.js';
import { ScannerWidget } from './pages/scanner.js';
import { TelaVideoScannerWidget } from './pages/tela_video_scanner.js';
import { TelaAcaoWidget } from './pages/tela_acao.js';
import { GanhouWidget } from './pages/ganhou.js';
import { PerdeuWidget } from './pages/perdeu.js';

// GoRouter's initialLocation is '/', which builds CadastroWidget - as does the
// errorBuilder, so an unknown path lands on the registration screen too.
const ROUTES = [
  { name: '_initialize', path: '/', builder: CadastroWidget },
  { name: 'roleta', path: '/roleta', builder: RoletaWidget },
  { name: 'telaAcao', path: '/telaAcao', builder: TelaAcaoWidget },
  { name: 'cadastro', path: '/cadastro', builder: CadastroWidget },
  { name: 'scanner', path: '/scanner', builder: ScannerWidget },
  { name: 'Perdeu', path: '/perdeu', builder: PerdeuWidget },
  { name: 'Ganhou', path: '/ganhou', builder: GanhouWidget },
  { name: 'telaVideoTransisao', path: '/telaVideoTransisao', builder: TelaVideoTransisaoWidget },
  { name: 'telaVideoScanner', path: '/telaVideoScanner', builder: TelaVideoScannerWidget },
  { name: 'instrucoes', path: '/instrucoes', builder: InstrucoesWidget },
  { name: 'carroSleecionado', path: '/carro', builder: CarroSleecionadoWidget },
];

function main() {
  // index.html may race the module boot against the classic bundle fallback
  // (see the comment there); whichever arrives first wins.
  if (window.__tecgameBooted) return;
  window.__tecgameBooted = true;

  installStage();

  FFAppState.initializePersistedState();
  document.documentElement.lang = FFLocalizations.languageCode === 'pt' ? 'pt-BR' : FFLocalizations.languageCode;

  for (const route of ROUTES) {
    defineRoute({
      name: route.name,
      path: route.path,
      builder: ({ params }) => route.builder({ params }),
    });
  }

  // MaterialApp rebuilds on setLocale, which re-runs the current page's build.
  onLanguageChange(() => {
    const path = location.hash.slice(1) || '/';
    go(path);
  });

  startRouter();
}

main();
