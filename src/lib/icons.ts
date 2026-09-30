import {
  Sparkles, BookOpen, Layers, TrendingUp, AlertTriangle, Users, Workflow, Cpu,
  BarChart3, Target, Zap, Heart, Trophy, ShieldAlert, Maximize, ListOrdered,
  SeparatorHorizontal, Columns2, LayoutGrid, GitCommitHorizontal, Table, Quote,
  Image, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Share2, GraduationCap,
  Presentation, Briefcase, BookMarked, type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles, BookOpen, Layers, TrendingUp, AlertTriangle, Users, Workflow, Cpu,
  BarChart3, Target, Zap, Heart, Trophy, ShieldAlert, Maximize, ListOrdered,
  SeparatorHorizontal, Columns2, LayoutGrid, GitCommitHorizontal, Table, Quote,
  Image, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Share2, GraduationCap,
  Presentation, Briefcase, BookMarked,
};

export function getIcon(name?: string): LucideIcon {
  if (!name) return Sparkles;
  return ICON_MAP[name] ?? Sparkles;
}

export const AUDIENCE_ICONS: Record<string, LucideIcon> = {
  school: GraduationCap,
  college: BookOpen,
  teacher: Presentation,
  business: Briefcase,
  investor: TrendingUp,
};
