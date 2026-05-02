/**
 * Minimal ANSI → HTML renderer.
 *
 * Handles the SGR (select graphic rendition) escape sequences emitted by
 * `tmux capture-pane -e`: 8/16-color foreground/background, bold, dim,
 * italic, underline, inverse, plus 256-color and 24-bit truecolor variants.
 *
 * Anything we don't understand gets stripped silently. The result is safe
 * to drop into innerHTML — text is HTML-escaped first.
 */

const ESC = /\x1B\[([\d;]*)m/g;

const FG_8: Record<number, string> = {
  30: '#0c0c0c', 31: '#c50f1f', 32: '#13a10e', 33: '#c19c00',
  34: '#0037da', 35: '#881798', 36: '#3a96dd', 37: '#cccccc',
  90: '#767676', 91: '#e74856', 92: '#16c60c', 93: '#f9f1a5',
  94: '#3b78ff', 95: '#b4009e', 96: '#61d6d6', 97: '#f2f2f2',
};

const BG_8: Record<number, string> = {
  40: '#0c0c0c', 41: '#c50f1f', 42: '#13a10e', 43: '#c19c00',
  44: '#0037da', 45: '#881798', 46: '#3a96dd', 47: '#cccccc',
  100: '#767676', 101: '#e74856', 102: '#16c60c', 103: '#f9f1a5',
  104: '#3b78ff', 105: '#b4009e', 106: '#61d6d6', 107: '#f2f2f2',
};

interface Style {
  fg?: string;
  bg?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  inverse?: boolean;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function color256(n: number): string | undefined {
  if (n < 0 || n > 255) return undefined;
  if (n < 16) {
    // Standard 16 — reuse the 8-bit palette
    const map: Record<number, number> = {
      0: 30, 1: 31, 2: 32, 3: 33, 4: 34, 5: 35, 6: 36, 7: 37,
      8: 90, 9: 91, 10: 92, 11: 93, 12: 94, 13: 95, 14: 96, 15: 97,
    };
    return FG_8[map[n]];
  }
  if (n < 232) {
    const i = n - 16;
    const r = Math.floor(i / 36);
    const g = Math.floor((i % 36) / 6);
    const b = i % 6;
    const v = (x: number) => (x === 0 ? 0 : 55 + x * 40);
    return `rgb(${v(r)},${v(g)},${v(b)})`;
  }
  // Greyscale ramp (232..255)
  const v = 8 + (n - 232) * 10;
  return `rgb(${v},${v},${v})`;
}

function applySgr(style: Style, params: number[]): Style {
  if (params.length === 0) params = [0];
  const next = { ...style };
  for (let i = 0; i < params.length; i++) {
    const p = params[i];
    if (p === 0) {
      // Reset
      Object.keys(next).forEach((k) => delete (next as any)[k]);
    } else if (p === 1) next.bold = true;
    else if (p === 2) next.dim = true;
    else if (p === 3) next.italic = true;
    else if (p === 4) next.underline = true;
    else if (p === 7) next.inverse = true;
    else if (p === 22) {
      next.bold = false;
      next.dim = false;
    } else if (p === 23) next.italic = false;
    else if (p === 24) next.underline = false;
    else if (p === 27) next.inverse = false;
    else if (p === 39) delete next.fg;
    else if (p === 49) delete next.bg;
    else if (FG_8[p]) next.fg = FG_8[p];
    else if (BG_8[p]) next.bg = BG_8[p];
    else if (p === 38 || p === 48) {
      const target: 'fg' | 'bg' = p === 38 ? 'fg' : 'bg';
      const mode = params[i + 1];
      if (mode === 5) {
        const c = color256(params[i + 2]);
        if (c) next[target] = c;
        i += 2;
      } else if (mode === 2) {
        const r = params[i + 2] | 0;
        const g = params[i + 3] | 0;
        const b = params[i + 4] | 0;
        next[target] = `rgb(${r},${g},${b})`;
        i += 4;
      }
    }
  }
  return next;
}

function styleToCss(style: Style): string {
  const parts: string[] = [];
  let fg = style.fg;
  let bg = style.bg;
  if (style.inverse) {
    [fg, bg] = [bg ?? '#000', fg ?? '#fff'];
  }
  if (fg) parts.push(`color:${fg}`);
  if (bg) parts.push(`background-color:${bg}`);
  if (style.bold) parts.push('font-weight:600');
  if (style.dim) parts.push('opacity:0.7');
  if (style.italic) parts.push('font-style:italic');
  if (style.underline) parts.push('text-decoration:underline');
  return parts.join(';');
}

export function ansiToHtml(input: string): string {
  if (!input) return '';
  // Strip OSC and other CSI sequences we don't render. Keep only SGR.
  // First strip cursor-move/clear sequences that show up in some apps.
  const cleaned = input
    .replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/g, '') // OSC
    .replace(/\x1B\[\?[\d;]*[hl]/g, '')                 // private mode
    .replace(/\x1B\[[\d;]*[ABCDEFGHJKSTfn]/g, '');     // cursor / clear

  let style: Style = {};
  let out = '';
  let openSpan = false;
  let lastIndex = 0;

  const flushClose = () => {
    if (openSpan) {
      out += '</span>';
      openSpan = false;
    }
  };

  cleaned.replace(ESC, (match, paramStr: string, offset: number) => {
    out += escapeHtml(cleaned.slice(lastIndex, offset));
    lastIndex = offset + match.length;

    const params = paramStr === ''
      ? [0]
      : paramStr.split(';').map((s) => parseInt(s, 10) || 0);

    style = applySgr(style, params);

    flushClose();
    const css = styleToCss(style);
    if (css) {
      out += `<span style="${css}">`;
      openSpan = true;
    }
    return match;
  });

  out += escapeHtml(cleaned.slice(lastIndex));
  flushClose();
  return out;
}
