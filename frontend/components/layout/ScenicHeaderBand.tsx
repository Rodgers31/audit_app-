'use client';

import Image from 'next/image';

/**
 * ScenicHeaderBand
 *
 * Drop-in scenic background for the dark-green page header band. Renders
 * the brand top scenic image (light + dark variants crossfade with the
 * theme) plus a dark tint overlay that keeps title text legible. Used
 * by PageShell and the standalone County / Compare / detail pages so
 * every inner page picks up the same atmospheric look as the home
 * page — the previous flat ``bg-gov-dark`` band felt all-green in
 * dark mode.
 *
 * Place inside any ``relative overflow-hidden bg-gov-dark`` container.
 * Ordered behind decorative gradients but in front of the parent's
 * solid bg fallback (so first paint isn't a flash of cream).
 */
export default function ScenicHeaderBand() {
  return (
    <>
      {/* Scenic image — light variant. */}
      <Image
        src='/kenya_bg_top.jpg'
        alt=''
        fill
        sizes='100vw'
        priority
        className='object-cover opacity-100 dark:opacity-0 transition-opacity duration-500'
        style={{ objectPosition: 'center 35%' }}
      />
      {/* Scenic image — dark variant (night sky). */}
      <Image
        src='/kenya_bg_top_dk.jpg'
        alt=''
        fill
        sizes='100vw'
        priority
        className='object-cover opacity-0 dark:opacity-100 transition-opacity duration-500'
        style={{ objectPosition: 'center 35%' }}
      />
      {/* Tint overlay — keeps title legible over busy parts of the
          scenic. Uses the same ``gov-dark`` base so the band still
          tonally matches the scrolled nav. */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0'
        style={{
          background: `linear-gradient(180deg,
            rgba(15,26,18,0.78) 0%,
            rgba(15,26,18,0.62) 45%,
            rgba(15,26,18,0.74) 100%
          )`,
        }}
      />
    </>
  );
}
