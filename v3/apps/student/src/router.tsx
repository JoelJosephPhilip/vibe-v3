import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  redirect,
} from '@tanstack/react-router';

import { AppShell } from '@/features/app-shell/app-shell';
import { authReady } from '@/features/auth/auth-provider';
import { ForgotPasswordPage } from '@/features/auth/forgot-password-page';
import { LoginPage } from '@/features/auth/login-page';
import { SignupPage } from '@/features/auth/signup-page';
import { CoursePage } from '@/features/courses/course-page';
import { CoursesPage } from '@/features/courses/courses-page';
import { HomePage } from '@/features/home/home-page';
import { LessonPage } from '@/features/learn/lesson-page';
import { LandingPage } from '@/features/landing/landing-page';
import { OnboardingPage } from '@/features/onboarding/onboarding-page';
import { readOnboarding } from '@/features/onboarding/onboarding-state';
import { ProfilePage } from '@/features/profile/profile-page';

const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: NotFound,
});

const landingRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: LandingPage });

/** Auth pages are for signed-out visitors; signed-in users go straight to the app. */
async function redirectIfSignedIn() {
  if (await authReady()) throw redirect({ to: '/home' });
}

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === 'string' && search.redirect.startsWith('/') ? search.redirect : undefined,
  }),
  beforeLoad: redirectIfSignedIn,
  component: function LoginRoute() {
    const { redirect: to } = loginRoute.useSearch();
    return <LoginPage redirect={to} />;
  },
});

const signupRoute = createRoute({ getParentRoute: () => rootRoute, path: '/signup', beforeLoad: redirectIfSignedIn, component: SignupPage });
const forgotRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/forgot-password',
  beforeLoad: redirectIfSignedIn,
  component: ForgotPasswordPage,
});

async function requireUser(location: { href: string }) {
  const user = await authReady();
  if (!user) throw redirect({ to: '/login', search: { redirect: location.href } });
  return user;
}

const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboarding',
  beforeLoad: ({ location }) => requireUser(location),
  component: OnboardingPage,
});

async function requireOnboardedUser(location: { href: string }) {
  const user = await requireUser(location);
  if (!readOnboarding(user.uid).completedAt) throw redirect({ to: '/onboarding' });
}

/** Signed-in area. First-time users see onboarding once before anything else. */
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: ({ location }) => requireOnboardedUser(location),
  component: AppShell,
});

/** Full-screen lesson player (outside the app shell, like Uxcel's lesson view). */
const learnRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/learn/$courseId/$versionId/$moduleId/$sectionId/$itemId',
  beforeLoad: ({ location }) => requireOnboardedUser(location),
  component: function LearnRoute() {
    const params = learnRoute.useParams();
    return <LessonPage key={params.itemId} {...params} />;
  },
});

const homeRoute = createRoute({ getParentRoute: () => appRoute, path: '/home', component: HomePage });
const coursesRoute = createRoute({ getParentRoute: () => appRoute, path: '/courses', component: CoursesPage });
const courseRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/courses/$courseId/$versionId',
  component: function CourseRoute() {
    const { courseId, versionId } = courseRoute.useParams();
    return <CoursePage key={versionId} courseId={courseId} versionId={versionId} />;
  },
});
const profileRoute = createRoute({ getParentRoute: () => appRoute, path: '/profile', component: ProfilePage });

const routeTree = rootRoute.addChildren([
  landingRoute,
  loginRoute,
  signupRoute,
  forgotRoute,
  onboardingRoute,
  learnRoute,
  appRoute.addChildren([homeRoute, coursesRoute, courseRoute, profileRoute]),
]);

export function createAppRouter(options: { initialPath?: string } = {}) {
  return createRouter({
    routeTree,
    defaultPreload: 'intent',
    scrollRestoration: true,
    // Tests start at a given URL without touching window.location.
    ...(options.initialPath ? { history: createMemoryHistory({ initialEntries: [options.initialPath] }) } : {}),
  });
}

export const router = createAppRouter();

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="font-aleo text-5xl">404</p>
        <p className="mt-2 text-muted-foreground">We couldn’t find that page.</p>
        <Link to="/" className="mt-6 inline-block text-sm font-medium underline underline-offset-4">
          Go to the home page
        </Link>
      </div>
    </div>
  );
}
