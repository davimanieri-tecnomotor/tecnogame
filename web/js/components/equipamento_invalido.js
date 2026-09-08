// Port of lib/pages/components/equipamento_invalido/equipamento_invalido_widget.dart

import { Align, Column, Container, Icon, InkWell, Padding, Row, Txt, color, SW, SH } from '../widgets.js';
import { TH, style } from '../theme.js';
import { L } from '../i18n.js';
import { pop } from '../dialog.js';
import { FFButtonWidget } from '../forms.js';

export function EquipamentoInvalidoWidget() {
  return Align({
    alignment: [0.0, 0.0],
    child: Column({
      mainAxisSize: 'max',
      mainAxisAlignment: 'center',
      children: [
        Container({
          width: SW * 0.5,
          height: SH * 0.25,
          color: color(0xD3F05F6A),
          borderRadius: 10.0,
          border: `5px solid ${TH.error}`,
          child: Column({
            mainAxisSize: 'max',
            mainAxisAlignment: 'center',
            children: [
              Padding({
                padding: [16.0, 16.0, 16.0, 0.0],
                child: Row({
                  mainAxisSize: 'max',
                  mainAxisAlignment: 'spaceBetween',
                  children: [
                    Txt(
                      L('at429bys') /* OPS! EQUIPAMENTO INVÁLIDO! */,
                      style('bodyMedium', { fontWeight: 700, fontSize: 30.0 })
                    ),
                    InkWell({
                      onTap: () => pop(),
                      child: Icon('close', { color: TH.primaryText, size: 40.0 }),
                    }),
                  ],
                }),
              }),
              Padding({
                padding: [16.0, 16.0, 16.0, 0.0],
                child: Txt(
                  L('guieoms2') /* O equipamento escolhido não realiza essa função... */,
                  style('bodyMedium', { fontWeight: 300, fontSize: 20.0, textAlign: 'left' })
                ),
              }),
              Padding({
                padding: [0.0, 16.0, 0.0, 0.0],
                child: FFButtonWidget({
                  onPressed: () => pop(),
                  text: L('9ri5a6s3') /* Voltar */,
                  options: {
                    width: 298.9,
                    height: 58.75,
                    padding: [16.0, 0.0, 16.0, 0.0],
                    color: TH.error,
                    textStyle: style('titleSmall', { color: '#FFFFFF', fontSize: 20.0 }),
                    elevation: 0.0,
                    borderRadius: 20.0,
                  },
                }),
              }),
            ],
          }),
        }),
      ],
    }),
  });
}
