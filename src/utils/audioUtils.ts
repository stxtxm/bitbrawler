let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    return audioCtx;
}

type SoundType = 'hit' | 'crit' | 'magic' | 'miss' | 'counter';

function playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'square',
    volume = 0.15,
    slide = 0,
) {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) {
        osc.frequency.linearRampToValueAtTime(freq + slide, ctx.currentTime + duration);
    }
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
}

function playNoise(duration: number, volume = 0.08) {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(ctx.currentTime);
}

export function playSound(type: SoundType) {
    try {
        switch (type) {
            case 'hit':
                playTone(200, 0.08, 'square', 0.12);
                playNoise(0.06, 0.06);
                break;
            case 'crit':
                playTone(600, 0.12, 'square', 0.15);
                playTone(900, 0.1, 'square', 0.1, -200);
                playNoise(0.08, 0.08);
                break;
            case 'magic':
                playTone(400, 0.15, 'triangle', 0.1, 300);
                playTone(700, 0.1, 'triangle', 0.07, -200);
                break;
            case 'miss':
                playTone(120, 0.06, 'square', 0.06);
                playNoise(0.05, 0.04);
                break;
            case 'counter':
                playTone(500, 0.08, 'square', 0.14);
                playTone(1000, 0.06, 'square', 0.1, -400);
                break;
        }
    } catch {
        // Audio not available
    }
}
