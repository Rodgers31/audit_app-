/**
 * /learn/videos — Temporarily disabled (placeholder content).
 * Redirects to the main Learning Hub page.
 *
 * TODO: Re-enable when real video content is ready:
 * 'use client';
 * import ExplainerVideos from '@/components/ExplainerVideos';
 * import PageShell from '@/components/layout/PageShell';
 * export default function VideosPage() {
 *   return (
 *     <PageShell title='Explainer Videos' subtitle='Short animated videos...'>
 *       <ExplainerVideos searchTerm='' />
 *     </PageShell>
 *   );
 * }
 */
import { redirect } from 'next/navigation';

export default function VideosPage() {
  redirect('/learn');
}
