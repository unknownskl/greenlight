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
    app_lowresolution: false,

    video_enabled: true,
    audio_enabled: true,

    // WebUI
    webui_autostart: false,
    webui_port: 9003,

    // Selected language for i18n
    language: 'en-US',
}
