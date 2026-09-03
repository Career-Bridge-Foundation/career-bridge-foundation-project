'use client';

import { useState } from 'react';

const TEAL = '#4DC5D2';

type Props = {
  text: string;
  label?: string;
};

// Extracted from the navigator.clipboard.writeText() → setCopied(true) →
// setTimeout(reset) idiom duplicated ad hoc across the codebase (e.g.
// app/portfolio/[slug]/ShareButton.tsx, app/partner/codes/_codes-view.tsx).
// Spec 17 needs four of these per candidate, which earns the extraction.
export function CopyButton({ text, label = 'Copy' }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard permission denied or unavailable — no-op, button stays as-is.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        gap:            '6px',
        fontSize:       '11px',
        fontWeight:     600,
        letterSpacing:  '0.06em',
        textTransform:  'uppercase',
        color:          copied ? '#2e9e6f' : TEAL,
        background:     'transparent',
        border:         `1px solid ${copied ? '#2e9e6f' : TEAL}`,
        borderRadius:   '4px',
        padding:        '6px 12px',
        cursor:         'pointer',
        fontFamily:     'inherit',
        transition:     'color 0.15s ease, border-color 0.15s ease',
      }}
    >
      {copied ? 'Copied!' : label}
    </button>
  );
}
