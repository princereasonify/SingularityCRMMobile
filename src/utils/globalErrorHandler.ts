/**
 * Last line of defence against hard crashes. React error boundaries only catch render errors;
 * a throw inside an event handler, timer or un-awaited promise is a fatal JS exception in a
 * release build and closes the app. We log it and keep the app alive instead — the screen that
 * failed simply doesn't complete its action, which beats losing the user's session.
 * Fatal errors are still forwarded to the previous handler in __DEV__ so the red box shows.
 */
export function installGlobalErrorHandler() {
  // Linking.openURL rejects when nothing can handle the URL (tel: on an iPad/simulator, a
  // malformed link). ~35 call sites don't catch it, so make it non-throwing once, here.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Linking } = require('react-native');
    const orig = Linking.openURL.bind(Linking);
    Linking.openURL = (url: string) =>
      Promise.resolve()
        .then(() => orig(url))
        .catch((e: any) => {
          console.warn('[Linking] could not open', url, e?.message ?? e);
        });
  } catch {}

  const EU = (globalThis as any).ErrorUtils;
  if (EU?.setGlobalHandler) {
    const prev = EU.getGlobalHandler?.();
    EU.setGlobalHandler((error: any, isFatal?: boolean) => {
      console.warn('[GlobalError]', isFatal ? 'fatal' : 'non-fatal', error?.message ?? error);
      if (__DEV__ && prev) prev(error, isFatal);
    });
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tracking = require('promise/setimmediate/rejection-tracking');
    tracking.enable({
      allRejections: true,
      onUnhandled: (_id: number, err: any) => console.warn('[UnhandledRejection]', err?.message ?? err),
      onHandled: () => {},
    });
  } catch {
    // module not present in this RN build — the global handler above still applies
  }
}
