// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TranscriptionDestination } from '../../lib/voice/resolve_capability'
import { VoiceInputBar } from './voice_input_bar'

const noop = (): void => {}

const renderBar = (status: 'recording' | 'transcribing', destination?: TranscriptionDestination | null) =>
  render(
    <VoiceInputBar
      status={status}
      level={[0.2, 0.6]}
      elapsedMs={3_000}
      destination={destination ?? null}
      onStop={noop}
      onCancel={noop}
    />,
  )

describe('VoiceInputBar', () => {
  it('recording: prompt, waveform, and stop + cancel controls', () => {
    const { getAllByRole, getByRole, getByText } = renderBar('recording')
    expect(getAllByRole('button')).toHaveLength(2)
    expect(getByRole('img')).toBeTruthy()
    // Recipient prompt occupies the textarea row before the user commits (audio egresses on ✓).
    expect(getByText('voice.promptDemo')).toBeTruthy()
  })

  it('names the actual audio recipient per destination', () => {
    expect(renderBar('recording', { kind: 'openai-byok' }).getByText('voice.promptOpenaiByok')).toBeTruthy()
    expect(
      renderBar('recording', { kind: 'custom-byok', host: 'example.com' }).getByText(
        'voice.promptCustomByok',
      ),
    ).toBeTruthy()
  })

  it('transcribing: keeps the prompt (no layout shift) with only the cancel control and no waveform', () => {
    const { getAllByRole, queryByRole, getByText } = renderBar('transcribing')
    expect(getAllByRole('button')).toHaveLength(1)
    expect(queryByRole('img')).toBeNull()
    expect(getByText('voice.promptDemo')).toBeTruthy()
  })

  it('fires onStop and onCancel from the recording controls', () => {
    const onStop = vi.fn()
    const onCancel = vi.fn()
    const { getByRole } = render(
      <VoiceInputBar
        status="recording"
        level={[]}
        elapsedMs={0}
        destination={null}
        onStop={onStop}
        onCancel={onCancel}
      />,
    )
    fireEvent.click(getByRole('button', { name: 'voice.stopLabel' }))
    fireEvent.click(getByRole('button', { name: 'voice.cancelLabel' }))
    expect(onStop).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
