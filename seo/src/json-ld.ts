export type JsonLdType = 'Article' | 'NewsArticle' | 'BlogPosting' | 'WebPage';

export interface JsonLdInput {
  type: JsonLdType;
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  author?: string;
  publishedDate?: string;
  modifiedDate?: string;
  siteName?: string;
  custom?: Record<string, unknown>;
}

export function buildJsonLd(input: JsonLdInput): string {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': input.type,
  };

  if (input.title) {
    data.headline = input.title;
  }

  if (input.description) {
    data.description = input.description;
  }

  if (input.image) {
    data.image = input.image;
  }

  if (input.author) {
    data.author = {
      '@type': 'Person',
      name: input.author,
    };
  }

  if (input.publishedDate) {
    data.datePublished = input.publishedDate;
  }

  if (input.modifiedDate) {
    data.dateModified = input.modifiedDate;
  }

  if (input.siteName) {
    data.publisher = {
      '@type': 'Organization',
      name: input.siteName,
    };
  }

  const url = input.url;
  if (url) {
    data.mainEntityOfPage = url;
  }

  if (input.custom) {
    const { '@context': _, '@type': __, ...safe } = input.custom as Record<string, unknown>;
    Object.assign(data, safe);
  }

  const json = JSON.stringify(data, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');

  return `<script type="application/ld+json">\n${json}\n</script>`;
}
