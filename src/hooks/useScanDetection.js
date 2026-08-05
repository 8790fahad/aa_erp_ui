import { useCallback, useEffect, useRef } from "react";

/**
 * Detects USB barcode scanner input (rapid key events ending with Enter).
 * Replaces use-scan-detection (React 16 peer dep) with a React 18–compatible hook.
 */
export default function useScanDetection({
  timeToEvaluate = 100,
  averageWaitTime = 50,
  startCharacter = [],
  endCharacter = [13, 27],
  onComplete,
  onError,
  minLength = 1,
  ignoreIfFocusOn,
  stopPropagation = false,
  preventDefault = false,
  container = typeof document !== "undefined" ? document : null,
}) {
  const buffer = useRef([]);
  const timeout = useRef(null);

  const clearBuffer = () => {
    buffer.current = [];
  };

  const evaluateBuffer = useCallback(() => {
    if (timeout.current) {
      clearTimeout(timeout.current);
      timeout.current = null;
    }

    const entries = buffer.current;
    if (entries.length === 0) return;

    const sum = entries
      .map((entry, index, arr) =>
        index > 0 ? entry.time - arr[index - 1].time : 0,
      )
      .slice(1)
      .reduce((total, delta) => total + delta, 0);

    const avg =
      entries.length > 1 ? sum / (entries.length - 1) : averageWaitTime;
    const code = entries
      .slice(startCharacter.length > 0 ? 1 : 0)
      .map((entry) => entry.char)
      .join("");

    const scannedLength = entries.slice(
      startCharacter.length > 0 ? 1 : 0,
    ).length;

    if (avg <= averageWaitTime && scannedLength >= minLength) {
      onComplete?.(code);
    } else if (avg <= averageWaitTime && onError) {
      onError(code);
    }

    clearBuffer();
  }, [
    averageWaitTime,
    minLength,
    onComplete,
    onError,
    startCharacter.length,
  ]);

  const onKeyDown = useCallback(
    (event) => {
      if (ignoreIfFocusOn && event.currentTarget === ignoreIfFocusOn) {
        return;
      }

      if (endCharacter.includes(event.keyCode)) {
        evaluateBuffer();
      }

      // Only printable single-character keys are part of a barcode. Control
      // keys (Enter, Tab, Shift, arrows, etc.) have multi-char `key` values and
      // must not be buffered — otherwise a lone Enter/navigation keypress looks
      // like a 1-character "incomplete scan" and triggers a false error.
      const isPrintableChar =
        typeof event.key === "string" &&
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey;

      if (
        isPrintableChar &&
        (buffer.current.length > 0 ||
          startCharacter.includes(event.keyCode) ||
          startCharacter.length === 0)
      ) {
        if (timeout.current) clearTimeout(timeout.current);
        timeout.current = setTimeout(evaluateBuffer, timeToEvaluate);
        buffer.current.push({ time: performance.now(), char: event.key });
      }

      if (stopPropagation) event.stopPropagation();
      if (preventDefault) event.preventDefault();
    },
    [
      endCharacter,
      evaluateBuffer,
      ignoreIfFocusOn,
      preventDefault,
      startCharacter,
      stopPropagation,
      timeToEvaluate,
    ],
  );

  useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current);
    },
    [],
  );

  useEffect(() => {
    if (!container?.addEventListener) return undefined;

    container.addEventListener("keydown", onKeyDown);
    return () => container.removeEventListener("keydown", onKeyDown);
  }, [container, onKeyDown]);
}
