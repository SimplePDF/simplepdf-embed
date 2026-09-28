"use client"

import type { ReactElement } from "react"
import { Button } from "@/components/ui/button"
import { FormGallery } from "@/components/form-gallery"
import { Timing, type TimingPhase } from "@/components/timing"
import type { ParsedCsvRecord } from "@/lib/csv"
import type { FormDefinition } from "@/lib/forms"
import {
  buildFieldRows,
  primaryAction,
  type Issue,
  type FillSummary,
  type FieldMapping,
  type EditorField,
  type FieldRowState,
  type PrimaryAction,
} from "@/lib/jev"

const primaryActionLabel = (action: PrimaryAction): string => {
  switch (action) {
    case "fill":
      return "Fill & validate"
    case "validate":
      return "Validate"
    case "revalidate":
      return "Re-validate"
    default:
      action satisfies never
      return ""
  }
}

const rowIndicator = (state: FieldRowState): { className: string; symbol: string } => {
  switch (state) {
    case "filled":
      return { className: "text-valid", symbol: "●" }
    case "confirm":
      return { className: "text-warn", symbol: "▲" }
    case "confirmed":
      return { className: "text-valid", symbol: "●" }
    case "error":
      return { className: "text-error", symbol: "✕" }
    case "empty":
      return { className: "text-muted-foreground/40", symbol: "·" }
    default:
      state satisfies never
      return { className: "text-muted-foreground", symbol: "·" }
  }
}

type SourcePaneProps = {
  forms: FormDefinition[]
  activeFormId: string
  onSelectForm: (form: FormDefinition) => void
  record: ParsedCsvRecord | null
  mappings: FieldMapping[]
  fields: EditorField[]
  issues: Issue[]
  fillSummary: FillSummary | null
  errorMessage: string | null
  onFillAndValidate: () => void
  canFillAndValidate: boolean
  isBusy: boolean
  validationStale: boolean
  timingPhase: TimingPhase
  fillMs: number | null
  classifyMs: number | null
  onSelectField: (fieldId: string, page: number) => void
  onApplyCandidate: (issue: Issue, column: string) => void
  onConfirmMapping: (fieldId: string) => void
  onFinalize: () => void
  confirmedFieldIds: ReadonlySet<string>
}

