import { z } from 'zod';

const AutomationConfig = z.object({
  document: z.string().describe('URL or local file path to PDF'),
});
type AutomationConfig = z.infer<typeof AutomationConfig>;

export { AutomationConfig };
