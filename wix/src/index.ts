class SimplePDF extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    const wixsettings: { company_identifier: string; pdf_url?: string } = JSON.parse(
      (this?.attributes as any)?.wixsettings?.value ?? '{}',
    );

    this.setAttribute('style', 'display:block');

    const hasCompanyIdentifier =
      wixsettings.company_identifier !== null &&
      wixsettings.company_identifier !== undefined &&
      wixsettings.company_identifier.trim() !== '';
    const hasURL =
      wixsettings.pdf_url !== null && wixsettings.pdf_url !== undefined && wixsettings.pdf_url.trim() !== '';

    const editorURL = hasURL ? `editor?open=${wixsettings.pdf_url}` : 'editor';

    this.innerHTML = `<iframe src="${
      hasCompanyIdentifier
        ? `https://${wixsettings.company_identifier}.simplePDF.eu/${editorURL}`
        : 'https://embed.simplePDF.eu/integrations/wix#setup'
    }" style="width: 100vw; height: 100vh"/>`;
  }
}

customElements.define('simplepdf-wix-embed-pdf', SimplePDF);
