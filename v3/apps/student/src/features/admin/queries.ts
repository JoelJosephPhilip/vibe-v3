import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@vibe/api';

import { api } from '@/lib/api';
import { toId } from '@/features/learn/quiz-api';

/** Shape follows what GET /users/me actually returns (same fields as the Mongo user doc). */
export interface CurrentUserProfile {
  _id: string;
  email: string;
  firstName: string;
  lastName?: string;
  roles: 'admin' | 'user';
}

export function useCurrentUserProfile() {
  return useQuery({
    queryKey: ['current-user-profile'],
    queryFn: async () => unwrap(await api.GET('/api/users/me', {})) as unknown as CurrentUserProfile,
    staleTime: 5 * 60 * 1000,
  });
}

/** The backend serialises _id/versions as raw BSON buffers here (see toId's doc comment). */
export interface AdminCourse {
  _id: string;
  name: string;
  description: string;
  versions: string[];
  instructors: string[];
  createdAt: string;
}

export function useAllCourses() {
  return useQuery({
    queryKey: ['admin', 'courses'],
    queryFn: async () => {
      const raw = unwrap(await api.GET('/api/courses/', {})) as unknown as { courses: any[] };
      return raw.courses.map((c) => ({
        _id: toId(c._id),
        name: c.name,
        description: c.description,
        versions: (c.versions ?? []).map(toId),
        instructors: (c.instructors ?? []).map(toId),
        createdAt: c.createdAt,
      })) as AdminCourse[];
    },
  });
}

export interface CreateCourseInput {
  name: string;
  description: string;
  versionName: string;
  versionDescription: string;
}

export function useCreateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCourseInput) =>
      unwrap(
        await api.POST('/api/courses/', {
          body: input,
        }),
      ) as unknown as { _id: string; versions: string[] },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] });
    },
  });
}

export interface InviteInstructorInput {
  courseId: string;
  versionId: string;
  email: string;
}

export function useInviteInstructor() {
  return useMutation({
    mutationFn: async ({ courseId, versionId, email }: InviteInstructorInput) =>
      unwrap(
        await api.POST('/api/notifications/invite/courses/{courseId}/versions/{versionId}', {
          params: { path: { courseId, versionId } },
          body: { inviteData: [{ email, role: 'INSTRUCTOR' }] },
        }),
      ) as unknown as { invites: { inviteId: string; email: string; inviteStatus: string }[] },
  });
}

export function useCourse(courseId: string) {
  return useQuery({
    queryKey: ['admin', 'course', courseId],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/courses/{courseId}', { params: { path: { courseId } } }),
      ) as unknown as { _id: string; name: string; description: string },
    enabled: !!courseId,
  });
}

export interface CourseEnrollment {
  role: string;
  status: string;
  enrollmentDate: string;
  user: { _id: string; email: string; firstName: string; lastName?: string };
}

export function useCourseEnrollments(courseId: string, versionId: string) {
  return useQuery({
    queryKey: ['admin', 'enrollments', courseId, versionId],
    queryFn: async () => {
      const raw = unwrap(
        await api.GET('/api/users/enrollments/courses/{courseId}/versions/{versionId}', {
          params: { path: { courseId, versionId } },
        }),
      ) as unknown as { enrollments: CourseEnrollment[] };
      return raw.enrollments;
    },
    enabled: !!courseId && !!versionId,
  });
}
