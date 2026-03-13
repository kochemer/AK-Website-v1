'use client';

import { useState, type FormEvent } from 'react';

type Props = {
  formAction: string;
};

type Status = 'idle' | 'submitting' | 'success' | 'error';

export default function FeedbackForm({ formAction }: Props) {
  const [status, setStatus] = useState<Status>('idle');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('submitting');

    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      const res = await fetch(formAction, {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
      });

      if (res.ok) {
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="text-center py-12">
        <span
          className="block text-2xl mb-4 select-none"
          style={{ color: 'var(--color-accent)' }}
          aria-hidden="true"
        >
          ✦
        </span>
        <p className="font-serif italic text-lg text-[var(--color-text-primary)] mb-2">
          Your note has been received.
        </p>
        <p className="font-sans text-sm text-[var(--color-text-secondary)]">
          Thank you for reading.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="letter-form space-y-8"
      noValidate
    >
      {/* Honeypot — hidden from humans */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="sr-only"
        aria-hidden="true"
      />

      {/* Name */}
      <div className="space-y-1">
        <label
          htmlFor="lte-name"
          className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--color-text-secondary)]"
        >
          Name <span className="normal-case tracking-normal opacity-60">(optional)</span>
        </label>
        <input
          type="text"
          id="lte-name"
          name="name"
          autoComplete="name"
          placeholder="Your name"
        />
      </div>

      {/* Email */}
      <div className="space-y-1">
        <label
          htmlFor="lte-email"
          className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--color-text-secondary)]"
        >
          Email <span className="normal-case tracking-normal opacity-60">(optional)</span>
        </label>
        <input
          type="email"
          id="lte-email"
          name="email"
          autoComplete="email"
          placeholder="your@email.com"
        />
      </div>

      {/* Message */}
      <div className="space-y-1">
        <label
          htmlFor="lte-message"
          className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--color-text-secondary)]"
        >
          Message <span className="text-[var(--color-accent)]">*</span>
        </label>
        <textarea
          id="lte-message"
          name="message"
          required
          rows={6}
          placeholder="Dear Editor, I wanted to mention…"
        />
      </div>

      {status === 'error' && (
        <p className="font-sans text-sm text-red-600">
          Something went wrong — please try again or email us directly.
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="font-sans text-sm tracking-wider text-[var(--color-accent)] border border-[var(--color-accent)] px-6 py-2.5 rounded-[2px] hover:bg-[var(--color-accent)] hover:text-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'submitting' ? 'Sending…' : 'Send Letter →'}
      </button>

      <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-[var(--color-text-secondary)] opacity-60">
        Submissions go directly to the editor.
      </p>
    </form>
  );
}
