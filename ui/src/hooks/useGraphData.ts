import { useState, useEffect, useCallback, useRef } from 'react';
import type { GraphData } from '@/types/graph';

// Static mode: load from JSON file (for GitHub Pages)
// Server mode: load from API endpoint (default)
const STATIC_MODE = import.meta.env.VITE_STATIC_MODE === 'true';
const GRAPH_DATA_URL = import.meta.env.VITE_GRAPH_DATA_URL || './graph.json';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function useGraphData() {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const isMountedRef = useRef(true);

  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Choose URL based on mode
        const url = STATIC_MODE ? GRAPH_DATA_URL : `${API_BASE}/api/graph`;

        const response = await fetch(url, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const graphData: GraphData = await response.json();
        if (isMountedRef.current) {
          setData(graphData);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to fetch graph data');
          setData(null);
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => controller.abort();
  }, [fetchKey]);

  return { data, loading, error, refetch };
}
