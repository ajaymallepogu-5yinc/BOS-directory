import { useEffect, useState } from "react";
import type { OrgTreeNode } from "../api/types";

export function useOrgTree(fetcher: () => Promise<OrgTreeNode[]>, deps: unknown[]) {
  const [roots, setRoots] = useState<OrgTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetcher()
      .then((data) => {
        if (!cancelled) setRoots(data);
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

  return { roots, loading, error };
}
