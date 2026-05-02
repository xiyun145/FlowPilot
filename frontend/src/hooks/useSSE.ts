import { useEffect, useRef, useState, useCallback } from "react";
import type { SSEEvent } from "@/types";

interface UseSSEOptions {
  executionId: string | null;
  enabled?: boolean;
  onEvent?: (event: SSEEvent) => void;
}

interface UseSSEReturn {
  connected: boolean;
  lastEvent: SSEEvent | null;
  disconnect: () => void;
}

export function useSSE({
  executionId,
  enabled = true,
  onEvent,
}: UseSSEOptions): UseSSEReturn {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    if (!executionId || !enabled) {
      disconnect();
      return;
    }

    const eventSource = new EventSource(
      `/api/executions/${executionId}/events`
    );
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnected(true);
    };

    eventSource.onmessage = (event: MessageEvent) => {
      try {
        const sseEvent: SSEEvent = JSON.parse(event.data);
        setLastEvent(sseEvent);
        onEvent?.(sseEvent);
      } catch {
        // ignore parse errors
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
      eventSource.close();
    };

    return () => {
      disconnect();
    };
  }, [executionId, enabled, onEvent, disconnect]);

  return { connected, lastEvent, disconnect };
}
