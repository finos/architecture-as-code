import { Shield, AlertTriangle, Eye } from 'lucide-react';
import type { ControlConfiguration } from '@/types/calm';

interface ControlBadgeProps {
  controlCount: number;
  category?: 'Preventative' | 'Detective' | 'Risk';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ControlBadge({
  controlCount,
  category = 'Preventative',
  size = 'md',
  className = ''
}: ControlBadgeProps) {
  const sizeClasses = {
    sm: 'w-5 h-5 text-[10px]',
    md: 'w-6 h-6 text-xs',
    lg: 'w-8 h-8 text-sm',
  };

  const iconSizes = {
    sm: 10,
    md: 12,
    lg: 16,
  };

  const categoryConfig = {
    Preventative: {
      bgColor: 'bg-green-500',
      textColor: 'text-white',
      icon: Shield,
      label: 'Preventative Control',
    },
    Detective: {
      bgColor: 'bg-blue-500',
      textColor: 'text-white',
      icon: Eye,
      label: 'Detective Control',
    },
    Risk: {
      bgColor: 'bg-yellow-500',
      textColor: 'text-white',
      icon: AlertTriangle,
      label: 'Risk Identifier',
    },
  };

  const config = categoryConfig[category];
  const Icon = config.icon;

  return (
    <div
      className={`${sizeClasses[size]} ${config.bgColor} ${config.textColor} rounded-full flex items-center justify-center font-semibold shadow-md ${className}`}
      title={`${controlCount} ${config.label}${controlCount !== 1 ? 's' : ''}`}
    >
      {controlCount > 0 ? (
        <span>{controlCount}</span>
      ) : (
        <Icon size={iconSizes[size]} />
      )}
    </div>
  );
}

interface ControlCategoryBadgeProps {
  category: 'Preventative' | 'Detective' | 'Risk';
  className?: string;
}

export function ControlCategoryBadge({ category, className = '' }: ControlCategoryBadgeProps) {
  const categoryConfig = {
    Preventative: {
      bgColor: 'bg-green-100 dark:bg-green-900',
      textColor: 'text-green-800 dark:text-green-200',
      borderColor: 'border-green-300 dark:border-green-700',
      icon: Shield,
    },
    Detective: {
      bgColor: 'bg-blue-100 dark:bg-blue-900',
      textColor: 'text-blue-800 dark:text-blue-200',
      borderColor: 'border-blue-300 dark:border-blue-700',
      icon: Eye,
    },
    Risk: {
      bgColor: 'bg-yellow-100 dark:bg-yellow-900',
      textColor: 'text-yellow-800 dark:text-yellow-200',
      borderColor: 'border-yellow-300 dark:border-yellow-700',
      icon: AlertTriangle,
    },
  };

  const config = categoryConfig[category];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor} ${className}`}
    >
      <Icon size={12} />
      {category}
    </span>
  );
}

interface ControlIconProps {
  hasControls: boolean;
  size?: number;
  className?: string;
}

export function ControlIcon({ hasControls, size = 16, className = '' }: ControlIconProps) {
  if (!hasControls) return null;

  return (
    <Shield
      size={size}
      className={`text-green-500 ${className}`}
      title="Has security controls"
    />
  );
}
