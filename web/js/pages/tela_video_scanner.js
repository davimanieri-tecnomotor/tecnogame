// Port of lib/pages/tela_video_scanner/tela_video_scanner_widget.dart
//
// A 14s demo clip of the chosen scanner, then straight into the action screen.
// The clips are the same public Firebase Storage URLs the Dart used.

import { Column, Container, Padding, Stack, StackAlign, Txt, VideoPlayer, color, decorationImage, el } from '../widgets.js';
import { TH, style } from '../theme.js';
import { L } from '../i18n.js';
import { FFAppState } from '../state.js';
import { CONFIG } from '../config.js';
import { goNamed, TransitionInfo, PageTransitionType, Alignment } from '../router.js';
import {
  AnimationInfo,
  AnimationTrigger,
  Curves,
  ScaleEffect,
  animateOnPageLoad,
  delayed,
} from '../anim.js';

const BASE = 'https://firebasestorage.googleapis.com/v0/b/projeto-assis-3qcf6v.appspot.com/o/videoScanners';

const VIDEOS = {
  Td80: `${BASE}%2FTD80.mp4?alt=media&token=65d0550d-7aa6-4cc1-beec-806b1db9b034`,
  Td90: `${BASE}%2FTD90.mp4?alt=media&token=618b753c-dfe1-44b4-a38c-c51f6b43aaa9`,
  'Rasther 3': `${BASE}%2F3S%20(1).mp4?alt=media&token=2223d09b-e65f-4e71-80d2-44f544b47626`,
  RB: `${BASE}%2FRasther%20BOX.mp4?alt=media&token=6a029d9f-0d8f-48bc-a18c-cb9e0865fe5f`,
  RST: `${BASE}%2FRasther%20ST.mp4?alt=media&token=bd84db8d-674c-48c1-8fc0-00556944d16a`,
};

const DEFAULT_VIDEO = VIDEOS['Rasther 3'];

/** Optional local copies - see CONFIG.useLocalScannerVideos in config.js. */
const LOCAL_VIDEOS = {
  Td80: 'assets/videos/scanners/TD80.mp4',
  Td90: 'assets/videos/scanners/TD90.mp4',
  'Rasther 3': 'assets/videos/scanners/3S.mp4',
  RB: 'assets/videos/scanners/RastherBOX.mp4',
  RST: 'assets/videos/scanners/RastherST.mp4',
};

function videoFor(scannerEscolhido) {
  if (CONFIG.useLocalScannerVideos) {
    return LOCAL_VIDEOS[scannerEscolhido] ?? LOCAL_VIDEOS['Rasther 3'];
  }
  return VIDEOS[scannerEscolhido] ?? DEFAULT_VIDEO;
}

export function TelaVideoScannerWidget() {
  let left = false;

  const animationsMap = {
    textOnPageLoadAnimation: new AnimationInfo({
      loop: true,
      reverse: true,
      trigger: AnimationTrigger.onPageLoad,
      effectsBuilder: () => [
        ScaleEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 600.0, begin: [1.0, 1.0], end: [1.02, 1.02] }),
      ],
    }),
  };

  const label = Txt(
    L('islas0rw') /* Vídeo demonstrativo * */,
    style('bodyMedium', { fontFamily: 'pirulen', color: color(0xFFFFBC00), fontSize: 32.0 })
  );
  animateOnPageLoad(label, animationsMap.textOnPageLoadAnimation);

  const root = el(
    'div',
    { class: 'ff-scaffold', style: { background: TH.primaryBackground } },
    Stack({
      children: [
        Container({
          width: Infinity,
          height: Infinity,
          image: decorationImage('assets/images/BG_Seleo_Equipamento.png', 'cover'),
          child: Column({
            mainAxisSize: 'max',
            children: [
              VideoPlayer({
                path: videoFor(FFAppState.scannerEscolhido),
                autoPlay: true,
                looping: true,
                showControls: false,
              }),
            ],
          }),
        }),
        StackAlign({
          alignment: [-1.0, -1.0],
          child: Padding({ padding: [32.0, 32.0, 0.0, 0.0], child: label }),
        }),
      ],
    })
  );

  delayed(14000).then(() => {
    if (left || !root.isConnected) return;
    goNamed('telaAcao', {
      extra: {
        __transition_info__: new TransitionInfo({
          hasTransition: true,
          transitionType: PageTransitionType.scale,
          alignment: Alignment.bottomCenter,
        }),
      },
    });
  });

  root.__dispose = () => {
    left = true;
  };

  return root;
}
