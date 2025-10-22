import { useEffect, useId, useRef, useState } from 'react';
import './PaygwGauge.css';

const size = 180;
const strokeWidth = 16;
const radius = (size - strokeWidth) / 2;
const circumference = 2 * Math.PI * radius;

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

type PaygwGaugeProps = {
  value: number;
  label?: string;
};

export function PaygwGauge({ value, label = 'PAYGW compliance' }: PaygwGaugeProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const previousValueRef = useRef(0);
  const gradientId = useId();

  useEffect(() => {
    const target = clampPercent(value);
    const startValue = previousValueRef.current;
    const startTime = performance.now();
    const duration = 900;
    let frame = requestAnimationFrame(function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = startValue + (target - startValue) * eased;
      setDisplayValue(nextValue);
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      } else {
        previousValueRef.current = target;
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [value]);

  useEffect(() => {
    previousValueRef.current = clampPercent(displayValue);
  }, [displayValue]);

  const bounded = clampPercent(displayValue);
  const dashOffset = circumference - (bounded / 100) * circumference;

  return (
    <div className="paygw-gauge" role="img" aria-label={`${label} at ${Math.round(bounded)} percent`}>
      <svg className="paygw-gauge__svg" viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-primary)" />
            <stop offset="100%" stopColor="var(--color-success)" />
          </linearGradient>
        </defs>
        <circle
          className="paygw-gauge__track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className="paygw-gauge__value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          stroke={`url(#${gradientId})`}
        />
      </svg>
      <div className="paygw-gauge__content">
        <span className="paygw-gauge__eyebrow">{label}</span>
        <span className="paygw-gauge__value-label">{Math.round(bounded)}%</span>
      </div>
    </div>
  );
}
