import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import { EnquiryForm } from '@/features/admissions/enquiry-form';
import { getSettings } from '@/lib/site';

export const metadata = { title: 'Contact Us' };
export const revalidate = 60;

export default async function ContactPage() {
  const s = await getSettings();
  const rows = [
    { icon: MapPin, label: 'Address', value: s.address, href: undefined },
    { icon: Phone, label: 'Phone', value: s.phone, href: s.phone ? `tel:${s.phone.replace(/\s/g, '')}` : undefined },
    { icon: Mail, label: 'Email', value: s.email, href: s.email ? `mailto:${s.email}` : undefined },
    { icon: Clock, label: 'Office timings', value: s.officeTimings, href: undefined },
  ].filter((r) => r.value);

  return (
    <>
      <section className="bg-gradient-to-br from-navy-900 to-navy-700 py-14 text-white sm:py-16">
        <div className="container"><span className="eyebrow !text-gold-300">Contact</span><h1 className="text-4xl font-bold !text-white sm:text-5xl">Get in touch</h1><p className="mt-3 max-w-xl text-navy-100">Questions about admissions, fees or school life? Send us a message and the school office will reply.</p></div>
      </section>
      <section className="container section">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr]">
          <ul className="grid content-start gap-4">
            {rows.length ? rows.map(({ icon: Icon, label, value, href }) => (
              <li key={label} className="card flex gap-4 !p-5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-600"><Icon size={22} /></span>
                <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>{href ? <a href={href} className="break-words font-medium text-navy-900 hover:underline">{value}</a> : <p className="font-medium text-navy-900">{value}</p>}</div>
              </li>
            )) : <li className="rounded-2xl border border-dashed border-navy-200 p-6 text-sm text-slate-600">Contact details will be added by the school office.</li>}
          </ul>
          <div>
            <h2 className="mb-4 text-2xl font-bold">Send us a message</h2>
            <EnquiryForm />
          </div>
        </div>
      </section>
    </>
  );
}
