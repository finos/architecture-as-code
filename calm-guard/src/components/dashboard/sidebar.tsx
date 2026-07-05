'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Network,
  Shield,
  GitBranch,
  AlertTriangle,
  ScanEye,
  ShieldCheck,
  Wrench,
  Crosshair,
  Brain,
  BookOpen,
  Bot,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import {
  useAnalysisStore,
  getAgentStatus,
  AGENT_NAMES,
  AGENT_BOT_PERSONAS,
} from '@/store/analysis-store';
import { CalmUploadZone } from '@/components/calm/calm-upload-zone';

const BOT_ICON_MAP: Record<string, LucideIcon> = {
  'scan-eye': ScanEye,
  'shield-check': ShieldCheck,
  wrench: Wrench,
  crosshair: Crosshair,
  brain: Brain,
  swords: Bot, // Fallback — swords not in lucide, use Bot
};

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
}

const navItems: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Architecture', href: '/dashboard/architecture', icon: Network },
  { label: 'Compliance', href: '/dashboard/compliance', icon: Shield },
  { label: 'Pipeline', href: '/dashboard/pipeline', icon: GitBranch },
  { label: 'Findings', href: '/dashboard/findings', icon: AlertTriangle },
  { label: 'Learning', href: '/dashboard/learning', icon: BookOpen },
  { label: 'Squad', href: '/dashboard/squad', icon: Users },
];

const statusColors = {
  idle: 'bg-slate-600',
  running: 'bg-blue-500 animate-pulse',
  complete: 'bg-emerald-500',
  error: 'bg-red-500',
};

const statusRingColors = {
  idle: 'ring-slate-600/50',
  running: 'ring-blue-500/50',
  complete: 'ring-emerald-500/50',
  error: 'ring-red-500/50',
};

export function Sidebar() {
  const pathname = usePathname();
  const agentEvents = useAnalysisStore((state) => state.agentEvents);
  const activeAgents = useAnalysisStore((state) => state.activeAgents);

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
      {/* Logo */}
      <div className="h-14 flex items-center px-6 border-b border-slate-800">
        <Shield className="h-6 w-6 text-emerald-500 mr-2" />
        <h1 className="text-lg font-bold text-slate-50">CALMGuard</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-slate-800 text-slate-50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>

        <Separator className="my-4 bg-slate-800" />

        {/* Upload CALM file — always accessible from dashboard */}
        <div className="px-3 py-2">
          <h3 className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Upload
          </h3>
          <CalmUploadZone />
        </div>

        <Separator className="my-4 bg-slate-800" />

        {/* Agent Status — Bot Personas */}
        <div className="pt-2">
          <h3 className="px-3 mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Agent Squad
          </h3>
          <div className="space-y-1">
            {AGENT_NAMES.map((name) => {
              const status = getAgentStatus(agentEvents, activeAgents, name);
              const persona = AGENT_BOT_PERSONAS[name];
              const IconComponent = persona ? BOT_ICON_MAP[persona.icon] ?? Bot : Bot;

              return (
                <div
                  key={name}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-md transition-all duration-300',
                    status === 'running' && 'bg-slate-700/60 border border-blue-400/30',
                    status === 'complete' && 'bg-emerald-500/10 border border-emerald-500/20',
                    status === 'error' && 'bg-red-500/10 border border-red-500/20',
                    status === 'idle' && 'border border-transparent'
                  )}
                >
                  {/* Bot avatar with status ring */}
                  <div className={cn(
                    'relative flex items-center justify-center h-7 w-7 rounded-full bg-slate-800 ring-2 transition-all duration-300',
                    statusRingColors[status],
                    status === 'running' && 'animate-pulse'
                  )}>
                    <IconComponent
                      className="h-3.5 w-3.5"
                      style={{ color: persona?.color ?? '#94a3b8' }}
                    />
                    {/* Status dot — bottom-right corner */}
                    <div className={cn(
                      'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900',
                      statusColors[status]
                    )} />
                  </div>

                  {/* Name and role */}
                  <div className="min-w-0">
                    <span className={cn(
                      'text-xs font-medium block truncate transition-colors duration-300',
                      status === 'running' ? 'text-slate-100' : 'text-slate-300'
                    )}>
                      {persona?.botName ?? name}
                    </span>
                    <span className={cn(
                      'text-[10px] block truncate transition-colors duration-300',
                      status === 'running' ? 'text-blue-300/70' : 'text-slate-500'
                    )}>
                      {persona?.role ?? ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800">
        <p className="text-xs text-slate-600 text-center">
          DTCC/FINOS Hackathon 2026
        </p>
      </div>
    </aside>
  );
}
