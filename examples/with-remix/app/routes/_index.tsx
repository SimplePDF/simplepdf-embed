import type { MetaFunction } from "@remix-run/node";
import { EmbedPDF } from "@simplepdf/react-embed-pdf";
import React from "react";

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
      <div style={{ display: "flex" }}>
        <WithoutAccount>
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
            style={{ width: 720, height: 800 }}
          />
        </WithoutAccount>
        <WithAccount>
          <h3>Modal mode (default)</h3>
          <EmbedPDF
            companyIdentifier="webhooks-playground"
            context={{ origin: "with-remix-example" }}
          >
            <a href="https://cdn.simplepdf.com/simple-pdf/assets/sample.pdf">
              Opens sample.pdf in a modal
            </a>
          </EmbedPDF>
          <h3>Inline mode</h3>
          <EmbedPDF
            companyIdentifier="webhooks-playground"
            context={{ origin: "with-remix-example" }}
            documentURL="https://cdn.simplepdf.com/simple-pdf/assets/sample.pdf"
            mode="inline"
            style={{ width: 720, height: 800 }}
          />
        </WithAccount>
      </div>
    </div>
  );
}

const WithoutAccount = ({ children }: { children: React.ReactNode }) => {
  return (
    <div
      style={{
        maxWidth: "50%",
        width: "100%",
        padding: 20,
        background: "#dcd9ff",
      }}
    >
      <h2>Without an account</h2>
      <br />
      {children}
    </div>
  );
};

const WithAccount = ({ children }: { children: React.ReactNode }) => {
  return (
    <div
      style={{
        maxWidth: "50%",
        width: "100%",
        padding: 20,
        background: "#a3e1c4",
      }}
    >
      <h2>With an account</h2>
      <i>
        Edited documents are sent{" "}
        <a
          href="https://simplepdf.com/help/how-to/configure-webhooks-pdf-form-submissions"
          target="_blank"
        >
          via webhooks
        </a>{" "}
        and can be seen{" "}
        <a href="https://webhooks.simplepdf.com/" target="_blank">
          on this website
        </a>
      </i>
      {children}
    </div>
  );
};
