import * as fs from 'fs';
import * as path from 'path';
import { AutomationConfig } from './schema';
import { runAutomation } from './automation';

const EXIT_CODES = {
  SUCCESS: 0,
  INVALID_ARGS: 1,
  FILE_NOT_FOUND: 2,
  INVALID_CONFIG: 3,
  AUTOMATION_FAILED: 4,
} as const;

const DEFAULT_COMPANY_IDENTIFIER = 'embed';

const printUsage = (): void => {
  console.log(`
Usage: npx tsx src/index.ts <config.json> [options]

Arguments:
  config.json           Path to JSON configuration file

Options:
  --company-identifier  Your SimplePDF company identifier (default: embed)
  --help                Show this help message

Configuration file format:
{
  "document": "https://example.com/document.pdf",
  "fields": [
    {
      "type": "TEXT",
      "x": 100,
      "y": 700,
      "width": 200,
      "height": 20,
      "page": 1,
      "value": "Hello World"
    }
  ]
}

Field types: TEXT, BOXED_TEXT, SIGNATURE, PICTURE, CHECKBOX

Coordinate System:
  Uses PDF standard coordinates:
  - Origin at bottom-left corner of page
  - Y increases upward
  - Units in points (1/72 inch)

Examples:
  npx tsx src/index.ts config.json
  npx tsx src/index.ts config.json --company-identifier mycompany
`);
};

type ParsedArgs = {
  configPath: string | null;
  baseUrl: string;
  showHelp: boolean;
};

const parseArgs = (): ParsedArgs => {
  const args = process.argv.slice(2);
  let configPath: string | null = null;
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
      configPath = arg ?? null;
    }
  }

  const resolvedBaseUrl = baseUrl ?? `https://${companyIdentifier}.simplepdf.com`;

  return { configPath, baseUrl: resolvedBaseUrl, showHelp };
};

const loadConfig = ({ configPath }: { configPath: string }): AutomationConfig => {
  const absolutePath = path.isAbsolute(configPath) ? configPath : path.resolve(process.cwd(), configPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Configuration file not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const parsed = JSON.parse(content) as unknown;

  return parsed as AutomationConfig;
};

const main = async (): Promise<void> => {
  const { configPath, baseUrl, showHelp } = parseArgs();

  if (showHelp) {
    printUsage();
    process.exit(EXIT_CODES.SUCCESS);
  }

  if (!configPath) {
    console.error('Error: Configuration file path is required');
    printUsage();
    process.exit(EXIT_CODES.INVALID_ARGS);
  }

  let config: AutomationConfig;
  try {
    config = loadConfig({ configPath });
  } catch (e) {
    const error = e as Error;
    console.error(`Error loading configuration: ${error.message}`);
    process.exit(EXIT_CODES.FILE_NOT_FOUND);
  }

  console.log('Starting automation...');
  console.log(`Document: ${config.document}`);
  console.log(`Fields: ${config.fields.length}`);
  console.log(`Editor: ${baseUrl}`);
  console.log('');

  const result = await runAutomation({ config, baseUrl });

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
