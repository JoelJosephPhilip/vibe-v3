import { Link, useNavigate } from '@tanstack/react-router';
import { EyeIcon, EyeOffIcon, Loader2Icon } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { AuthLayout, FormError, GoogleIcon, OrDivider } from './auth-layout';
import { useAuth } from './auth-provider';

export function LoginPage({ redirect }: { redirect?: string }) {
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState<'email' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const goNext = (isNewUser = false) =>
    isNewUser ? navigate({ to: '/onboarding', search: { redirect }, replace: true }) : navigate({ to: redirect ?? '/home', replace: true });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending('email');
    try {
      await signIn(email.trim(), password);
      await goNext();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(null);
    }
  }

  async function onGoogle() {
    setError(null);
    setPending('google');
    try {
      const { isNewUser } = await signInWithGoogle();
      await goNext(isNewUser);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(null);
    }
  }

  return (
    <AuthLayout
      title="Welcome back to ViBe"
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/signup" search={{ redirect }} className="font-medium text-foreground hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <Button type="button" variant="outline" size="lg" className="w-full" onClick={onGoogle} disabled={pending !== null}>
        {pending === 'google' ? <Loader2Icon className="animate-spin" /> : <GoogleIcon className="size-4" />}
        Continue with Google
      </Button>

      <OrDivider />

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            autoCapitalize="none"
            spellCheck={false}
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11 sm:h-10"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-11 pr-10 sm:h-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </button>
          </div>
          <Link to="/forgot-password" className="w-fit text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
            Forgot my password
          </Link>
        </div>

        <FormError message={error} />

        <Button type="submit" size="lg" className="w-full" disabled={pending !== null || !email || !password}>
          {pending === 'email' && <Loader2Icon className="animate-spin" />}
          Continue
        </Button>
      </form>
    </AuthLayout>
  );
}
