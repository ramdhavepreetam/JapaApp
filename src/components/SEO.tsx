/**
 * SEO.tsx — Universal SEO component for DoJapa (dojapa.com)
 *
 * Usage:
 *   import { SEO } from '../components/SEO';
 *
 *   // Home page
 *   <SEO />
 *
 *   // Mantra page
 *   <SEO
 *     title="Hare Krishna Maha Mantra — Japa Counter | DoJapa"
 *     description="Count Hare Krishna japa rounds with a 108-bead digital mala..."
 *     url="https://www.dojapa.com/mantras/hare-krishna"
 *     image="https://www.dojapa.com/images/mantras/hare-krishna-og.jpg"
 *     mantraName="Hare Krishna Maha Mantra"
 *     mantraSlug="hare-krishna"
 *   />
 *
 * Requires: react-helmet-async
 *   npm install react-helmet-async
 *   Wrap your app root with <HelmetProvider> from react-helmet-async
 */

import React from 'react';
import { Helmet } from 'react-helmet-async';

// ── Mantra-specific metadata used when mantraName is provided ──────────────

interface MantraMetadata {
  title: string;
  description: string;
  keywords: string;
  deity: string;
  tradition: string;
  language: string;
}

const MANTRA_META: Record<string, MantraMetadata> = {
  'hare-krishna': {
    title: 'Hare Krishna Maha Mantra — Digital Japa Counter | DoJapa',
    description:
      'Chant and count the Hare Krishna Maha Mantra with a 108-bead digital mala. Track daily rounds, build your japa streak, and deepen your bhakti. Free on DoJapa.',
    keywords:
      'Hare Krishna mantra, Hare Krishna japa app, maha mantra counter, ISKCON japa, Gaudiya Vaishnava, bhakti app, 16 rounds japa',
    deity: 'Krishna',
    tradition: 'Gaudiya Vaishnava / ISKCON',
    language: 'Sanskrit',
  },
  'om-namah-shivaya': {
    title: 'Om Namah Shivaya — Mantra Counter & Japa Tracker | DoJapa',
    description:
      'Count Om Namah Shivaya japa with a digital mala of 108 beads. Track Shaiva sadhana, streaks, and mantra rounds. Free japa app for Shiva devotees.',
    keywords:
      'Om Namah Shivaya counter, Shiva mantra app, Shaiva japa, namah shivaya 108 times, digital mala Shiva',
    deity: 'Shiva',
    tradition: 'Shaiva',
    language: 'Sanskrit',
  },
  gayatri: {
    title: 'Gayatri Mantra — 108 Times Japa Counter | DoJapa',
    description:
      "Chant the Gayatri Mantra 108 times daily with DoJapa's digital mala. Track rounds, set goals, and experience the transformative benefits of Gayatri japa.",
    keywords:
      'Gayatri mantra app, Gayatri 108 times, Gayatri japa counter, solar mantra, Vedic mantra counter',
    deity: 'Savitri / Gayatri Devi',
    tradition: 'Vedic / Smarta',
    language: 'Sanskrit (Vedic)',
  },
  'ram-naam': {
    title: 'Ram Naam Japa — Digital Mala Counter | DoJapa',
    description:
      "Chant Ram Naam with devotion using DoJapa's digital mala. Count 108-bead japa rounds, track daily goals, and build your Ram Naam streak.",
    keywords:
      'Ram naam japa, Ram mantra counter, Rama bhakti app, Jai Shri Ram counter, Vaishnava japa app',
    deity: 'Rama',
    tradition: 'Vaishnava / Ramanandi',
    language: 'Sanskrit / Hindi',
  },
  'om-mani-padme-hum': {
    title: 'Om Mani Padme Hum — Buddhist Mantra Counter | DoJapa',
    description:
      'Count Om Mani Padme Hum repetitions with a digital mala. DoJapa supports Buddhist japa practice with round tracking, streaks, and mindfulness features.',
    keywords:
      'Om Mani Padme Hum counter, Buddhist mantra app, Tibetan mantra, mani mantra counter, digital prayer beads',
    deity: 'Avalokiteśvara',
    tradition: 'Tibetan Buddhism / Mahayana',
    language: 'Sanskrit / Tibetan',
  },
};

// ── Defaults ───────────────────────────────────────────────────────────────

const SITE_NAME = 'DoJapa';
const SITE_URL = 'https://www.dojapa.com';
const TWITTER_HANDLE = '@DoJapaApp';

const DEFAULTS = {
  title: 'DoJapa — Digital Mala & Mantra Japa Counter | Daily Sadhana Tracker',
  description:
    'DoJapa is your free digital mala app. Count 108-bead japa rounds, track streaks, and chant Hare Krishna, Gayatri, Om Namah Shivaya & more. Start your sadhana today.',
  image: `${SITE_URL}/images/og-home.jpg`,
  url: SITE_URL,
  keywords:
    'japa app, digital mala, mantra counter app, online japa counter, 108 beads counter, chanting app, bhakti app, mantra meditation app, sadhana tracker',
};

