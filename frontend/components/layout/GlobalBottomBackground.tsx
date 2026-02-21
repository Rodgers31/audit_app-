'use client';

/**
 * GlobalBottomBackground
 *
 * Fixed bottom-of-viewport Kenyan flag background that appears on every page.
 * Uses position:fixed so it stays pinned as the user scrolls; page content
 * flows over it naturally. A multi-stop gradient blends the image into the
 * neutral gov-sand background above.
 */
export default function GlobalBottomBackground() {
  return (
    <div
      className='fixed bottom-0 left-0 right-0 pointer-events-none'
      style={{ height: '45vh', zIndex: 0 }}
      aria-hidden='true'>
      {/* Kenyan flag image */}
      <img
        src='/kenya_bg_bottom.jpg'
        alt=''
        className='absolute inset-0 w-full h-full object-cover'
        style={{ objectPosition: 'center 75%' }}
        loading='lazy'
        decoding='async'
      />

      {/* Cinematic tint overlay */}
      <div
        className='absolute inset-0'
        style={{
          background: `linear-gradient(180deg,
            rgba(15,26,18,0.60) 0%,
            rgba(15,26,18,0.18) 40%,
            rgba(15,26,18,0.32) 100%
          )`,
        }}
      />

      {/* Top-edge fade: gov-sand → transparent (blends into page content) */}
      <div className='absolute top-0 left-0 right-0 pointer-events-none' style={{ height: '50%' }}>
        <div
          className='absolute inset-0'
          style={{
            background: `linear-gradient(to top,
              transparent 0%,
              rgba(245,240,232,0.07) 15%,
              rgba(245,240,232,0.21) 30%,
              rgba(245,240,232,0.39) 45%,
              rgba(245,240,232,0.61) 60%,
              rgba(245,240,232,0.77) 75%,
              rgba(245,240,232,0.88) 88%,
              rgba(245,240,232,0.94) 100%
            )`,
          }}
        />
      </div>
    </div>
  );
}
