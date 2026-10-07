import { useQuery } from '@tanstack/react-query';
import { unwrap } from '@vibe/api';

import { api } from '@/lib/api';

/**
 * Shapes below follow what the backend actually returns (captured in
 * src/test/fixtures). Where the OpenAPI spec is incomplete — e.g. the
 * enrollment list adds percentCompleted/completedItems in its aggregation —
 * these local types are the source of truth for the UI.
 */
export interface EnrollmentSummary {
  _id: string;
  courseId: string;
  courseVersionId: string;
  role: string;
  status: 'ACTIVE' | 'INACTIVE';
  enrollmentDate: string;
  course: { name: string; description?: string; updatedAt?: string };
  percentCompleted?: number;
  completedItems?: number;
  contentCounts?: { totalItems?: number };
  cohortId?: string | null;
  cohortName?: string | null;
  hasNewItemsAfterCompletion?: boolean;
}

export interface EnrollmentPage {
  enrollments: EnrollmentSummary[];
  totalDocuments: number;
  totalPages: number;
  currentPage: number;
  activeCount: number;
  archivedCount: number;
}

export interface CourseSection {
  sectionId: string;
  name: string;
  description?: string;
  order: string;
  isHidden?: boolean;
  isDeleted?: boolean;
}

export interface CourseModule {
  moduleId: string;
  name: string;
  description?: string;
  order: string;
  isHidden?: boolean;
  isDeleted?: boolean;
  sections: CourseSection[];
}

export interface CourseVersion {
  _id: string;
  courseId: string;
  version: string;
  description?: string;
  versionStatus?: 'active' | 'archived';
  modules: CourseModule[];
  totalItems?: number;
  itemCounts?: Partial<Record<'VIDEO' | 'QUIZ' | 'BLOG' | 'PROJECT' | 'FEEDBACK', number>>;
}

export interface SectionItem {
  _id: string;
  type: string;
  name: string;
  order: string;
  isHidden?: boolean | null;
  isCompleted?: boolean;
  isOptional?: boolean;
}

export interface ProgressPercentage {
  completed: boolean;
  percentCompleted: number;
  totalItems: number;
  completedItems: number;
}

export interface CurrentPath {
  module: { id: string; name: string } | null;
  section: { id: string; name: string } | null;
  item: { id: string; name: string; type: string } | null;
  message?: string;
}

export interface ModuleProgress {
  moduleId: string;
  moduleName: string;
  totalItems: number;
  completedItems: number;
}

export const courseKeys = {
  enrollments: (tab: 'active' | 'archived', search: string) => ['enrollments', tab, search] as const,
  version: (versionId: string) => ['course-version', versionId] as const,
  sectionItems: (versionId: string, moduleId: string, sectionId: string) =>
    ['section-items', versionId, moduleId, sectionId] as const,
  percentage: (courseId: string, versionId: string) => ['progress', 'percentage', courseId, versionId] as const,
  currentPath: (courseId: string, versionId: string) => ['progress', 'current-path', courseId, versionId] as const,
  moduleProgress: (courseId: string, versionId: string) => ['progress', 'modules', courseId, versionId] as const,
  ethicsConsent: (courseId: string, versionId: string) => ['ethics-consent', courseId, versionId] as const,
  faceReference: ['face-reference'] as const,
};

export function useEnrollments(tab: 'active' | 'archived' = 'active', search = '') {
  return useQuery({
    queryKey: courseKeys.enrollments(tab, search),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/users/enrollments', {
          // `role` is required by the backend's EnrollmentFilterQuery.
          params: { query: { page: 1, limit: 50, role: 'STUDENT', tab, search } },
        }),
      ) as unknown as EnrollmentPage,
  });
}

export function useCourseVersion(versionId: string) {
  return useQuery({
    queryKey: courseKeys.version(versionId),
    queryFn: async () =>
      unwrap(await api.GET('/api/courses/versions/{versionId}', { params: { path: { versionId } } })) as unknown as CourseVersion,
  });
}

export function useSectionItems(versionId: string, moduleId: string, sectionId: string, enabled = true) {
  return useQuery({
    queryKey: courseKeys.sectionItems(versionId, moduleId, sectionId),
    enabled,
    queryFn: async () =>
      unwrap(
        await api.GET('/api/courses/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/items', {
          params: { path: { versionId, moduleId, sectionId } },
        }),
      ) as unknown as SectionItem[],
  });
}

export function useProgressPercentage(courseId: string, versionId: string) {
  return useQuery({
    queryKey: courseKeys.percentage(courseId, versionId),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/users/progress/courses/{courseId}/versions/{versionId}/percentage', {
          params: { path: { courseId, versionId } },
        }),
      ) as unknown as ProgressPercentage,
  });
}

export function useCurrentPath(courseId: string, versionId: string) {
  return useQuery({
    queryKey: courseKeys.currentPath(courseId, versionId),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/users/progress/courses/{courseId}/versions/{versionId}/current-path', {
          params: { path: { courseId, versionId } },
        }),
      ) as unknown as CurrentPath,
  });
}

export function useModuleProgress(courseId: string, versionId: string) {
  return useQuery({
    queryKey: courseKeys.moduleProgress(courseId, versionId),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/users/progress/courses/{courseId}/versions/{versionId}/modules', {
          params: { path: { courseId, versionId } },
        }),
      ) as unknown as ModuleProgress[],
  });
}

export function useEthicsConsent(courseId: string, versionId: string) {
  return useQuery({
    queryKey: courseKeys.ethicsConsent(courseId, versionId),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/users/enrollments/courses/{courseId}/versions/{versionId}/ethics-consent', {
          params: { path: { courseId, versionId } },
        }),
      ) as unknown as { signed: boolean; signedAt?: string },
  });
}

export function useFaceReference() {
  return useQuery({
    queryKey: courseKeys.faceReference,
    queryFn: async () =>
      unwrap(await api.GET('/api/users/me/face-reference', {})) as unknown as {
        label: string;
        profileImage: string | null;
        faceEmbedding: number[] | null;
      },
  });
}

/** Sorts by the backend's lexicographic `order` keys and drops hidden/deleted entries. */
export function visibleInOrder<T extends { order: string; isHidden?: boolean | null; isDeleted?: boolean }>(list: T[]): T[] {
  return list.filter((x) => !x.isHidden && !x.isDeleted).sort((a, b) => a.order.localeCompare(b.order));
}
