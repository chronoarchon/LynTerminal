import { useEffect, useRef } from "react";
import type { Item } from "../types";

export interface BarcodeKeystrokeEvent {
  key: string;
  timestamp: number;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}

export interface BarcodeScannerState {
  buffer: string;
  lastTimestamp: number;
  fastCount: number;
}

export function createScannerState(): BarcodeScannerState {
  return { buffer: "", lastTimestamp: 0, fastCount: 0 };
}

/**
 * Pure state machine for universal HID keyboard-wedge barcode scanner capture.
 * Detects rapid keystroke bursts (< maxIntervalMs between keys) ending in Enter or Tab.
 */
export function processBarcodeKeystroke(
  state: BarcodeScannerState,
  event: BarcodeKeystrokeEvent,
  options: { maxIntervalMs?: number; minLength?: number } = {}
): { nextState: BarcodeScannerState; scannedCode: string | null; isBurstActive: boolean } {
  const maxIntervalMs = options.maxIntervalMs ?? 50;
  const minLength = options.minLength ?? 3;

  if (event.ctrlKey || event.altKey || event.metaKey) {
    return { nextState: state, scannedCode: null, isBurstActive: false };
  }

  if (event.key === "Enter" || event.key === "Tab") {
    const withinWindow =
      state.lastTimestamp > 0 && event.timestamp - state.lastTimestamp <= maxIntervalMs * 2;
    const isBurst = state.buffer.length >= minLength && state.fastCount >= minLength - 1 && withinWindow;
    const scannedCode = isBurst ? state.buffer.trim() : null;
    return {
      nextState: createScannerState(),
      scannedCode,
      isBurstActive: isBurst,
    };
  }

  if (event.key.length === 1) {
    const delta = state.lastTimestamp > 0 ? event.timestamp - state.lastTimestamp : Infinity;
    if (delta <= maxIntervalMs) {
      const nextBuffer = state.buffer + event.key;
      const nextFast = state.fastCount + 1;
      return {
        nextState: {
          buffer: nextBuffer,
          lastTimestamp: event.timestamp,
          fastCount: nextFast,
        },
        scannedCode: null,
        isBurstActive: nextFast >= 2,
      };
    }
    return {
      nextState: {
        buffer: event.key,
        lastTimestamp: event.timestamp,
        fastCount: 0,
      },
      scannedCode: null,
      isBurstActive: false,
    };
  }

  if (event.key === "Escape") {
    return { nextState: createScannerState(), scannedCode: null, isBurstActive: false };
  }

  return { nextState: state, scannedCode: null, isBurstActive: false };
}

/**
 * Case-insensitive exact barcode or SKU match for POS & Inventory scan-to-add.
 */
export function findItemByBarcodeOrSku<T extends Pick<Item, "barcode" | "sku">>(
  items: T[],
  rawCode: string
): T | undefined {
  const code = rawCode.trim().toLowerCase();
  if (!code) return undefined;
  return (
    items.find((i) => i.barcode && i.barcode.trim().toLowerCase() === code) ||
    items.find((i) => i.sku && i.sku.trim().toLowerCase() === code)
  );
}

/**
 * Plays a short non-blocking WebAudio beep on successful/failed scan.
 */
export function playScanFeedbackTone(success: boolean): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = success ? "sine" : "sawtooth";
    osc.frequency.setValueAtTime(success ? 1320 : 320, ctx.currentTime);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (success ? 0.08 : 0.16));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (success ? 0.09 : 0.17));
  } catch {
    // Ignore audio errors in headless/restricted contexts
  }
}

interface UseBarcodeScannerOptions {
  enabled?: boolean;
  onScan: (code: string) => void;
  maxIntervalMs?: number;
  minLength?: number;
}

export function useBarcodeScanner({
  enabled = true,
  onScan,
  maxIntervalMs = 50,
  minLength = 3,
}: UseBarcodeScannerOptions): void {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    let state = createScannerState();
    let capturedBeforeBurst: { el: HTMLInputElement; value: string } | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isBarcodeBox = target?.dataset?.barcodeInput === "true";
      const isTextField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;

      // Capture value before a potential burst inside an unrelated input so we can restore it
      if (target instanceof HTMLInputElement && !isBarcodeBox && state.fastCount === 0 && e.key.length === 1) {
        capturedBeforeBurst = { el: target, value: target.value };
      }

      const result = processBarcodeKeystroke(
        state,
        {
          key: e.key,
          timestamp: e.timeStamp || performance.now(),
          ctrlKey: e.ctrlKey,
          altKey: e.altKey,
          metaKey: e.metaKey,
        },
        { maxIntervalMs, minLength }
      );
      state = result.nextState;

      // If focus is inside the dedicated barcode input box, let the box's Enter handler handle it
      // unless a fast burst ended with Tab (prevent focus jump)
      if (isBarcodeBox) {
        if (result.scannedCode && e.key === "Tab") {
          e.preventDefault();
          onScanRef.current(result.scannedCode);
        }
        return;
      }

      if (result.scannedCode) {
        // Only hijack Enter/Tab inside normal text/number inputs when an unmistakable scanner burst was detected
        if (!isTextField || result.isBurstActive) {
          e.preventDefault();
          e.stopPropagation();
          if (capturedBeforeBurst && capturedBeforeBurst.el === target && target instanceof HTMLInputElement) {
            const nativeSetter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype,
              "value"
            )?.set;
            if (nativeSetter) {
              nativeSetter.call(target, capturedBeforeBurst.value);
            } else {
              target.value = capturedBeforeBurst.value;
            }
            target.dispatchEvent(new Event("input", { bubbles: true }));
          }
          capturedBeforeBurst = null;
          onScanRef.current(result.scannedCode);
        }
      } else if (state.fastCount === 0) {
        capturedBeforeBurst = null;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [enabled, maxIntervalMs, minLength]);
}
