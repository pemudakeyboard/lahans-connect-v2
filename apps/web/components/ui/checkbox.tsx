import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  indeterminate?: boolean;
}

/**
 * Minimal checkbox styled to match the design system (accent color, rounded).
 * `indeterminate` mirrors the HTML property for "some selected" bulk states.
 */
export function Checkbox({ className, indeterminate, ...props }: CheckboxProps) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate ?? false;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className={cn('border-input accent-primary h-4 w-4 cursor-pointer rounded', className)}
      {...props}
    />
  );
}
