import { runAutomation } from './automation';

const EXIT_CODES = {
  SUCCESS: 0,
  INVALID_ARGS: 1,
  AUTOMATION_FAILED: 2,
} as const;

const DEFAULT_COMPANY_IDENTIFIER = 'embed';

const printUsage = (): void => {
  console.log(`
Usage: npx tsx src/index.ts <document> [options]

Arguments:
  document              URL or local file path to a PDF

Options:
  --company-identifier  Your SimplePDF company identifier (default: embed)
  --help                Show this help message

Examples:
  npx tsx src/index.ts https://example.com/form.pdf
  npx tsx src/index.ts ./documents/form.pdf
  npx tsx src/index.ts https://example.com/form.pdf --company-identifier yourcompany
`);
};

type ParsedArgs = {
  document: string | null;
  baseUrl: string;
  showHelp: boolean;
};

const parseArgs = (): ParsedArgs => {
  const args = process.argv.slice(2);
  let document: string | null = null;
  let companyIdentifier = DEFAULT_COMPANY_IDENTIFIER;
  let baseUrl: string | null = null;
  let showHelp = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      showHelp = true;
      continue;
    }

    if (arg === '--company-identifier') {
      companyIdentifier = args[++i] ?? companyIdentifier;
      continue;
    }

    if (arg === '--base-url') {
      baseUrl = args[++i] ?? null;
      continue;
    }

    if (!arg?.startsWith('-')) {
      document = arg ?? null;
    }
  }

  const resolvedBaseUrl = baseUrl ?? `https://${companyIdentifier}.simplepdf.com`;

  return { document, baseUrl: resolvedBaseUrl, showHelp };
};

const main = async (): Promise<void> => {
  const { document, baseUrl, showHelp } = parseArgs();

  if (showHelp) {
    printUsage();
    process.exit(EXIT_CODES.SUCCESS);
  }

  if (!document) {
    console.error('Error: document URL or file path is required');
    printUsage();
    process.exit(EXIT_CODES.INVALID_ARGS);
  }

  console.log('Starting automation...');
  console.log(`Document: ${document}`);
  console.log(`Editor: ${baseUrl}`);
  console.log('');

  const result = await runAutomation({ document, baseUrl });

  if (!result.success) {
    console.error(`Automation failed: [${result.error.code}] ${result.error.message}`);
    process.exit(EXIT_CODES.AUTOMATION_FAILED);
  }

  console.log('Automation completed successfully');
  console.log('Browser left open for inspection. Press Ctrl+C to close.');
};

main().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(EXIT_CODES.AUTOMATION_FAILED);
});
