'use client';

import { track } from '@/lib/analytics';

type SubscribePricingProps = {
  formAction: string;
};

export default function SubscribePricing({ formAction: _formAction }: SubscribePricingProps) {
  return (
    <div className="grid md:grid-cols-2 gap-4 mt-10">

      {/* Edition 01 — Reader */}
      <div className="border border-stone-200 dark:border-stone-700 rounded-[2px] p-8 flex flex-col bg-[var(--color-surface)] hover:border-[var(--color-accent)] transition-colors duration-200">
        <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--color-text-secondary)] mb-6">
          Edition 01 — Reader
        </p>
        <div className="mb-1">
          <span className="font-serif text-5xl font-light text-[var(--color-text-primary)]">€1</span>
          <span className="text-base text-[var(--color-text-secondary)] ml-1">/mo</span>
        </div>
        <p className="font-sans text-sm text-[var(--color-text-secondary)] mt-3 mb-8 leading-relaxed">
          Covers roughly one week of AI summarisation costs. Every reader who supports helps keep the brief running.
        </p>
        <a
          href="https://buy.stripe.com/eVqaEX09mh1h9RC619f3a00"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('checkout_start', { plan: 'supporter', price: 1, currency: 'eur' })}
          aria-label="Support Luxury Intelligence – Reader tier at €1/month"
          className="mt-auto w-full border border-[var(--color-accent)] text-[var(--color-accent)] py-3 text-sm font-sans tracking-wider text-center rounded-[2px] hover:bg-[var(--color-accent)] hover:text-white transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
        >
          Support at €1
        </a>
      </div>

      {/* Edition 02 — Patron */}
      <div className="border-2 border-[var(--color-accent)] rounded-[2px] p-8 flex flex-col bg-[var(--color-accent-light)] relative">
        <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--color-accent)] mb-6">
          Edition 02 — Patron
        </p>
        <div className="mb-1">
          <span className="font-serif text-5xl font-light text-[var(--color-text-primary)]">€3</span>
          <span className="text-base text-[var(--color-text-secondary)] ml-1">/mo</span>
        </div>
        <p className="font-sans text-sm text-[var(--color-text-secondary)] mt-3 mb-8 leading-relaxed">
          Covers a full month of infrastructure for one subscriber. The contribution that makes a meaningful difference to the project.
        </p>
        <a
          href="https://buy.stripe.com/eVqcN51dq26n4xi619f3a01"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('checkout_start', { plan: 'backer', price: 3, currency: 'eur' })}
          aria-label="Support Luxury Intelligence – Patron tier at €3/month"
          className="mt-auto w-full bg-[var(--color-accent)] text-white py-3 text-sm font-sans tracking-wider text-center rounded-[2px] hover:opacity-90 transition-opacity duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 font-medium"
        >
          Support at €3
        </a>
      </div>

    </div>
  );
}
