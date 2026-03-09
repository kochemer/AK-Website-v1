import { promises as fs } from 'fs';
import path from 'path';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/utils/siteUrl';
import { formatDateRange } from '@/lib/utils/formatDate';

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: 'Archivo – Resúmenes Semanales de IA y Lujo',
  description: 'Explora el archivo completo de resúmenes semanales de IA, ecommerce, lujo y joyería. Accede a todos los informes de inteligencia curados y resúmenes semanales.',
  alternates: {
    canonical: `${siteUrl}/es/archive`,
  },
  openGraph: {
    title: 'Archivo – Resúmenes Semanales de IA y Lujo',
    description: 'Explora el archivo completo de resúmenes semanales de IA, ecommerce, lujo y joyería. Accede a todos los informes de inteligencia curados y resúmenes semanales.',
    images: [`${siteUrl}/og-default.svg`],
  },
  twitter: {
    title: 'Archivo – Resúmenes Semanales de IA y Lujo',
    description: 'Explora el archivo completo de resúmenes semanales de IA, ecommerce, lujo y joyería. Accede a todos los informes de inteligencia curados y resúmenes semanales.',
    images: [`${siteUrl}/og-default.svg`],
  },
};

async function getAvailableDigests(): Promise<string[]> {
  try {
    const digestsDir = path.join(process.cwd(), 'data', 'digests');
    const files = await fs.readdir(digestsDir);
    const weekLabels = files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''))
      .filter(label => /^\d{4}-W\d{1,2}$/.test(label))
      .sort((a, b) => {
        const [yearA, weekA] = a.split('-W').map(Number);
        const [yearB, weekB] = b.split('-W').map(Number);
        if (yearA !== yearB) return yearB - yearA;
        return weekB - weekA;
      });
    return weekLabels;
  } catch {
    return [];
  }
}

async function getWeekMeta(weekLabel: string): Promise<{ dateRange: string | null; coverImageUrl?: string; coverImageAlt?: string }> {
  try {
    const digestPath = path.join(process.cwd(), 'data', 'digests', `${weekLabel}.json`);
    const raw = await fs.readFile(digestPath, 'utf-8');
    const digest = JSON.parse(raw);
    const dateRange = digest.startISO && digest.endISO ? formatDateRange(digest.startISO, digest.endISO) : null;
    return { dateRange, coverImageUrl: digest.coverImageUrl, coverImageAlt: digest.coverImageAlt };
  } catch {
    return { dateRange: null };
  }
}

function formatWeekLabel(weekLabel: string): string {
  const [year, week] = weekLabel.split('-W').map(Number);
  return `Semana ${week}, ${year}`;
}

export default async function ArchivePageES() {
  const digests = await getAvailableDigests();

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-12 md:py-16">
      <header className="mb-12 md:mb-16">
        <h1 className="text-page font-bold mb-6 text-gray-900">
          Archivo de Resúmenes
        </h1>
        <Link href="/es" className="text-blue-600 hover:text-blue-800 underline text-body">
          ← Volver al inicio
        </Link>
      </header>

      {digests.length > 0 ? (
        <div>
          <p className="text-body text-gray-600 mb-8 leading-relaxed">
            Resúmenes semanales disponibles ({digests.length}):
          </p>
          <ul className="space-y-3">
            {await Promise.all(digests.map(async (weekLabel) => {
              const meta = await getWeekMeta(weekLabel);
              const formatted = formatWeekLabel(weekLabel);
              return (
                <li key={weekLabel}>
                  <Link
                    href={`/week/${weekLabel}`}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-[var(--color-surface)] border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-colors overflow-hidden"
                  >
                    {meta.coverImageUrl && (
                      <div className="flex-shrink-0 w-full sm:w-28 h-32 sm:h-20 rounded-md overflow-hidden bg-gray-100">
                        <img src={meta.coverImageUrl} alt={meta.coverImageAlt || `Portada para ${weekLabel}`} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="font-semibold text-gray-900">{formatted}</span>
                      <span className="text-meta text-gray-500 ml-2">({weekLabel})</span>
                      {meta.dateRange && <p className="text-meta text-gray-600 mt-1">{meta.dateRange}</p>}
                    </div>
                  </Link>
                </li>
              );
            }))}
          </ul>
        </div>
      ) : (
        <p className="text-body text-gray-600 leading-relaxed">
          Aún no hay resúmenes disponibles. Ejecuta <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">npx tsx scripts/buildWeeklyDigest.ts</code> para crear resúmenes.
        </p>
      )}
    </div>
  );
}


