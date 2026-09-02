import { useEffect, useState } from "react";
import { Network } from "@capacitor/network";

export function useOnline() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let mounted = true;
    Network.getStatus().then((s) => { if (mounted) setOnline(s.connected); });
    const listener = Network.addListener("networkStatusChange", (status) => {
      if (mounted) setOnline(status.connected);
    });
    return () => {
      mounted = false;
      listener.then((l) => l.remove());
    };
  }, []);

  return online;
}
