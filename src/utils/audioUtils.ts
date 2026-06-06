let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    return audioCtx;
}

type SoundType = 'hit' | 'crit' | 'magic' | 'miss' | 'counter' | string;

function playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'square',
    volume = 0.15,
    slide = 0,
    delay = 0,
) {
    try {
        const ctx = getCtx();
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        const t = ctx.currentTime + delay;
        osc.frequency.setValueAtTime(freq, t);
        if (slide) {
            osc.frequency.linearRampToValueAtTime(freq + slide, t + duration);
        }
        gain.gain.setValueAtTime(volume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + duration);
    } catch {
        // ignore
    }
}

function playNoise(duration: number, volume = 0.08, delay = 0) {
    try {
        const ctx = getCtx();
        if (ctx.state === 'suspended') ctx.resume();

        const bufferSize = Math.ceil(ctx.sampleRate * duration);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const gain = ctx.createGain();
        const t = ctx.currentTime + delay;
        gain.gain.setValueAtTime(volume * 0.5, t + 0.001);
        gain.gain.exponentialRampToValueAtTime(volume, t + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3000, t);
        filter.frequency.exponentialRampToValueAtTime(200, t + duration);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        source.start(t);
    } catch {
        // ignore
    }
}

export function playSound(type: SoundType) {
    switch (type) {
        case 'hit': {
            // Sharp punch: noise burst + low thump
            playNoise(0.05, 0.12);
            playTone(150, 0.06, 'square', 0.1);
            playTone(80, 0.04, 'sine', 0.08, 20);
            break;
        }
        case 'crit': {
            // Heavy critical: louder noise + two tones + high spark
            playNoise(0.07, 0.18);
            playTone(200, 0.08, 'square', 0.14);
            playTone(300, 0.06, 'square', 0.1, 200);
            playTone(1200, 0.04, 'sine', 0.06, -400, 0.03);
            break;
        }
        case 'magic': {
            // Magic whoosh: rising triangle + sparkle
            playTone(350, 0.12, 'triangle', 0.08, 450);
            playTone(800, 0.08, 'sine', 0.05, -300, 0.06);
            playTone(1400, 0.03, 'sine', 0.04, 0, 0.1);
            break;
        }
        case 'miss': {
            // Whiff: short airy noise + low blip
            playNoise(0.04, 0.04);
            playTone(100, 0.03, 'sine', 0.04);
            break;
        }
        case 'counter': {
            // Sharp deflection: metallic ping + quick rise
            playNoise(0.03, 0.1);
            playTone(800, 0.05, 'square', 0.12, -500);
            playTone(1500, 0.03, 'sine', 0.07, -800, 0.02);
            break;
        }
    }
}
