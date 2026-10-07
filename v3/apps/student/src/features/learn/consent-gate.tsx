import { Loader2Icon, ShieldCheckIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/features/auth/auth-provider';

import { ETHICS_CONSENT_ADDITIONAL, ETHICS_CONSENT_DECLARATION, ETHICS_CONSENT_TITLE, EthicsConsentBody } from './ethics-consent-text';
import { useSignConsent } from './queries';

/**
 * The participant consent form every student signs before their first lesson
 * in a course (same rule and wording as the current app).
 */
export function ConsentGate({ courseId, versionId }: { courseId: string; versionId: string }) {
  const { user } = useAuth();
  const sign = useSignConsent(courseId, versionId);
  const [signature, setSignature] = useState(user?.displayName ?? '');
  const [agreed, setAgreed] = useState(false);
  const [additional, setAdditional] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!agreed || !signature.trim()) return;
    sign.mutate({ signature: signature.trim(), additionalImageConsent: additional });
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
          <ShieldCheckIcon className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="font-aleo text-2xl tracking-tight">{ETHICS_CONSENT_TITLE}</h1>
          <p className="text-sm text-muted-foreground">Please read this before your first lesson in this course.</p>
        </div>
      </div>

      <div tabIndex={0} aria-label="Consent form" className="max-h-[45vh] overflow-y-auto rounded-2xl border border-border bg-card p-5">
        <EthicsConsentBody />
      </div>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>{ETHICS_CONSENT_DECLARATION}</span>
        </label>
        <label className="flex items-start gap-3 text-sm text-muted-foreground">
          <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={additional} onChange={(e) => setAdditional(e.target.checked)} />
          <span>
            {ETHICS_CONSENT_ADDITIONAL} <span className="italic">(optional)</span>
          </span>
        </label>
        <div className="flex flex-col gap-2 sm:max-w-sm">
          <Label htmlFor="consent-signature">Type your full name to sign</Label>
          <Input id="consent-signature" value={signature} onChange={(e) => setSignature(e.target.value)} autoComplete="name" className="h-10" />
          <p className="text-xs text-muted-foreground">Date: {new Date().toLocaleDateString()}</p>
        </div>
        {sign.isError && (
          <p role="alert" className="text-sm text-destructive">
            {sign.error.message}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full sm:w-fit" disabled={!agreed || !signature.trim() || sign.isPending}>
          {sign.isPending && <Loader2Icon className="animate-spin" />}
          Sign and continue
        </Button>
      </form>
    </div>
  );
}
