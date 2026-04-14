export function createInputController({ onToggleWeapon, onChargeStart, onChargeRelease, canCaptureGameInput }) {
  const keys = { a: false, d: false, w: false, s: false, space: false };

  function isEditableTarget(target) {
    if (!target) return false;
    const tag = target.tagName?.toLowerCase();
    return target.isContentEditable || tag === "input" || tag === "textarea" || tag === "select";
  }

  function onKeyDown(event) {
    const key = event.key.toLowerCase();
    const editable = isEditableTarget(event.target);
    const gameKey = ["a", "d", "w", "s", " ", "control"].includes(key);

    if (editable && key !== "escape") {
      return;
    }

    if (gameKey && canCaptureGameInput()) {
      event.preventDefault();
    }

    if (!canCaptureGameInput()) {
      return;
    }

    if (key === "a") keys.a = true;
    if (key === "d") keys.d = true;
    if (key === "w") keys.w = true;
    if (key === "s") keys.s = true;
    if (key === "control" && !event.repeat) onToggleWeapon();
    if (key === " ") {
      keys.space = true;
      onChargeStart();
    }
  }

  function onKeyUp(event) {
    const key = event.key.toLowerCase();
    if (isEditableTarget(event.target) && key !== " ") {
      return;
    }

    if (key === "a") keys.a = false;
    if (key === "d") keys.d = false;
    if (key === "w") keys.w = false;
    if (key === "s") keys.s = false;
    if (key === " ") {
      keys.space = false;
      onChargeRelease();
    }
  }

  function reset() {
    keys.a = false;
    keys.d = false;
    keys.w = false;
    keys.s = false;
    keys.space = false;
  }

  return { keys, onKeyDown, onKeyUp, reset };
}
