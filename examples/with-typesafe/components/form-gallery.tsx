"use client"

import type { ReactElement } from "react"
import type { FormDefinition } from "@/lib/forms"

type FormGalleryProps = {
  forms: FormDefinition[]
  activeFormId: string
  onSelectForm: (form: FormDefinition) => void
  disabled: boolean
}

export const FormGallery = ({ forms, activeFormId, onSelectForm, disabled }: FormGalleryProps): ReactElement => (
  <section className="flex flex-col gap-2">
    <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Form</span>
    <div className="grid grid-cols-2 gap-2">
      {forms.map((form) => {
        const isActive = form.id === activeFormId
        return (
          <button
            key={form.id}
            type="button"
            onClick={() => onSelectForm(form)}
            disabled={disabled}
            className={`flex flex-col gap-1 rounded-md border p-3 text-left transition-colors disabled:opacity-50 ${
              isActive ? "border-brand bg-accent" : "border-border hover:border-muted-foreground"
            }`}
          >
            <span className="text-sm font-medium text-foreground">{form.label}</span>
            <span className="text-xs text-muted-foreground">{form.description}</span>
          </button>
        )
      })}
    </div>
  </section>
)
