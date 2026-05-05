interface Props {
  type?: 'fighter' | 'org' | 'brand';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const configs = {
  fighter: {
    icon: 'ri-shield-check-fill',
    label: 'Verificado',
    classes: 'bg-green-500/15 text-green-500 border-green-500/30',
    iconColor: 'text-green-500',
    dot: 'bg-green-500',
  },
  org: {
    icon: 'ri-verified-badge-fill',
    label: 'Verificado',
    classes: 'bg-red-500/15 text-red-500 border-red-500/30',
    iconColor: 'text-red-500',
    dot: 'bg-red-500',
  },
  brand: {
    icon: 'ri-vip-crown-fill',
    label: 'Premium',
    classes: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30',
    iconColor: 'text-yellow-500',
    dot: 'bg-yellow-500',
  },
};

const sizes = {
  sm: { badge: 'px-1.5 py-0.5 text-xs gap-1', icon: 'text-xs', standalone: 'text-sm' },
  md: { badge: 'px-2 py-1 text-xs gap-1.5', icon: 'text-sm', standalone: 'text-base' },
  lg: { badge: 'px-3 py-1.5 text-sm gap-2', icon: 'text-base', standalone: 'text-xl' },
};

export default function VerifiedBadge({ type = 'fighter', size = 'md', showLabel = true }: Props) {
  const cfg = configs[type];
  const sz = sizes[size];

  if (!showLabel) {
    return (
      <span title={cfg.label} className={`inline-flex items-center justify-center ${cfg.iconColor}`}>
        <i className={`${cfg.icon} ${sz.standalone}`}></i>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center font-semibold rounded-full border ${cfg.classes} ${sz.badge}`}>
      <i className={`${cfg.icon} ${sz.icon}`}></i>
      {cfg.label}
    </span>
  );
}
