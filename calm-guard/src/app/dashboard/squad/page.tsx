'use client';

import {
  ScanEye,
  ShieldCheck,
  Wrench,
  Crosshair,
  Brain,
  Bot,
  FileText,
  ArrowRight,
  ArrowDown,
  Shield,
  Cpu,
  Globe,
  Database,
  Radio,
  Sparkles,
  Zap,
  Target,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface ToolRef { name: string; type: 'sdk' | 'api' | 'runtime' | 'internal' }
interface SkillRef { name: string; file: string; description: string }

interface AgentProfile {
  callsign: string;
  displayName: string;
  icon: LucideIcon;
  color: string;
  tagline: string;
  description: string;
  skills: SkillRef[];
  tools: ToolRef[];
}

const SKILLS: Record<string, SkillRef> = {
  SOX: { name: 'SOX', file: 'skills/SOX.md', description: 'Sarbanes-Oxley — financial reporting controls' },
  'PCI-DSS': { name: 'PCI-DSS', file: 'skills/PCI-DSS.md', description: 'Payment Card Industry Data Security Standard' },
  'FINOS-CCC': { name: 'FINOS-CCC', file: 'skills/FINOS-CCC.md', description: 'FINOS Common Cloud Controls' },
  'NIST-CSF': { name: 'NIST-CSF', file: 'skills/NIST-CSF.md', description: 'NIST Cybersecurity Framework' },
  SOC2: { name: 'SOC2', file: 'skills/SOC2.md', description: 'Service Organization Control 2' },
  'PROTOCOL-SECURITY': { name: 'Protocol Security', file: 'skills/PROTOCOL-SECURITY.md', description: 'Protocol security upgrade paths' },
  'DEVSECOPS-PIPELINE': { name: 'DevSecOps Pipeline', file: 'skills/DEVSECOPS-PIPELINE.md', description: 'CI pipeline generation guidelines' },
};

const HQ: AgentProfile = {
  callsign: 'HQ', displayName: 'Orchestrator', icon: Bot, color: '#94a3b8',
  tagline: 'The brain behind the operation',
  description: 'Coordinates the entire multi-agent pipeline. Dispatches Oracle, launches Phase 1 in parallel, then sequences risk aggregation. Graceful degradation built in.',
  skills: [],
  tools: [{ name: 'Vercel AI SDK', type: 'sdk' }, { name: 'SSE Streaming', type: 'internal' }, { name: 'Agent Registry', type: 'internal' }],
};

const ORACLE: AgentProfile = {
  callsign: 'Oracle', displayName: 'Learning Engine', icon: Brain, color: '#06b6d4',
  tagline: 'Gets smarter with every scan',
  description: 'Runs instant deterministic pre-checks before LLMs fire, then learns new patterns after analysis completes. Auto-promotes patterns to rules at 75%+ confidence. Zero-latency, zero-cost.',
  skills: [],
  tools: [{ name: 'Pattern Extractor', type: 'internal' }, { name: 'Fingerprint Engine', type: 'internal' }, { name: 'Learning Store', type: 'runtime' }, { name: 'Pre-Check Engine', type: 'internal' }],
};

const SCOUT: AgentProfile = {
  callsign: 'Scout', displayName: 'Architecture Analyzer', icon: ScanEye, color: '#3b82f6',
  tagline: 'First eyes on the architecture',
  description: 'Maps system components, traces data flows, identifies trust boundaries and security zones, detects protocol weaknesses.',
  skills: [],
  tools: [{ name: 'Gemini 2.5 Flash', type: 'sdk' }, { name: 'CALM Parser', type: 'internal' }],
};

const RANGER: AgentProfile = {
  callsign: 'Ranger', displayName: 'Compliance Mapper', icon: ShieldCheck, color: '#8b5cf6',
  tagline: 'The most heavily armed agent',
  description: 'Loaded with 5 compliance skill files at runtime. Maps every CALM control to regulatory requirements across 5 frameworks with actionable remediation.',
  skills: [SKILLS.SOX, SKILLS['PCI-DSS'], SKILLS['FINOS-CCC'], SKILLS['NIST-CSF'], SKILLS.SOC2],
  tools: [{ name: 'Gemini 2.5 Flash', type: 'sdk' }, { name: 'Skill Loader', type: 'internal' }],
};

const ARSENAL: AgentProfile = {
  callsign: 'Arsenal', displayName: 'Pipeline Generator', icon: Wrench, color: '#f97316',
  tagline: 'Turns compliance into code',
  description: 'Generates DevSecOps CI pipelines with compliance-first security gates, scanning tool configs, and Terraform IaC matching CALM topology.',
  skills: [SKILLS['DEVSECOPS-PIPELINE']],
  tools: [{ name: 'Gemini 2.5 Flash', type: 'sdk' }, { name: 'GitHub API', type: 'api' }, { name: 'Skill Loader', type: 'internal' }],
};

const SNIPER: AgentProfile = {
  callsign: 'Sniper', displayName: 'Risk Scorer', icon: Crosshair, color: '#ef4444',
  tagline: 'The final verdict',
  description: 'Synthesizes all Phase 1 outputs into a unified risk score (0-100). Generates node-level heat maps and prioritizes findings by severity.',
  skills: [],
  tools: [{ name: 'Gemini 2.5 Flash', type: 'sdk' }],
};

const TOOL_ICONS: Record<string, { icon: LucideIcon; cls: string }> = {
  sdk: { icon: Cpu, cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  api: { icon: Globe, cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  runtime: { icon: Database, cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  internal: { icon: Zap, cls: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
};

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/** Large, icon-first agent card */
function AgentCard({ agent }: { agent: AgentProfile }) {
  return (
    <Card className="bg-slate-800/60 border-slate-700/50 overflow-hidden hover:border-slate-600 transition-all duration-300 group">
      <div className="h-1" style={{ backgroundColor: agent.color }} />

      <div className="p-6 flex flex-col items-center text-center">
        {/* Big icon */}
        <div
          className="flex items-center justify-center h-20 w-20 rounded-2xl ring-2 mb-4 transition-transform duration-300 group-hover:scale-110"
          style={{
            backgroundColor: `${agent.color}12`,
            boxShadow: `0 0 30px ${agent.color}18`,
            // @ts-expect-error CSS custom property
            '--tw-ring-color': `${agent.color}35`,
          }}
        >
          <agent.icon className="h-10 w-10" style={{ color: agent.color }} />
        </div>

        {/* Callsign */}
        <h3 className="text-xl font-bold text-slate-100 tracking-tight">{agent.callsign}</h3>
        <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">{agent.displayName}</p>
        <p className="text-sm text-slate-300 mt-1 italic">&ldquo;{agent.tagline}&rdquo;</p>

        {/* Description */}
        <p className="text-xs text-slate-400 leading-relaxed mt-4 mb-5 max-w-xs">
          {agent.description}
        </p>

        {/* Skills */}
        {agent.skills.length > 0 && (
          <div className="w-full mb-5">
            <p className="text-[10px] font-semibold text-violet-400/70 uppercase tracking-widest mb-2">
              Skills ({agent.skills.length})
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {agent.skills.map((s) => (
                <span
                  key={s.name}
                  className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300 font-medium"
                  title={`${s.file} — ${s.description}`}
                >
                  <FileText className="h-3 w-3 shrink-0" />
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tools */}
        <div className="w-full">
          <p className="text-[10px] font-semibold text-slate-500/70 uppercase tracking-widest mb-2">
            Tools
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {agent.tools.map((t) => {
              const { icon: TIcon, cls } = TOOL_ICONS[t.type];
              return (
                <span key={t.name} className={cn('inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border font-medium', cls)}>
                  <TIcon className="h-3 w-3 shrink-0" />
                  {t.name}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

function SkillCard({ skill }: { skill: SkillRef }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/40 border border-slate-700/40 hover:border-violet-500/25 transition-all">
      <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-violet-500/10 border border-violet-500/25 shrink-0">
        <FileText className="h-5 w-5 text-violet-400" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h4 className="text-sm font-semibold text-slate-200">{skill.name}</h4>
          <span className="text-[10px] text-slate-600 font-mono">{skill.file}</span>
        </div>
        <p className="text-xs text-slate-400">{skill.description}</p>
      </div>
    </div>
  );
}

function PhaseConnector({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-1">
      <div className="flex flex-col items-center gap-0.5 text-slate-600">
        <ArrowDown className="h-4 w-4" />
        <span className="text-[10px] font-semibold uppercase tracking-widest">{label}</span>
        <ArrowDown className="h-4 w-4" />
      </div>
    </div>
  );
}

function PhaseLabel({ icon: Icon, cls, label, subtitle }: { icon: LucideIcon; cls: string; label: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn('flex items-center gap-2 px-4 py-2 rounded-xl border', cls)}>
        <Icon className="h-4 w-4" />
        <span className="text-sm font-bold">{label}</span>
      </div>
      <div className="h-px flex-1 bg-slate-800" />
      <span className="text-xs text-slate-500 shrink-0">{subtitle}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SquadPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-12">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="text-center space-y-3 pt-4">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 mx-auto">
          <Shield className="h-8 w-8 text-emerald-400" />
        </div>
        <h1 className="text-3xl font-bold text-slate-100 tracking-tight">The Squad</h1>
        <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
          6 specialized AI agents with unique tools and{' '}
          <span className="text-violet-400 font-medium">agentic skills</span> loaded at runtime.
          Three execution phases — instant pre-checks, parallel AI analysis, and final risk synthesis.
        </p>
      </div>

      {/* ── Execution Flow ────────────────────────────────────── */}
      <Card className="bg-slate-800/30 border-slate-700/40 px-6 py-8">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest text-center mb-6">
          Mission Execution Flow
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          {/* Phase 0 */}
          <div className="flex items-center gap-2.5">
            <FlowNode icon={Bot} label="HQ" color="#94a3b8" />
            <ArrowRight className="h-4 w-4 text-slate-600" />
            <FlowNode icon={Brain} label="Oracle" color="#06b6d4" badge={<Zap className="h-3 w-3 text-yellow-400" />} />
          </div>

          <ArrowRight className="h-4 w-4 text-slate-600" />

          {/* Phase 1 */}
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-blue-500/5 border border-blue-500/15">
            <FlowNode icon={ScanEye} label="Scout" color="#3b82f6" compact />
            <span className="text-slate-700 font-light">+</span>
            <FlowNode icon={ShieldCheck} label="Ranger" color="#8b5cf6" compact />
            <span className="text-slate-700 font-light">+</span>
            <FlowNode icon={Wrench} label="Arsenal" color="#f97316" compact />
          </div>

          <ArrowRight className="h-4 w-4 text-slate-600" />

          {/* Phase 2 */}
          <FlowNode icon={Crosshair} label="Sniper" color="#ef4444" badge={<Target className="h-3 w-3 text-red-400/60" />} />

          <ArrowRight className="h-4 w-4 text-slate-600" />

          {/* Oracle learns */}
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-500/8 border border-cyan-500/20 border-dashed">
            <Brain className="h-5 w-5 text-cyan-400" />
            <span className="text-sm font-bold text-cyan-300">Oracle</span>
            <RotateCcw className="h-3.5 w-3.5 text-cyan-400/60" />
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-8 mt-6 pt-4 border-t border-slate-800/80">
          <Dot color="bg-cyan-400" label="Phase 0 — Instant Pre-Checks" />
          <Dot color="bg-blue-400" label="Phase 1 — Parallel AI Analysis" />
          <Dot color="bg-red-400" label="Phase 2 — Risk Synthesis" />
          <Dot color="bg-cyan-400" dashed label="Post — Oracle Learns" />
        </div>
      </Card>

      {/* ── Phase 0 ───────────────────────────────────────────── */}
      <section className="space-y-6">
        <PhaseLabel icon={Zap} cls="text-cyan-400 border-cyan-500/25 bg-cyan-500/5" label="Phase 0" subtitle="Instant, no LLM cost" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AgentCard agent={HQ} />
          <AgentCard agent={ORACLE} />
        </div>
      </section>

      <PhaseConnector label="Launch" />

      {/* ── Phase 1 ───────────────────────────────────────────── */}
      <section className="space-y-6">
        <PhaseLabel icon={Radio} cls="text-blue-400 border-blue-500/25 bg-blue-500/5" label="Phase 1" subtitle="3 agents in parallel" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <AgentCard agent={SCOUT} />
          <AgentCard agent={RANGER} />
          <AgentCard agent={ARSENAL} />
        </div>
      </section>

      <PhaseConnector label="Aggregate" />

      {/* ── Phase 2 ───────────────────────────────────────────── */}
      <section className="space-y-6">
        <PhaseLabel icon={Target} cls="text-red-400 border-red-500/25 bg-red-500/5" label="Phase 2" subtitle="Risk synthesis" />
        <div className="max-w-sm mx-auto">
          <AgentCard agent={SNIPER} />
        </div>
      </section>

      <PhaseConnector label="Oracle Learns" />

      {/* ── Oracle Learn step callout ─────────────────────────── */}
      <Card className="bg-cyan-500/5 border-cyan-500/20 border-dashed p-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 shrink-0">
            <Brain className="h-7 w-7 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-cyan-300">Oracle Learns</h3>
              <RotateCcw className="h-4 w-4 text-cyan-400/60" />
            </div>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xl">
              After analysis completes, Oracle extracts structural compliance patterns from results,
              merges them into its persistent pattern library, and auto-promotes recurring patterns
              to deterministic rules. Next scan starts faster — the learning compounds.
            </p>
          </div>
        </div>
      </Card>

      {/* ── Agentic Skills ────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-violet-500/10 border border-violet-500/30 mx-auto mb-3">
            <Sparkles className="h-7 w-7 text-violet-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Agentic Skills</h2>
          <p className="text-sm text-slate-400 max-w-lg mx-auto mt-2 leading-relaxed">
            Markdown knowledge files in <span className="font-mono text-xs text-slate-300">skills/</span> —
            curated compliance expertise injected into agent prompts at runtime.
            Domain knowledge without fine-tuning.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.values(SKILLS).map((skill) => (
            <SkillCard key={skill.name} skill={skill} />
          ))}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function FlowNode({ icon: Icon, label, color, badge, compact }: {
  icon: LucideIcon; label: string; color: string; badge?: React.ReactNode; compact?: boolean;
}) {
  return (
    <div
      className={cn('flex items-center gap-2 rounded-xl border', compact ? 'px-2 py-1' : 'px-3.5 py-2')}
      style={{ borderColor: `${color}30`, backgroundColor: `${color}08` }}
    >
      <Icon className={cn(compact ? 'h-4 w-4' : 'h-5 w-5')} style={{ color }} />
      <span className={cn('font-bold', compact ? 'text-xs' : 'text-sm')} style={{ color }}>{label}</span>
      {badge}
    </div>
  );
}

function Dot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn('h-2 w-2 rounded-full', color, dashed && 'border border-dashed border-cyan-400')} />
      <span className="text-[11px] text-slate-500">{label}</span>
    </div>
  );
}