// ── Props ──────────────────────────────────────────────────────────────────

interface SEOProps {
  /** Page <title>. Defaults to site-wide title. */
  title?: string;
  /** Meta description (≤155 chars). */
  description?: string;
  /** Absolute URL of the Open Graph image (1200×630px). */
  image?: string;
  /** Canonical URL for this page. */
  url?: string;
  /** Slug key from MANTRA_META — auto-fills mantra-specific meta if provided. */
  mantraSlug?: keyof typeof MANTRA_META;
  /** Override mantra name for JSON-LD (if you want custom name not in MANTRA_META). */
  mantraName?: string;
  /** Extra keywords appended to defaults. */
  extraKeywords?: string;
  /** Set true for blog posts — adds article OG type and article:published_time. */
  isArticle?: boolean;
  /** ISO 8601 publish date for blog posts. */
  publishedAt?: string;
  /** ISO 8601 modified date for blog posts. */
  modifiedAt?: string;
  /** Article author name. */
  author?: string;
  /** Locale override (default: en_US). */
  locale?: string;
  /** JSON-LD structured data blocks to inject (in addition to defaults). */
  extraSchemas?: object[];
}

// ── Component ──────────────────────────────────────────────────────────────

export const SEO: React.FC<SEOProps> = ({
  title,
  description,
  image,
  url,
  mantraSlug,
  mantraName,
  extraKeywords,
  isArticle = false,
  publishedAt,
  modifiedAt,
  author,
  locale = 'en_US',
  extraSchemas = [],
}) => {
  // If mantraSlug is given, layer in mantra-specific overrides
  const mantraMeta = mantraSlug ? MANTRA_META[mantraSlug] : null;

  const resolvedTitle = title ?? mantraMeta?.title ?? DEFAULTS.title;
  const resolvedDescription = description ?? mantraMeta?.description ?? DEFAULTS.description;
  const resolvedImage = image ?? DEFAULTS.image;
  const resolvedUrl = url ?? DEFAULTS.url;
  const resolvedKeywords = [
    DEFAULTS.keywords,
    mantraMeta?.keywords ?? '',
    extraKeywords ?? '',
  ]
    .filter(Boolean)
    .join(', ');

  // OG type changes for blog articles
  const ogType = isArticle ? 'article' : 'website';

  // Build mantra-page JSON-LD (SpecialAnnouncement / WebPage with mantra context)
  const mantraSchema = mantraMeta
    ? {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: resolvedTitle,
        description: resolvedDescription,
        url: resolvedUrl,
        inLanguage: 'en',
        about: {
          '@type': 'Thing',
          name: mantraName ?? mantraMeta.deity,
          description: `${mantraMeta.deity} mantra from the ${mantraMeta.tradition} tradition`,
        },
        mainEntity: {
          '@type': 'SoftwareApplication',
          name: 'DoJapa',
          applicationCategory: 'LifestyleApplication',
          operatingSystem: ['ANDROID', 'IOS', 'WEB'],
        },
      }
    : null;

  const articleSchema =
    isArticle && publishedAt
      ? {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: resolvedTitle,
          description: resolvedDescription,
          image: resolvedImage,
          url: resolvedUrl,
          datePublished: publishedAt,
          dateModified: modifiedAt ?? publishedAt,
          author: {
            '@type': 'Person',
            name: author ?? 'DoJapa Team',
          },
          publisher: {
            '@type': 'Organization',
            name: SITE_NAME,
            logo: {
              '@type': 'ImageObject',
              url: `${SITE_URL}/icons/logo-512.png`,
            },
          },
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': resolvedUrl,
          },
        }
      : null;

  const schemas = [
    mantraSchema,
    articleSchema,
    ...extraSchemas,
  ].filter(Boolean);

  return (
    <Helmet>
      {/* ── Primary ── */}
      <title>{resolvedTitle}</title>
      <meta name="description" content={resolvedDescription} />
      <meta name="keywords" content={resolvedKeywords} />
      <link rel="canonical" href={resolvedUrl} />

      {/* ── Open Graph ── */}
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={resolvedTitle} />
      <meta property="og:description" content={resolvedDescription} />
      <meta property="og:url" content={resolvedUrl} />
      <meta property="og:image" content={resolvedImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={resolvedTitle} />
      <meta property="og:locale" content={locale} />

      {/* Article-specific OG */}
      {isArticle && publishedAt && (
        <meta property="article:published_time" content={publishedAt} />
      )}
      {isArticle && modifiedAt && (
        <meta property="article:modified_time" content={modifiedAt} />
      )}
      {isArticle && author && (
        <meta property="article:author" content={author} />
      )}

      {/* ── Twitter ── */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={TWITTER_HANDLE} />
      <meta name="twitter:creator" content={TWITTER_HANDLE} />
      <meta name="twitter:title" content={resolvedTitle} />
      <meta name="twitter:description" content={resolvedDescription} />
      <meta name="twitter:image" content={resolvedImage} />
      <meta name="twitter:image:alt" content={resolvedTitle} />

      {/* ── Structured Data ── */}
      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
};

export default SEO;
