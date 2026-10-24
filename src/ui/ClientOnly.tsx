import { useSyncExternalStore, type PropsWithChildren } from "react";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

// Browser media objects do not exist during static rendering. Keep the first
// web render identical to the server, then mount the media screen on the client.
export function ClientOnly({ children }: PropsWithChildren) {
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  return mounted ? children : null;
}
