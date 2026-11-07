import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { SiteTabBar } from '@/components/site/site-tabbar';
import { getSettings } from '@/lib/site';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <div className="flex min-h-screen flex-col pb-16 xl:pb-0">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">Skip to content</a>
      <SiteHeader s={s} />
      <main id="main" className="flex-1">{children}</main>
      <SiteFooter s={s} />
      <SiteTabBar />
    </div>
  );
}
