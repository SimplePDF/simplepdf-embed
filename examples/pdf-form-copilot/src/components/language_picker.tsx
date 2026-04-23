import { useTranslation } from 'react-i18next'
import { filterLanguages, getLanguageByCode, LANGUAGES, type Language } from '../lib/languages'
import { Dropdown } from './dropdown'

type LanguagePickerProps = {
  value: string
  onChange: (code: string) => void
  disabled?: boolean
}

export const LanguagePicker = ({ value, onChange, disabled = false }: LanguagePickerProps) => {
  const { t } = useTranslation()
  const selected = getLanguageByCode(value) ?? LANGUAGES[0]
  return (
    <Dropdown<Language>
      label={t('languagePicker.label')}
      items={LANGUAGES}
      selectedItem={selected}
      getItemKey={(language) => language.code}
      renderTriggerValue={(language) => language.label}
      renderItem={(language) => (
        <span>
          {language.label}
          <span className="ml-2 text-[11px] text-slate-400">{language.native}</span>
        </span>
      )}
      onSelect={(language) => onChange(language.code)}
      disabled={disabled}
      search={{
        placeholder: t('languagePicker.search'),
        filter: filterLanguages,
        noMatchesLabel: t('languagePicker.noMatches'),
      }}
    />
  )
}
