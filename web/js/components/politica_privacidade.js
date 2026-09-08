// Port of lib/pages/components/politica_privacidade/politica_privacidade_widget.dart

import { Container, Column, Row, Padding, InkWell, Icon, Txt, SingleChildScrollView, color } from '../widgets.js';
import { TH, style } from '../theme.js';
import { L } from '../i18n.js';
import { pop } from '../dialog.js';

export function PoliticaPrivacidadeWidget() {
  return Container({
    width: 1110.0,
    height: 602.0,
    color: color(0xFF0051FF),
    borderRadius: 8.0,
    border: '2px solid #FFFFFF',
    child: SingleChildScrollView({
      child: Column({
        mainAxisSize: 'max',
        children: [
          Padding({
            padding: [0.0, 16.0, 16.0, 0.0],
            child: Row({
              mainAxisSize: 'max',
              mainAxisAlignment: 'end',
              children: [
                InkWell({
                  onTap: () => pop(),
                  child: Icon('close', { color: TH.secondaryText, size: 42.0 }),
                }),
              ],
            }),
          }),
          Padding({
            padding: [64.0, 0.0, 64.0, 0.0],
            // SelectionArea: the policy text is selectable in the Dart too.
            child: Txt(L('cxqngi7d') /* Política de Privacidade ... */, {
              ...style('bodyMedium', { fontSize: 23.0, textAlign: 'left' }),
              style: { userSelect: 'text', WebkitUserSelect: 'text' },
            }),
          }),
        ],
      }),
    }),
  });
}
