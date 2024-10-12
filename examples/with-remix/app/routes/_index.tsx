import type { MetaFunction } from "@remix-run/node";
import { EmbedPDF } from "@simplepdf/react-embed-pdf";

export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export default function Index() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.8" }}>
      <h1>With Remix</h1>

      <h2>Without an account</h2>
      <h3>Modal mode (default)</h3>
      <EmbedPDF>
        <a href="https://cdn.simplepdf.com/simple-pdf/assets/sample.pdf">
          Opens sample.pdf in a modal
        </a>
      </EmbedPDF>
      <h3>Inline mode</h3>
      <EmbedPDF
        documentURL="https://cdn.simplepdf.com/simple-pdf/assets/sample.pdf"
        mode="inline"
        style={{ width: 1200, height: 800 }}
      />

      <h2>With an account</h2>
      <h3>Modal mode (default)</h3>
      <EmbedPDF companyIdentifier="yourcompany">
        <a href="https://cdn.simplepdf.com/simple-pdf/assets/sample.pdf">
          Opens sample.pdf in a modal
        </a>
      </EmbedPDF>
      <h3>Inline mode</h3>
      <EmbedPDF
        companyIdentifier="yourcompany"
        documentURL="https://cdn.simplepdf.com/simple-pdf/assets/sample.pdf"
        mode="inline"
        style={{ width: 1200, height: 800 }}
      />
    </div>
  );
}
