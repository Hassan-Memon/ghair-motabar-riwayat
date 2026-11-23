import * as WebBrowser from 'expo-web-browser';

/** Open a website link or PDF: an in-app browser sheet on phones. */
export function openExternal(url: string): void {
  void WebBrowser.openBrowserAsync(url).catch(() => undefined);
}
