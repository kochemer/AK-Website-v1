'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const SECTIONS = [
  { id: 'ecommerce-retail-tech', color: '#4A6741' },
  { id: 'jewellery-industry', color: '#8B6914' },
  { id: 'ai-strategy', color: '#3D5A80' },
  { id: 'luxury-consumer', color: '#722F37' },
] as const;

export default function ScrollProgressBar() {
  type SectionColor = (typeof SECTIONS)[number]['color'];
  const [color, setColor] = useState<SectionColor>(SECTIONS[0].color);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef(0);
  const activeRef = useRef<{ el: HTMLElement; color: SectionColor } | null>(
    null
  );

  const updateActiveSection = useCallback(() => {
    const viewportMid = window.innerHeight / 3;

    for (const section of SECTIONS) {
      const el = document.getElementById(section.id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.top <= viewportMid && rect.bottom > viewportMid) {
        if (activeRef.current?.el !== el) {
          activeRef.current = { el, color: section.color };
          setColor(section.color);
        }
        const sectionProgress = Math.min(
          1,
          Math.max(0, (viewportMid - rect.top) / rect.height)
        );
        setProgress(sectionProgress);
        return;
      }
    }
  }, []);

  useEffect(() => {
    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateActiveSection);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    updateActiveSection();
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [updateActiveSection]);

  return (
    <div
      className="sticky top-[var(--header-h,56px)] z-[29] h-[3px] w-full hidden md:block"
      aria-hidden="true"
    >
      <div
        className="h-full transition-colors duration-300"
        style={{
          width: `${progress * 100}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}
