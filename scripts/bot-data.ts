export const BOT_NAMES = [
    "GLITCH_01", "PIXEL_KING", "BYTE_WARRIOR", "RETRO_ROBOT",
    "CRT_MONSTER", "VGA_VILLAIN", "CONSOLE_KID", "RAM_STACKER",
    "CPU_OVERLOAD", "SEGA_SAM", "NIN_TENDO", "GAME_OVER",
    "INSERT_COIN", "PRESS_START", "HIGH_SCORE", "LEVEL_UP",
    "8BIT_HERO", "MEMORY_LEAK", "SYNTAX_ERR", "NULL_PTR",
    "BINARY_BOY", "HEX_MASTER", "STACK_FLOW", "DATA_MINER",
    "CHIP_TUNE", "MIDI_MAKER", "SPRITE_SHEET", "THE_BUG"
];

export const BOT_LEVEL_TARGETS = [
    { minLevel: 1, count: 5 },  // Maintain 5 level 1 bots
    { minLevel: 5, count: 3 },  // Maintain 3 level 5+ bots
    { minLevel: 10, count: 2 }, // Maintain 2 level 10+ bots
];
