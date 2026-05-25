import { useEffect, useRef, useState } from 'react';

export default function AnimatedNumber({ value, duration = 600, formatter }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const fromRef = useRef(0);

  useEffect(() => {
    const target = Number(value) || 0;
    const from = fromRef.current;
    if (from === target) return;

    startRef.current = null;
    cancelAnimationFrame(rafRef.current);

    function step(ts) {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (target - from) * eased;
      setDisplay(Math.round(current));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = target;
      }
    }

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return formatter ? formatter(display) : display;
}
