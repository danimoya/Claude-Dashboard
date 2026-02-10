/**
 * Avatar Component
 * Displays user avatar with fallback initials and size variants.
 */

import { clsx } from 'clsx';

interface AvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
} as const;

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={clsx(
          'inline-flex shrink-0 items-center justify-center rounded-full object-cover',
          sizeClasses[size],
          className
        )}
      />
    );
  }

  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground',
        sizeClasses[size],
        className
      )}
      title={name}
    >
      {getInitials(name)}
    </span>
  );
}
