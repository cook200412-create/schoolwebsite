'use client';

import { Eye, EyeOff } from 'lucide-react';
import * as React from 'react';
import { Input } from '@/components/ui/kit';
import { cn } from '@/lib/utils';

/** Password field with a small show/hide toggle. Works with react-hook-form's register() via ref forwarding. */
export const PasswordInput = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>>(({ className, ...p }, ref) => {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={show ? 'text' : 'password'} className={cn('pr-11', className)} {...p} />
      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}
        className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-navy-800">
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
});
PasswordInput.displayName = 'PasswordInput';
