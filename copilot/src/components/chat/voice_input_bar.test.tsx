// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VoiceInputBar } from './voice_input_bar'

const noop = (): void => {}

const renderBar = (status: 'armed' | 'recording' | 'transcribing') =>
  render(
    <VoiceInputBar
      status={status}
      level={[0.2, 0.6]}
      elapsedMs={3_000}
      destination={null}
      onRecord={noop}
      onStop={noop}
      onCancel={noop}
    />,
  )

describe('VoiceInputBar', () => {
  it('armed: record + cancel controls, no waveform', () => {
    const { getAllByRole, queryByRole } = renderBar('armed')
    expect(getAllByRole('button')).toHaveLength(2)
    expect(queryByRole('img')).toBeNull()
  })

  it('recording: stop + cancel controls and the waveform image', () => {
    const { getAllByRole, getByRole } = renderBar('recording')
    expect(getAllByRole('button')).toHaveLength(2)
    expect(getByRole('img')).toBeTruthy()
  })

  it('transcribing: only the cancel control remains', () => {
    const { getAllByRole, queryByRole } = renderBar('transcribing')
    expect(getAllByRole('button')).toHaveLength(1)
    expect(queryByRole('img')).toBeNull()
  })

  it('fires the wired callbacks on click', () => {
    const onStop = vi.fn()
    const onCancel = vi.fn()
    const { getAllByRole } = render(
      <VoiceInputBar
        status="recording"
        level={[]}
        elapsedMs={0}
        destination={null}
        onRecord={noop}
        onStop={onStop}
        onCancel={onCancel}
      />,
    )
    const [stopButton, cancelButton] = getAllByRole('button')
    if (stopButton !== undefined) {
      fireEvent.click(stopButton)
    }
    if (cancelButton !== undefined) {
      fireEvent.click(cancelButton)
    }
    expect(onStop).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
