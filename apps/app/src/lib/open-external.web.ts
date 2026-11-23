/** Window globals injected by the Tauri desktop shell. */
interface TauriInternals {
  invoke(cmd: string, args?: Record<string, unknown>): Promise<unknown>;
}

/**
 * Open a website link or PDF. In the desktop shell it goes to the system browser through the
 * opener plugin (a WebView would otherwise open a bare window); in a browser, a new tab.
 */
export function openExternal(url: string): void {
  const tauri = (window as unknown as { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__;
  if (tauri) {
    void tauri.invoke('plugin:opener|open_url', { url }).catch(() => undefined);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
