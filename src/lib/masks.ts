export type MaskKind = 'date' | 'time' | 'phone' | 'digits';

export function applyMask(kind: MaskKind, raw: string): string {
  const digits = raw.replace(/\D/g, '');
  switch (kind) {
    case 'date': {
      const d = digits.slice(0, 8);
      if (d.length <= 2) return d;
      if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
      return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
    }
    case 'time': {
      const d = digits.slice(0, 4);
      if (d.length <= 2) return d;
      return `${d.slice(0, 2)}:${d.slice(2)}`;
    }
    case 'phone': {
      const d = digits.slice(0, 11);
      if (d.length <= 2) return d.length ? `(${d}` : '';
      if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
      if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
      return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    }
    case 'digits':
      return digits;
  }
}
