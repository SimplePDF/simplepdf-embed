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
  document,
}: {
  editorDomain: string;
  locale: Locale | undefined;
  encodedContext: string | null;
  document:
    | null
    | { type: 'simplepdf'; url: string }
    | { type: 'external'; url: string; corsProxyFallbackUrl: string | null };
}): string => {
  if (document?.type === 'simplepdf') {
    const directURL = new URL(document.url);
    if (encodedContext) {
      directURL.searchParams.set('context', encodedContext);
    }
    return directURL.href;
  }

  const simplePDFEditorURL = new URL(`/${locale ?? DEFAULT_LOCALE}/editor`, editorDomain);

  if (encodedContext) {
    simplePDFEditorURL.searchParams.set('context', encodedContext);
  }

  if (document !== null) {
    simplePDFEditorURL.searchParams.set('loadingPlaceholder', 'true');
  }

  if (document?.corsProxyFallbackUrl !== null && document?.corsProxyFallbackUrl !== undefined) {
    simplePDFEditorURL.searchParams.set('open', document.corsProxyFallbackUrl);
  }

  return simplePDFEditorURL.href;
};

export const isSimplePDFDocumentURL = ({ url, baseDomain }: { url: string; baseDomain: string | undefined }): boolean => {
  try {
    const domain = baseDomain ?? 'simplepdf.com';
    const escapedDomain = domain.replace(/\./g, '\\.').replace(/:/g, '\\:');
    const regex = new RegExp(`^https?://[^.]+\\.${escapedDomain}(/[^/]+)?/(form|documents)/.+`);
    return regex.test(url);
  } catch {
    return false;
  }
};

export const extractDocumentName = (url: string): string => {
  const [documentName] = url.substring(url.lastIndexOf('/') + 1).split('?');
  return documentName ?? '';
};
