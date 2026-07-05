'use client';

import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// OdometerDigit — single rolling digit column
// ---------------------------------------------------------------------------

interface OdometerDigitProps {
  /** Target digit value (0–9) */
  digit: number;
  /** Animation duration in milliseconds */
  duration: number;
}

function OdometerDigit({ digit, duration }: OdometerDigitProps) {
  const [displayDigit, setDisplayDigit] = useState(0);

  useEffect(() => {
    // Small timeout ensures the initial render at 0 is visible before animating
    const timeout = setTimeout(() => {
      setDisplayDigit(digit);
    }, 16);
    return () => clearTimeout(timeout);
  }, [digit]);

  return (
    <div className="relative overflow-hidden" style={{ height: '1em', width: '0.6em' }}>
      {/* Column of all 10 digits — translateY positions the target digit into view */}
      <div
        style={{
          transform: `translateY(-${displayDigit * 10}%)`,
          transition: `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
          height: '1000%', // 10 digits × 10% each = 100% visible area
        }}
      >
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            style={{ height: '10%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            className="tabular-nums"
          >
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OdometerScore — exported component
// ---------------------------------------------------------------------------

interface OdometerScoreProps {
  /** Compliance score (0–100) */
  score: number;
  className?: string;
}

export function OdometerScore({ score, className }: OdometerScoreProps) {
  // Clamp score to 0–100
  const clamped = Math.max(0, Math.min(100, Math.round(score)));

  const hundreds = Math.floor(clamped / 100); // 1 only when score === 100
  const tens = Math.floor((clamped % 100) / 10);
  const ones = clamped % 10;

  return (
    <div
      className={`flex tabular-nums ${className ?? ''}`}
      aria-label={`${clamped} out of 100`}
    >
      {/* Hundreds digit — only visible when score === 100 */}
      {clamped === 100 && (
        <OdometerDigit digit={hundreds} duration={2400} />
      )}
      {/* Tens digit */}
      <OdometerDigit digit={tens} duration={1800} />
      {/* Ones digit — fastest, spins like a slot machine */}
      <OdometerDigit digit={ones} duration={1200} />
    </div>
  );
}
