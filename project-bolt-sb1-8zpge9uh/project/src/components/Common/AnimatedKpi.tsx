import React, { useEffect, useState, useRef } from 'react';

interface AnimatedKpiProps {
  value: number | string;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export const AnimatedKpi: React.FC<AnimatedKpiProps> = ({
  value,
  duration = 750,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
}) => {
  // Check if string contains composite values like "14 / 36" or "₹12,400"
  // If value is a string that doesn't parse to a single clean number, we can extract or format it.
  const isCompositeString = typeof value === 'string' && value.includes('/');

  // Numeric parsing
  const numericTarget = typeof value === 'number' 
    ? value 
    : parseFloat(String(value).replace(/[^0-9.-]+/g, '')) || 0;

  const [displayValue, setDisplayValue] = useState<number>(() => {
    // Check reduced motion initially
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return numericTarget;
    }
    return 0;
  });

  const prevTargetRef = useRef<number>(numericTarget);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // If composite string (e.g., "14 / 36"), do not count up as a single float, render string directly
    if (isCompositeString) {
      return;
    }

    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayValue(numericTarget);
      prevTargetRef.current = numericTarget;
      return;
    }

    const startValue = prevTargetRef.current;
    const endValue = numericTarget;
    prevTargetRef.current = numericTarget;

    if (startValue === endValue) {
      setDisplayValue(endValue);
      return;
    }

    const startTime = performance.now();

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic: 1 - pow(1 - progress, 3)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentVal = startValue + (endValue - startValue) * easeOut;

      setDisplayValue(currentVal);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        setDisplayValue(endValue);
      }
    };

    animFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [numericTarget, duration, isCompositeString]);

  if (isCompositeString) {
    return <span className={`animated-kpi ${className}`}>{value}</span>;
  }

  const formattedNumber = displayValue.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={`animated-kpi ${className}`}>
      {prefix}
      {formattedNumber}
      {suffix}
    </span>
  );
};
