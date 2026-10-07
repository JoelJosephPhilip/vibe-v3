import { BookOpenTextIcon, ClipboardCheckIcon, FileTextIcon, FolderKanbanIcon, MessageSquareTextIcon, PlayCircleIcon, ScaleIcon, type LucideIcon } from 'lucide-react';

import { GeneratedCover } from '@/components/generated-art';
import { cn } from '@/lib/utils';

/** Course cover: deterministic generative art (boring-avatars), seeded by the course id. */
export function CourseCover({ name, seed, className }: { name: string; seed?: string; className?: string }) {
  return <GeneratedCover seed={seed ?? name} title={name} className={className} />;
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
