import { useTranslation } from 'react-i18next'
import type { FormConfig, FormId, LocaleForms } from '../lib/forms'
import { Dropdown } from './ui/dropdown'

type FormPickerProps = {
  value: FormId
  options: LocaleForms
  onChange: (id: FormId) => void
  disabled?: boolean
}

export const FormPicker = ({ value, options, onChange, disabled = false }: FormPickerProps) => {
  const { t } = useTranslation()
  const orderedForms: FormConfig[] = options.order.map((id) => options.forms[id])
  const selected = options.forms[value] ?? orderedForms[0]
  return (
    <Dropdown<FormConfig>
      label={t('header.useCase')}
      items={orderedForms}
      selectedItem={selected}
      getItemKey={(form) => form.id}
      renderTriggerValue={(form) => t(form.labelKey)}
      renderItem={(form) => (
        <span>
          <span className="block font-medium">{t(form.labelKey)}</span>
          <span className="block text-[11px] text-slate-400">
            {form.id === 'custom' ? t('forms.customSubtitle') : t(form.subtitleKey ?? form.useCaseKey)}
          </span>
        </span>
      )}
      onSelect={(form) => onChange(form.id)}
      disabled={disabled}
      panelWidthClass="w-[280px]"
    />
  )
}