export const SourcePane = ({
  forms,
  activeFormId,
  onSelectForm,
  record,
  mappings,
  fields,
  issues,
  fillSummary,
  errorMessage,
  onFillAndValidate,
  canFillAndValidate,
  isBusy,
  validationStale,
  timingPhase,
  fillMs,
  classifyMs,
  onSelectField,
  onApplyCandidate,
  onConfirmMapping,
  onFinalize,
  confirmedFieldIds,
}: SourcePaneProps): ReactElement => {
  const isFilled = fillSummary !== null
  const fieldRows = isFilled ? buildFieldRows(fields, mappings, issues, confirmedFieldIds) : []
  // Any actionable field (a value, a confirmed decision, or an open issue to confirm/fix) lives in
  // "Fields". Only a still-empty, untouched, unflagged field is "Additional" — so the Additional
  // section never holds anything the human must act on. A manually filled field bumps to Fields on
  // the next re-validate (which re-reads its value).
  const mainRows = fieldRows.filter((row) => row.state !== "empty")
  const additionalRows = fieldRows.filter((row) => row.state === "empty")
  const filledCount = mainRows.filter((row) => row.state === "filled").length
  const errorCount = mainRows.filter((row) => row.state === "error").length
  const confirmCount = mainRows.filter((row) => row.state === "confirm").length
  const isResolved = isFilled && errorCount === 0 && confirmCount === 0 && !validationStale

  const renderFieldRow = (row: (typeof fieldRows)[number]): ReactElement => {
    const indicator = rowIndicator(row.state)
    const issue = row.issue
    // Every amber issue is confirmable, whether it came from a medium-confidence mapping or a
    // plausibility flag: confirming accepts the current editor value as the human's decision.
    // Red issues are hard validation errors and must be fixed, not confirmed away.
    const isConfirmable = issue !== null && issue.severity === "amber"
    // Candidate columns are an alternative to a fill, so they only help while the field is still
    // empty. Once filled, the confirm checkbox is the only action left.
    const showCandidates = issue !== null && issue.candidates.length > 0 && row.value.trim() === ""
    // An empty flagged field (a rejected write, or no confident column) is one the human fills by
    // hand: offer a jump-to-field button. A filled amber only needs confirming, not manual entry.
    const needsManualEntry = issue !== null && row.value.trim() === ""
    return (
      <div key={row.fieldId} className="relative border-b border-border last:border-b-0">
        <button
          type="button"
          onClick={() => onSelectField(row.fieldId, row.page)}
          className="flex w-full items-baseline gap-2 px-3 py-1.5 pr-9 text-left hover:bg-accent"
        >
          {row.state === "confirmed" ? (
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 translate-y-px rounded-full"
              style={{ backgroundImage: "linear-gradient(45deg, hsl(var(--valid)) 0 50%, hsl(var(--warn)) 50% 100%)" }}
            />
          ) : (
            <span className={`w-2 shrink-0 text-[10px] ${indicator.className}`}>{indicator.symbol}</span>
          )}
          <span className="w-40 shrink-0 truncate font-mono text-[11px] text-muted-foreground" title={row.fieldName}>
            {row.fieldName}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-foreground" title={row.value}>
            {row.value !== "" ? row.value : <span className="text-muted-foreground/40">—</span>}
          </span>
        </button>
        {isConfirmable ? (
          <button
            type="button"
            onClick={() => onConfirmMapping(row.fieldId)}
            title="Confirm this fill"
            aria-label="Confirm this fill"
            className="absolute right-2 top-1.5 flex h-5 w-5 items-center justify-center rounded-[4px] border border-warn text-[11px] text-warn transition-colors hover:border-valid hover:bg-valid/10 hover:text-valid"
          >
            ✓
          </button>
        ) : null}
        {row.sourceColumn !== null && row.value.trim() !== "" ? (
          <p className="px-3 pb-1 pt-1 pl-9 font-mono text-[10px] text-muted-foreground">
            from{" "}
            {row.fromNote !== null ? (
              <span className="text-warn">
                {row.sourceColumn} ({row.fromNote})
              </span>
            ) : (
              row.sourceColumn
            )}
          </p>
        ) : null}
        {issue !== null && (issue.message !== "" || showCandidates || needsManualEntry) ? (
          <div className="flex flex-col gap-1.5 px-3 pb-2 pl-9">
            {issue.message !== "" ? (
              <p className={`pt-1 text-xs ${issue.severity === "red" ? "text-error" : "text-warn"}`}>{issue.message}</p>
            ) : null}
            {showCandidates || needsManualEntry ? (
              <div className="flex flex-wrap items-center gap-1">
                {issue.candidates.map((candidate) => (
                  <button
                    key={candidate.column}
                    type="button"
                    onClick={() => onApplyCandidate(issue, candidate.column)}
                    className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-brand hover:text-foreground"
                  >
                    {candidate.column} {Math.round(candidate.probability * 100)}%
                  </button>
                ))}
                {needsManualEntry ? (
                  <button
                    type="button"
                    onClick={() => onSelectField(row.fieldId, row.page)}
                    className="rounded border border-foreground/60 bg-transparent px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-foreground/10"
                  >
                    Fill manually
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <aside className="flex h-full w-full flex-col gap-5 overflow-y-auto border-r border-border bg-background p-5">
      <FormGallery forms={forms} activeFormId={activeFormId} onSelectForm={onSelectForm} disabled={isBusy} />

      {isResolved ? (
        <Button onClick={onFinalize} className="w-full bg-valid text-white hover:bg-valid/90">
          Download filled PDF
        </Button>
      ) : (
        <Button onClick={onFillAndValidate} disabled={!canFillAndValidate} className="w-full">
          {isBusy ? "Working…" : primaryActionLabel(primaryAction(fields, confirmedFieldIds))}
        </Button>
      )}

      {errorMessage !== null ? (
        <p className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">{errorMessage}</p>
      ) : null}

      {timingPhase !== null || fillMs !== null || classifyMs !== null ? (
        <Timing phase={timingPhase} fillMs={fillMs} classifyMs={classifyMs} />
      ) : null}

      {record !== null && !isFilled ? (
        <section className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Record</span>
          <div className="flex flex-col rounded-md border border-border">
            {record.columns.map((column) => (
              <div key={column} className="flex items-baseline gap-2 border-b border-border px-3 py-2 last:border-b-0">
                <span className="w-40 shrink-0 truncate font-mono text-xs text-muted-foreground">{column}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-foreground" title={record.values[column] ?? ""}>
                  {record.values[column]}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {isFilled ? (
        <>
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Fields · {mainRows.length}
              </span>
              <span className="text-xs">
                <span className="text-valid">{filledCount} filled</span>
                {errorCount > 0 ? (
                  <>
                    <span className="text-muted-foreground"> · </span>
                    <span className="text-error">
                      {errorCount} {errorCount === 1 ? "error" : "errors"}
                    </span>
                  </>
                ) : null}
                {confirmCount > 0 ? (
                  <>
                    <span className="text-muted-foreground"> · </span>
                    <span className="text-warn">{confirmCount} to confirm</span>
                  </>
                ) : null}
              </span>
            </div>

            {mainRows.length > 0 ? (
              <div className="flex flex-col rounded-md border border-border">{mainRows.map(renderFieldRow)}</div>
            ) : null}
          </section>

          {additionalRows.length > 0 ? (
            <section className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Additional fields · {additionalRows.length}
              </span>
              <div className="flex flex-col rounded-md border border-border">{additionalRows.map(renderFieldRow)}</div>
            </section>
          ) : null}
        </>
      ) : null}

    </aside>
  )
}
