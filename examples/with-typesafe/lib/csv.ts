import Papa from "papaparse"
import type { Result } from "./result"

// A single CSV record: the ordered header plus its one row of values.
export type ParsedCsvRecord = {
  columns: string[]
  values: Record<string, string>
}

type ParseCsvErrorCode = "empty" | "multiple_records" | "parse_error"

export const parseSingleRecordCsv = (text: string): Result<ParsedCsvRecord, ParseCsvErrorCode> => {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  })

  if (parsed.errors.length > 0) {
    const [firstError] = parsed.errors
    return {
      success: false,
      error: { code: "parse_error", message: firstError?.message ?? "Failed to parse the CSV" },
    }
  }

  const rows = parsed.data
  if (rows.length === 0) {
    return { success: false, error: { code: "empty", message: "The CSV has no data rows" } }
  }
  if (rows.length > 1) {
    return {
      success: false,
      error: { code: "multiple_records", message: `Expected a single record, found ${rows.length}` },
    }
  }

  const [firstRow] = rows
  return {
    success: true,
    data: { columns: parsed.meta.fields ?? [], values: firstRow ?? {} },
  }
}
