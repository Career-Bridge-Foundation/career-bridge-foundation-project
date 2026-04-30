type Props = {
  band: string;
  size?: 'sm' | 'md';
};

type ChipStyle = {
  background: string;
  color: string;
  border: string;
  fontWeight: number;
};

const CHIP_STYLES: Record<string, ChipStyle> = {
  'Distinction': {
    background: '#1C1917',
    color:      '#FBBF24',
    border:     '1px solid #FBBF24',
    fontWeight: 700,
  },
  'Merit': {
    background: '#003359',
    color:      '#ffffff',
    border:     '1px solid #003359',
    fontWeight: 600,
  },
  'Pass': {
    background: '#006FAD',
    color:      '#ffffff',
    border:     '1px solid #006FAD',
    fontWeight: 600,
  },
  'Borderline': {
    background: '#6B7280',
    color:      '#ffffff',
    border:     '1px solid #6B7280',
    fontWeight: 500,
  },
  'Did Not Pass': {
    background: 'transparent',
    color:      '#9CA3AF',
    border:     '1px solid #9CA3AF',
    fontWeight: 500,
  },
};

const FALLBACK: ChipStyle = {
  background: 'transparent',
  color:      '#9CA3AF',
  border:     '1px solid #9CA3AF',
  fontWeight: 500,
};

export function VerdictChip({ band, size = 'md' }: Props) {
  const s = CHIP_STYLES[band] ?? FALLBACK;
  const isSm = size === 'sm';

  return (
    <span
      style={{
        display:       'inline-block',
        background:    s.background,
        color:         s.color,
        border:        s.border,
        fontWeight:    s.fontWeight,
        fontSize:      isSm ? '10px' : '11px',
        letterSpacing: '0.08em',
        padding:       isSm ? '2px 8px' : '3px 10px',
        borderRadius:  '3px',
        whiteSpace:    'nowrap',
        textTransform: 'uppercase',
      }}
    >
      {band}
    </span>
  );
}
