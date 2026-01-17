export const generateRandomID = (): string => {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

export const buildEditorDomain = ({
  baseDomain,
  companyIdentifier,
}: {
  baseDomain: string | undefined;
  companyIdentifier: string | undefined;
}): string => {
  const domain = baseDomain ?? 'simplepdf.com';
  const subdomain = companyIdentifier ?? 'react-editor';
  const isLocalDev = domain.includes('.nil') || domain.includes('localhost');
  const protocol = isLocalDev ? 'http' : 'https';

  return `${protocol}://${subdomain}.${domain}`;
};

export const encodeContext = (context: Record<string, unknown> | undefined): string | null => {
  if (!context) {
    return null;
  }

  try {
    return encodeURIComponent(btoa(JSON.stringify(context)));
  } catch (e) {
    console.error(`Failed to encode the context: ${JSON.stringify(e)}`, { context });
    return null;
  }
};

export type Locale = 'en' | 'de' | 'es' | 'fr' | 'it' | 'pt' | 'nl';

const DEFAULT_LOCALE: Locale = 'en';

export const buildEditorURL = ({
  editorDomain,
  locale,
  encodedContext,
  hasDocumentUrl,
  corsProxyFallbackUrl,
}: {
  editorDomain: string;
  locale: Locale | undefined;
  encodedContext: string | null;
  hasDocumentUrl: boolean;
  corsProxyFallbackUrl: string | null;
}): string => {
  const simplePDFEditorURL = new URL(`/${locale ?? DEFAULT_LOCALE}/editor`, editorDomain);

  if (encodedContext) {
    simplePDFEditorURL.searchParams.set('context', encodedContext);
  }

  if (hasDocumentUrl) {
    simplePDFEditorURL.searchParams.set('loadingPlaceholder', 'true');
  }

  if (corsProxyFallbackUrl !== null) {
    simplePDFEditorURL.searchParams.set('open', corsProxyFallbackUrl);
  }

  return simplePDFEditorURL.href;
};

export const extractDocumentName = (url: string): string => {
  const [documentName] = url.substring(url.lastIndexOf('/') + 1).split('?');
  return documentName ?? '';
};
