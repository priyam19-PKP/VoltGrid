import React, { useState, useEffect, useCallback } from 'react';
import { ArrowUp } from 'lucide-react';

export const BackToTop: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  const checkScrollTop = useCallback(() => {
    // Check both window.scrollY and documentElement.scrollTop
    const currentScroll = window.scrollY || document.documentElement.scrollTop;
    if (!isVisible && currentScroll > 320) {
      setIsVisible(true);
    } else if (isVisible && currentScroll <= 320) {
      setIsVisible(false);
    }
  }, [isVisible]);

  useEffect(() => {
    window.addEventListener('scroll', checkScrollTop, { passive: true });
    return () => window.removeEventListener('scroll', checkScrollTop);
  }, [checkScrollTop]);

  const scrollToTop = () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  };

  if (!isVisible) return null;

  return (
    <button
      type="button"
      className="back-to-top-btn"
      onClick={scrollToTop}
      aria-label="Back to top"
      title="Back to top"
    >
      <ArrowUp size={16} />
    </button>
  );
};
