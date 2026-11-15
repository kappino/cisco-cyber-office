/** Preserve terminal control sequences; browser-only shortcuts stay in the browser. */
export function consoleKey(key: string, ctrl: boolean, alt: boolean, meta: boolean): string | null {
  if (alt || meta || (key === 'Tab' && !ctrl)) return null;
  if (ctrl && key.length === 1 && /^[a-z]$/i.test(key)) return String.fromCharCode(key.toUpperCase().charCodeAt(0) - 64);
  if (ctrl) return null;
  return ({ Enter: '\r', Backspace: '\x7f', Escape: '\x1b', ArrowUp: '\x1b[A', ArrowDown: '\x1b[B', ArrowRight: '\x1b[C', ArrowLeft: '\x1b[D', Delete: '\x1b[3~', Home: '\x1b[H', End: '\x1b[F' } as Record<string,string>)[key] ?? (key.length === 1 ? key : null);
}
