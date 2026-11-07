/** Consistent banner at the top of every public inner page. */
export function PageHero({ eyebrow, children, lead }: { eyebrow: string; children: React.ReactNode; lead?: React.ReactNode }) {
  return (
    <div className="relative isolate overflow-hidden bg-gradient-to-br from-navy-900 to-navy-700 text-white">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_90%_-20%,rgba(56,189,248,.25),transparent)]" />
      <div className="container py-12 sm:py-16">
        <span className="eyebrow !text-gold-300 before:!bg-gold-300">{eyebrow}</span>
        <h1 className="text-3xl font-bold !text-white sm:text-5xl">{children}</h1>
        {lead && <p className="mt-3 max-w-2xl text-lg text-navy-100">{lead}</p>}
      </div>
    </div>
  );
}
