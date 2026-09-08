// Port of lib/pages/components/nome_ofensivo/nome_ofensivo_widget.dart

import { Container, Column, Row, Padding, InkWell, Icon, Txt, SingleChildScrollView, divide, color } from '../widgets.js';
import { TH, style } from '../theme.js';
import { L } from '../i18n.js';
import { pop } from '../dialog.js';

export function NomeOfensivoWidget() {
  return Container({
    width: 1110.0,
    height: 230.5,
    color: color(0xFF0051FF),
    borderRadius: 8.0,
    border: `2px solid ${'#FFFFFF'}`,
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
          Row({
            mainAxisSize: 'max',
            mainAxisAlignment: 'center',
            children: divide(
              [
                Icon('warning_amber_rounded', { color: TH.primaryText, size: 42.0 }),
                Txt(L('i1llbypm') /* Nome inválido! */, style('bodyMedium', { fontFamily: 'pirulen', fontSize: 32.0 })),
              ],
              16.0
            ),
          }),
          Padding({
            padding: [0.0, 16.0, 0.0, 0.0],
            child: Txt(
              L('frgdp8j7') /* Indentificamos um nome INVÁLIDO... */,
              style('bodyMedium', {
                fontFamily: 'Roboto',
                fontWeight: 300,
                fontSize: 28.0,
                letterSpacing: 2.0,
                textAlign: 'center',
              })
            ),
          }),
        ],
      }),
    }),
  });
}
