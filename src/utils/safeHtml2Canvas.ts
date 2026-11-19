import html2canvas from "html2canvas-pro";

/**
 * Robust converters from modern CSS Color Module (oklab, oklch, color(srgb))
 * to legacy RGB/RGBA that html2canvas and other canvas engines can parse without error.
 */

export function oklabToRgb(str: string): string {
  const m = str.match(/oklab\(\s*([\d.%+-]+)\s+([\d.%+-]+)\s+([\d.%+-]+)(?:\s*\/\s*([\d.%+-]+))?\s*\)/i);
  if (!m) return str;
  const L = m[1].endsWith("%") ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
  const a = m[2].endsWith("%") ? parseFloat(m[2]) / 100 : parseFloat(m[2]);
  const b = m[3].endsWith("%") ? parseFloat(m[3]) / 100 : parseFloat(m[3]);
  const alpha = m[4] !== undefined ? (m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4])) : 1;

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ * l_ * l_;
  const mVal = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const rLin = +4.0767439362 * l - 3.3077115913 * mVal + 0.2309699292 * s;
  const gLin = -1.2684380046 * l + 2.6097574011 * mVal - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * mVal + 1.7076147010 * s;

  function toSRGB(c: number): number {
    const clamped = Math.max(0, Math.min(1, c));
    return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  }

  const R = Math.round(toSRGB(rLin) * 255);
  const G = Math.round(toSRGB(gLin) * 255);
  const B = Math.round(toSRGB(bLin) * 255);

  return alpha < 1 ? `rgba(${R}, ${G}, ${B}, ${alpha})` : `rgb(${R}, ${G}, ${B})`;
}

export function oklchToRgb(str: string): string {
  const m = str.match(/oklch\(\s*([\d.%+-]+)\s+([\d.%+-]+)\s+([\d.%+-]+)(?:deg)?(?:\s*\/\s*([\d.%+-]+))?\s*\)/i);
  if (!m) return str;
  const L = m[1].endsWith("%") ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
  const C = m[2].endsWith("%") ? parseFloat(m[2]) / 100 : parseFloat(m[2]);
  const H = parseFloat(m[3]);
  const alpha = m[4] !== undefined ? (m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4])) : 1;

  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);
  return oklabToRgb(`oklab(${L} ${a} ${b} / ${alpha})`);
}

export function srgbColorToRgb(str: string): string {
  const m = str.match(/color\(\s*srgb\s+([\d.%+-]+)\s+([\d.%+-]+)\s+([\d.%+-]+)(?:\s*\/\s*([\d.%+-]+))?\s*\)/i);
  if (!m) return str;
  const r = m[1].endsWith("%") ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
  const g = m[2].endsWith("%") ? parseFloat(m[2]) / 100 : parseFloat(m[2]);
  const b = m[3].endsWith("%") ? parseFloat(m[3]) / 100 : parseFloat(m[3]);
  const a = m[4] !== undefined ? (m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4])) : 1;
  const R = Math.round(Math.max(0, Math.min(1, r)) * 255);
  const G = Math.round(Math.max(0, Math.min(1, g)) * 255);
  const B = Math.round(Math.max(0, Math.min(1, b)) * 255);
  return a < 1 ? `rgba(${R}, ${G}, ${B}, ${a})` : `rgb(${R}, ${G}, ${B})`;
}

export function sanitizeCssColors(val: string): string {
  if (!val || typeof val !== "string") return val;
  if (!val.includes("oklab") && !val.includes("oklch") && !val.includes("color(srgb")) {
    return val;
  }
  return val
    .replace(/oklch\([^)]+\)/gi, (m) => oklchToRgb(m))
    .replace(/oklab\([^)]+\)/gi, (m) => oklabToRgb(m))
    .replace(/color\(\s*srgb[^)]+\)/gi, (m) => srgbColorToRgb(m));
}

function wrapStyleDeclaration(style: CSSStyleDeclaration): CSSStyleDeclaration {
  if (!style) return style;
  return new Proxy(style, {
    get(target, prop) {
      if (prop === "getPropertyValue") {
        return (propertyName: string) => {
          try {
            const raw = target.getPropertyValue(propertyName);
            return sanitizeCssColors(raw);
          } catch {
            return "";
          }
        };
      }
      try {
        const raw = (target as any)[prop];
        if (typeof raw === "function") {
          return raw.bind(target);
        }
        if (typeof raw === "string") {
          return sanitizeCssColors(raw);
        }
        return raw;
      } catch {
        return undefined;
      }
    },
  });
}

/**
 * Drop-in wrapper for html2canvas that intercepts all color calculations in both
 * the main window and html2canvas's cloned document iframe, preventing "oklab" and "oklch"
 * parse exceptions in Tailwind CSS v4 or modern WebKit.
 */
export async function safeHtml2Canvas(
  element: HTMLElement,
  options: Parameters<typeof html2canvas>[1] = {}
): Promise<HTMLCanvasElement> {
  const userOnClone = options.onclone;

  // Intercept main window getComputedStyle during html2canvas setup
  const originalMainGetComputedStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = function (el: Element, pseudo?: string | null) {
    const raw = originalMainGetComputedStyle(el, pseudo);
    return wrapStyleDeclaration(raw);
  };

  const enhancedOptions = {
    ...options,
    onclone: (clonedDoc: Document, clonedEl: HTMLElement) => {
      // 1. Hook iframe window's getComputedStyle
      const iframeWin = clonedDoc.defaultView;
      if (iframeWin) {
        const origIframeGCS = iframeWin.getComputedStyle.bind(iframeWin);
        iframeWin.getComputedStyle = function (el: Element, pseudo?: string | null) {
          const raw = origIframeGCS(el, pseudo);
          return wrapStyleDeclaration(raw);
        };
      }

      // 2. Walk cloned elements and sanitize inline style attributes
      try {
        const allElements = clonedDoc.querySelectorAll("*");
        allElements.forEach((node) => {
          if (node instanceof HTMLElement || node instanceof SVGElement) {
            const inlineStyle = node.getAttribute("style");
            if (
              inlineStyle &&
              (inlineStyle.includes("oklab") ||
                inlineStyle.includes("oklch") ||
                inlineStyle.includes("color(srgb"))
            ) {
              node.setAttribute("style", sanitizeCssColors(inlineStyle));
            }
          }
        });
      } catch (err) {
        console.warn("safeHtml2Canvas onclone sanitize warning:", err);
      }

      if (userOnClone) {
        userOnClone(clonedDoc, clonedEl);
      }
    },
  };

  try {
    return await html2canvas(element, enhancedOptions);
  } finally {
    // Always restore the original main window getComputedStyle
    window.getComputedStyle = originalMainGetComputedStyle;
  }
}
