declare global {
  interface Window {
    simplePDF?: {
      disableInit?: boolean;
      isDebug?: boolean;
      companyIdentifier?: string;
    };
  }
}

export {};
