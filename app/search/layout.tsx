import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search articles across the Luxury Intelligence archive.',
};

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
