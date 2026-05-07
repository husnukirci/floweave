// Custom node type registry — visual + label specs for each of the 9
// insurance-domain custom node types (PLAN.md §4 CustomNodeType union).
// Looked up by Node.tsx at render time; each spec drives the icon, the
// human-readable label, and a distinct Tailwind colour family so the
// canvas reads at-a-glance.

import {
  AlertTriangle,
  Calculator,
  CheckCircle,
  FileEdit,
  FilePlus,
  Mail,
  ShieldCheck,
  UserPlus,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import type { CustomNodeType } from '@/state/workflow/types';

export interface CustomNodeSpec {
  /** Human-readable label, used for the kind chip and aria-label. */
  label: string;
  /** Lucide icon component, rendered next to the label. */
  icon: LucideIcon;
  /** Tailwind border colour for the node card. */
  borderClass: string;
  /** Tailwind background colour for the node card. */
  bgClass: string;
  /** Tailwind text colour for the label/chip. */
  textClass: string;
  /** Tailwind colour for the icon. */
  iconClass: string;
}

export const CUSTOM_NODE_REGISTRY: Record<CustomNodeType, CustomNodeSpec> = {
  createAccount: {
    label: 'Create Account',
    icon: UserPlus,
    borderClass: 'border-cyan-400',
    bgClass: 'bg-cyan-50',
    textClass: 'text-cyan-900',
    iconClass: 'text-cyan-600',
  },
  createPolicy: {
    label: 'Create Policy',
    icon: FilePlus,
    borderClass: 'border-indigo-400',
    bgClass: 'bg-indigo-50',
    textClass: 'text-indigo-900',
    iconClass: 'text-indigo-600',
  },
  createDocument: {
    label: 'Create Document',
    icon: FileEdit,
    borderClass: 'border-sky-400',
    bgClass: 'bg-sky-50',
    textClass: 'text-sky-900',
    iconClass: 'text-sky-600',
  },
  sendEmail: {
    label: 'Send Email',
    icon: Mail,
    borderClass: 'border-amber-400',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-900',
    iconClass: 'text-amber-600',
  },
  verifyPolicy: {
    label: 'Verify Policy',
    icon: ShieldCheck,
    borderClass: 'border-violet-400',
    bgClass: 'bg-violet-50',
    textClass: 'text-violet-900',
    iconClass: 'text-violet-600',
  },
  assessDamage: {
    label: 'Assess Damage',
    icon: AlertTriangle,
    borderClass: 'border-orange-400',
    bgClass: 'bg-orange-50',
    textClass: 'text-orange-900',
    iconClass: 'text-orange-600',
  },
  calculatePayout: {
    label: 'Calculate Payout',
    icon: Calculator,
    borderClass: 'border-fuchsia-400',
    bgClass: 'bg-fuchsia-50',
    textClass: 'text-fuchsia-900',
    iconClass: 'text-fuchsia-600',
  },
  approveClaim: {
    label: 'Approve Claim',
    icon: CheckCircle,
    borderClass: 'border-lime-400',
    bgClass: 'bg-lime-50',
    textClass: 'text-lime-900',
    iconClass: 'text-lime-600',
  },
  denyClaim: {
    label: 'Deny Claim',
    icon: XCircle,
    borderClass: 'border-pink-400',
    bgClass: 'bg-pink-50',
    textClass: 'text-pink-900',
    iconClass: 'text-pink-600',
  },
};
