export const defaultSettings = {
    xhome_bitrate: 0,
    xcloud_bitrate: 0,
    xcloud_show_non_entitled: true,
    video_profiles: [],
    preferred_game_language: 'en-US',
    controller_vibration: true,
    video_size: 'default',
    force_region_ip: '',

    // Remote play (xHome streaming from outside the home network).
    // The port on your public IP that is forwarded to the console (the console itself always listens on 9002).
    // `remote_port` is the default, `remote_port_consoles` overrides it per console id: { [consoleId]: port }
    remote_port: 9002,
    remote_port_consoles: {},

    // Control the Greenlight menus with a gamepad (d-pad / stick, A, B, LB / RB)
    gamepad_navigation: true,

    input_touch: false,
    input_mousekeyboard: false,
    input_mousekeyboard_config: {
        ArrowLeft: 'DPadLeft',
        ArrowUp: 'DPadUp',
        ArrowRight: 'DPadRight',
        ArrowDown: 'DPadDown',

        Enter: 'A',
        a: 'A',

        Backspace: 'B',
        b: 'B',

        x: 'X',
        y: 'Y',

        '[': 'LeftShoulder',
        ']': 'RightShoulder',

        '-': 'LeftTrigger',
        '=': 'RightTrigger',

        v: 'View',
        m: 'Menu',
        n: 'Nexus',
    },
    input_newgamepad: false,

    // Keyboard and mouse that act as a gamepad (WASD = left stick, mouse = right stick, ...)
    // Speed of the mouse in the Mouse & Keyboard mode (1 = the speed of the player)
    input_mouse_sensitivity: 1,
    input_kbm_emulation: false,
    input_kbm_sensitivity: 1,
    app_lowresolution: false,
    // The Alt key shows the menu bar (File / Edit / View / Window): for desktop use, it gets in the way while playing
    app_menubar_alt: false,

    video_enabled: true,
    audio_enabled: true,

    // On-screen translator (reads text from a region of the stream and shows a translation)
    translator_enabled: false,
    translator_source_lang: 'en',
    translator_target_lang: 'uk',
    translator_text_color: 'light',
    // Size of the translated text follows the size of the original text (translator_font_size is used when this is off)
    translator_font_auto: true,
    translator_font_size: 26,
    translator_opacity: 0.85,
    translator_region: { x: 0.2, y: 0.78, w: 0.6, h: 0.16 },

    // WebUI
    webui_autostart: false,
    webui_port: 9003,

    // Selected language for i18n
    language: 'en-US',
}
