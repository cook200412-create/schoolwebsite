import Link from 'next/link';

/** Crest-style monogram + full school name (never truncated, no tagline). */
export function Logo({ name, short, light, href = '/' }: { name: string; short?: string; light?: boolean; href?: string }) {
  const initials = (short ?? name).replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
  return (
    <Link href={href} className="flex items-center gap-3" aria-label={`${name} home`}>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-navy-700 to-navy-900 font-serif text-sm font-bold tracking-wide text-gold-300 shadow-card ring-2 ring-gold-400/80 sm:h-12 sm:w-12 sm:text-base">
        {initials}
      </span>
      <span className={`font-serif text-[15px] font-bold leading-tight sm:text-xl ${light ? 'text-white' : 'text-navy-900'}`}>{name}</span>
    </Link>
  );
}
