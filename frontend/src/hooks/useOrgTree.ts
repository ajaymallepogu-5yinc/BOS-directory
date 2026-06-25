import { useEffect, useRef, useState } from "react";
import type { OrgTreeNode } from "../api/types";

export function useOrgTree(fetcher: () => Promise<OrgTreeNode[]>, deps: unknown[]) {
  const [roots, setRoots] = useState<OrgTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stable ref to the last successfully loaded roots.
  // We never wipe this out on re-fetch so the tree stays visible
  // while the next department is loading — eliminates the white flicker.
  const stableRoots = useRef<OrgTreeNode[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    // NOTE: intentionally NOT resetting roots here so the old tree
    // stays rendered during the fetch → no blank / white flash.

    fetcher()
      .then((data) => {
        if (!cancelled) {
          stableRoots.current = data;
          setRoots(data);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not reach the API. Is the backend running?");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Always return the stable roots (last known good data) while loading
  return { roots: loading ? stableRoots.current : roots, loading, error };
}
