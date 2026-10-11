'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** Encabezado que se vuelve sólido al bajar + parallax en imágenes ([data-parallax]). */
export default function Efectos() {
  const path = usePathname();
  useEffect(() => {
    const top = document.querySelector('.top');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    const tick = () => {
      raf = 0;
      const hayHero = !!document.querySelector('.hero');
      top?.classList.toggle('solido', !hayHero || window.scrollY > 40);
      if (reduce) return;
      const vh = window.innerHeight;
      document.querySelectorAll<HTMLElement>('[data-parallax]').forEach((el) => {
        const box = (el.parentElement || el).getBoundingClientRect();
        if (box.bottom < -200 || box.top > vh + 200) return;
        const vel = parseFloat(el.dataset.parallax || '0.2');
        // -1 cuando entra por abajo, 1 cuando sale por arriba
        const p = (vh / 2 - (box.top + box.height / 2)) / (vh / 2 + box.height / 2);
        el.style.transform = `translate3d(0, ${(p * vel * 100).toFixed(2)}px, 0)` + (el.classList.contains('parallax-img') ? ' scale(1.02)' : '');
      });
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(tick); };
    tick();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); cancelAnimationFrame(raf); };
  }, [path]);
  return null;
}
