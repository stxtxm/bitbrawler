// Simple seeded random number generator
export const mulberry32 = (a: number) => {
    return () => {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

export const getSeedFromText = (text: string): number => {
    let seedNum = 0;
    for (let i = 0; i < text.length; i++) {
        seedNum += text.charCodeAt(i);
    }
    return seedNum;
};
