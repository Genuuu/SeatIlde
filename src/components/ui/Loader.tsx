import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  light?: boolean;
}

export function Loader({ size = 'md', className, light = false }: LoaderProps) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className={cn(
          'rounded-full border-transparent border-t-brand-blue',
          light ? 'border-t-brand-green' : 'border-t-brand-blue',
          sizes[size],
          light ? 'border-white/20' : 'border-slate-200 dark:border-slate-800'
        )}
      />
    </div>
  );
}
