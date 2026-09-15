// showDialog / Navigator.pop, matching the Dart call sites:
//
//   await showDialog(
//     context: context,
//     barrierColor: ...,            // optional
//     builder: (dialogContext) => Dialog(
//       elevation: 0,
//       insetPadding: EdgeInsets.zero,
//       backgroundColor: Colors.transparent,
//       alignment: AlignmentDirectional(0.0, 0.0),
//       child: <widget>,
//     ),
//   );
//
// The await resolves when the dialog is popped, so the code that follows a
// `showDialog` in the Dart runs at the same moment here.

import { el, unfocus } from './widgets.js';

const stack = [];

/**
 * @param {object}   options
 * @param {Function} options.builder  returns the dialog content node
 * @param {string}   [options.barrierColor]
 * @param {boolean}  [options.barrierDismissible] Flutter's default is true
 * @returns {Promise<any>} the value passed to `Navigator.pop(context, value)`
 */
export function showDialog({ builder, barrierColor = null, barrierDismissible = true } = {}) {
  const overlays = document.getElementById('overlays');

  return new Promise((resolve) => {
    const barrier = el('div', { class: 'ff-barrier' });
    if (barrierColor) barrier.style.background = barrierColor;

    const entry = { barrier, resolve, closed: false };

    const dialog = el('div', { class: 'ff-dialog' }, builder(entry));
    barrier.appendChild(dialog);

    if (barrierDismissible) {
      barrier.addEventListener('click', (event) => {
        if (event.target === barrier) pop(undefined, entry);
      });
    }

    stack.push(entry);
    overlays.appendChild(barrier);
    unfocus();
  });
}

/** `Navigator.pop(context)` - closes the topmost dialog. */
export function pop(result, entry = stack[stack.length - 1]) {
  if (!entry || entry.closed) return;
  entry.closed = true;
  const index = stack.indexOf(entry);
  if (index >= 0) stack.splice(index, 1);

  entry.barrier.classList.add('ff-closing');
  let settled = false;
  const done = () => {
    if (settled) return;
    settled = true;
    entry.barrier.remove();
    entry.resolve(result);
  };

  // Only the barrier's and the dialog's own exit animations matter. Waiting on
  // the whole subtree would hang on the looping "pulse" animations that some
  // dialog contents run forever.
  const closing = [entry.barrier, ...entry.barrier.children]
    .flatMap((node) => node.getAnimations())
    .filter((animation) => animation.effect?.getTiming().iterations !== Infinity);

  if (closing.length) {
    Promise.all(closing.map((animation) => animation.finished.catch(() => {}))).then(done);
    // Belt and braces: never let a stalled animation strand the caller.
    setTimeout(done, 400);
  } else {
    setTimeout(done, 75);
  }
}

export function popAllDialogs() {
  while (stack.length) pop(undefined, stack[stack.length - 1]);
}
