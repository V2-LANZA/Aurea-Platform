const OPEN_SAFETY_HELP_EVENT = "aurea:open-safety-help";

export function openSafetyHelp() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_SAFETY_HELP_EVENT));
}

export function onOpenSafetyHelp(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const handler = () => callback();
  window.addEventListener(OPEN_SAFETY_HELP_EVENT, handler);
  return () => window.removeEventListener(OPEN_SAFETY_HELP_EVENT, handler);
}
