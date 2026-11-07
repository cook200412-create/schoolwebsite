import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[.98]',
  {
    variants: {
      variant: {
        primary: 'bg-navy-800 text-white shadow-card hover:bg-navy-700',
        gold: 'bg-gold-400 text-navy-950 shadow-card hover:bg-gold-300',
        outline: 'border border-navy-200 bg-white text-navy-800 hover:bg-navy-50',
        ghost: 'text-navy-800 hover:bg-navy-50',
        light: 'bg-white/10 text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/20',
      },
      size: { sm: 'h-9 px-4', md: 'h-11 px-5', lg: 'h-12 px-7 text-base' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = 'Button';
