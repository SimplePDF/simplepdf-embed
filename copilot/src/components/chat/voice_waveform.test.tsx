// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VoiceWaveform } from './voice_waveform'

describe('VoiceWaveform', () => {
  it('exposes a single labelled image and formats the m:ss timer', () => {
    const { getByRole, getByText } = render(
      <VoiceWaveform level={[0.1, 0.5, 0.3]} elapsedMs={65_000} ariaLabel="Microphone input level" />,
    )
    expect(getByRole('img').getAttribute('aria-label')).toBe('Microphone input level')
    expect(getByText('1:05')).toBeTruthy()
  })

  it('renders a fixed bar count regardless of how many samples arrived', () => {
    const { container } = render(<VoiceWaveform level={[]} elapsedMs={0} ariaLabel="x" />)
    expect(container.querySelectorAll('[aria-hidden="true"] > div')).toHaveLength(48)
  })
})
