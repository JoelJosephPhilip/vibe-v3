import { BookOpenTextIcon, ClipboardCheckIcon, FileTextIcon, FolderKanbanIcon, MessageSquareTextIcon, PlayCircleIcon, ScaleIcon, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

const MINOR_WORDS = new Set(['a', 'an', 'and', 'the', 'of', 'in', 'on', 'to', 'for', 'with']);

/** Deterministic warm gradient per course so cards are recognisable without artwork. */
export function CourseCover({ name, className }: { name: string; className?: string }) {
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const hue = 20 + (hash % 40); // stays within the sunny orange range
  const letters = name
    .replace(/^sample:\s*/i, '')
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !MINOR_WORDS.has(w.toLowerCase()))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  return (
    <div
      aria-hidden
      className={cn('grid place-items-center overflow-hidden rounded-xl', className)}
      style={{ background: `linear-gradient(135deg, oklch(0.86 0.09 ${hue + 40}), oklch(0.68 0.15 ${hue + 30}))` }}
    >
      <span className="font-aleo text-3xl font-semibold text-white/95 drop-shadow-sm">{letters || 'V'}</span>
    </div>
  );
}

export function ProgressBar({ value, className, label }: { value: number; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label ?? 'Progress'}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-1.5 overflow-hidden rounded-full bg-muted', className)}
    >
      <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

const ITEM_TYPES: Record<string, { label: string; icon: LucideIcon }> = {
  VIDEO: { label: 'Video', icon: PlayCircleIcon },
  QUIZ: { label: 'Quiz', icon: ClipboardCheckIcon },
  BLOG: { label: 'Reading', icon: FileTextIcon },
  ARTICLE: { label: 'Reading', icon: FileTextIcon },
  PROJECT: { label: 'Project', icon: FolderKanbanIcon },
  FEEDBACK: { label: 'Feedback', icon: MessageSquareTextIcon },
  REFLECTION: { label: 'Reflection', icon: BookOpenTextIcon },
  CASE_STUDY: { label: 'Case study', icon: ScaleIcon },
};

export function itemTypeMeta(type: string) {
  return ITEM_TYPES[type?.toUpperCase()] ?? { label: 'Lesson', icon: FileTextIcon };
}

export function percentOf(e: { percentCompleted?: number; completedItems?: number; contentCounts?: { totalItems?: number } }) {
  if (typeof e.percentCompleted === 'number') return e.percentCompleted;
  const total = e.contentCounts?.totalItems ?? 0;
  return total ? ((e.completedItems ?? 0) / total) * 100 : 0;
}
