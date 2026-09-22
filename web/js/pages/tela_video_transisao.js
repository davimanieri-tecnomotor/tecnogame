// Port of lib/pages/tela_video_transisao/tela_video_transisao_widget.dart
//
// The Jaspion-scored intro sting. `tipo` decides where it goes after 4s:
//   0 -> cadastro (the restart from the end screens)
//   1 -> roleta   (after the instructions)

import { Container, VideoPlayer, decorationImage, el } from '../widgets.js';
import { TH } from '../theme.js';
import { playSound } from '../audio.js';
import { goNamed } from '../router.js';
import { delayed } from '../anim.js';

export function TelaVideoTransisaoWidget({ params } = {}) {
  const model = {};
  const tipo = params?.tipo != null ? Number.parseInt(params.tipo, 10) : null;
  let left = false;

  const root = el(
    'div',
    { class: 'ff-scaffold', style: { background: TH.primaryBackground } },
    Container({
      width: Infinity,
      height: Infinity,
      color: TH.secondaryBackground,
      image: decorationImage('assets/images/BG_Seleo_Equipamento.png', 'cover'),
      child: VideoPlayer({
        path: 'assets/videos/Intro_1920x1080.mp4',
        autoPlay: true,
        looping: true,
        showControls: false,
      }),
    })
  );

  const next = (name) => goNamed(name);

  playSound(model, 'soundPlayer', 'assets/audios/jaspion-theme_Ho7gr9uE.mp3', 0.5);

  if (tipo === 0) {
    delayed(4000).then(() => {
      if (!left && root.isConnected) next('cadastro');
    });
  }
  if (tipo === 1) {
    delayed(4000).then(() => {
      if (!left && root.isConnected) next('roleta');
    });
  }

  root.__dispose = () => {
    left = true;
    model.soundPlayer?.stop();
  };

  return root;
}
