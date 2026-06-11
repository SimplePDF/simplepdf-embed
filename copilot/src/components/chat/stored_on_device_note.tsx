import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

// Shared BYOK key-storage disclosure, rendered just above the action buttons on
// both the Chat and Speech-to-Text tabs (both keys live in the same on-device
// vault). One owner so the copy + styling stay identical across tabs.
export const StoredOnDeviceNote = (): ReactElement => {
  const { t } = useTranslation()
  return (
    <div className="rounded-md border border-sky-100 bg-sky-50 p-3 text-[11px] text-sky-900">
      <div className="font-semibold">{t('chat.modelPicker.byokSecurityTitle')}</div>
      <p className="mt-1 leading-relaxed">{t('chat.modelPicker.byokSecurityBody')}</p>
    </div>
  )
}
