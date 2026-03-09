import Link from 'next/link';

type CategoryCardProps = {
  title: string;
  description: string;
  articleCount: number;
  color: string;
  href: string;
};

export default function CategoryCard({
  title,
  description,
  articleCount,
  color,
  href,
}: CategoryCardProps) {
  return (
    <Link
      href={href}
      className="block bg-[var(--color-surface)] border border-gray-100 rounded-sm p-5 hover:shadow-lg hover:-translate-y-px hover:border-[var(--color-accent)] transition-all duration-200 text-left focus-visible:outline-none"
      style={{ borderTopWidth: '4px', borderTopColor: color }}
      aria-label={`${title}, ${articleCount} articles this week`}
    >
      <h3 className="font-serif text-card-title font-bold text-[var(--color-text-primary)]">
        {title}
      </h3>
      <p className="text-body text-[var(--color-text-secondary)] mt-1 leading-snug">
        {description}
      </p>
      <p className="text-meta text-[var(--color-text-secondary)] mt-2 opacity-80">
        {articleCount} article{articleCount !== 1 ? 's' : ''} this week
      </p>
    </Link>
  );
}
