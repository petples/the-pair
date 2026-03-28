let audioContext: AudioContext | null = null
let audioAvailable = true

function getAudioContext(): AudioContext | null {
  if (!audioAvailable) return null
  if (!audioContext) {
    try {
      audioContext = new AudioContext()
    } catch {
      audioAvailable = false
      return null
    }
  }
  return audioContext
}

export function playFinishChime(): void {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const masterGain = ctx.createGain()
    masterGain.gain.value = 0
    masterGain.connect(ctx.destination)

    const notes = [523.25, 659.25]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const noteGain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.value = freq

      noteGain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18)
      noteGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + i * 0.18 + 0.02)
      noteGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.35)

      osc.connect(noteGain)
      noteGain.connect(masterGain)

      osc.start(ctx.currentTime + i * 0.18)
      osc.stop(ctx.currentTime + i * 0.18 + 0.4)
    })

    const delayNode = ctx.createDelay(1)
    delayNode.delayTime.value = 0.12
    const feedback = ctx.createGain()
    feedback.gain.value = 0.25
    const delayInput = ctx.createGain()
    const delayOutput = ctx.createGain()
    delayInput.gain.value = 0.15
    delayOutput.gain.value = 0.15

    masterGain.connect(delayInput)
    delayInput.connect(delayNode)
    delayNode.connect(feedback)
    delayNode.connect(delayOutput)
    feedback.connect(delayNode)
    delayOutput.connect(ctx.destination)
  } catch {
    audioAvailable = false
  }
}

if (typeof document !== 'undefined') {
  const resumeAudio = () => {
    if (audioContext?.state === 'suspended') {
      void audioContext.resume()
    }
  }
  document.addEventListener('click', resumeAudio, { once: true })
  document.addEventListener('keydown', resumeAudio, { once: true })
}
