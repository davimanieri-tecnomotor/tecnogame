// Backend switches.
//
// The Dart app wrote every game result into the live Firestore collection
// `usuarios` and sent a WhatsApp message through a production z-api instance.
// Both are wired up in backend.js with the original credentials, but they start
// switched OFF so that opening this port does not touch production data.
//
// Turn `useFirestore` on to get the real shared ranking back (the same project,
// collection and query as the Dart). With it off, results are kept in this
// browser's localStorage and the ranking screens work exactly the same way.

export const CONFIG = {
  /** Read/write the `usuarios` collection in Firestore. */
  useFirestore: false,

  /** POST the "you finished TECNOGAME" WhatsApp message on the end screens. */
  useWhatsApp: false,

  /** The n8n webhook in EnviarMensagemAgenteCall (never called by the UI). */
  useAgentWebhook: false,

  // lib/backend/firebase/firebase_config.dart
  firebaseOptions: {
    apiKey: 'AIzaSyAZTmRXL83WY-KjmtAhsE-ERAdWRkEEKMY',
    authDomain: 'projeto-assis-3qcf6v.firebaseapp.com',
    projectId: 'projeto-assis-3qcf6v',
    storageBucket: 'projeto-assis-3qcf6v.appspot.com',
    messagingSenderId: '269670706726',
    appId: '1:269670706726:web:5bcb2a2dd730efcb91c0e7',
  },

  /**
   * The scanner demo clips still point at the Firebase Storage URLs from the
   * Dart, but that bucket now answers 402 Payment Required, so the clips do not
   * play (they did not in the Flutter build either). Drop the five mp4s into
   * web/assets/videos/scanners/ and set this to true to serve them locally.
   */
  useLocalScannerVideos: false,

  // lib/backend/api_requests/api_calls.dart
  zapApiUrl:
    'https://api.z-api.io/instances/3DF6AF6878FFE0BA1789FA8592F99CB9/token/957757C50A408830EA4E34A1/send-link',
  zapClientToken: 'F6fe8ad64e65d43f38881110afffab493S',
  agentWebhookUrl: 'https://d0ed-200-210-23-242.ngrok-free.app/webhook-test/lutterflow-webhook',
};
