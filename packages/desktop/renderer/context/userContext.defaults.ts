export const defaultSettings = {
    xhome_bitrate: 0,
    xcloud_bitrate: 0,
    xcloud_show_non_entitled: true,
    video_profiles: [],
    preferred_game_language: 'en-US',
    controller_vibration: true,
    video_size: 'default',
    // Requested stream resolution (vertical pixels): 720, 1080 or 1440
    video_resolution: 1080,
    // Frame rate limit: 0 = no limit (server default, usually 60), or e.g. 30
    video_framerate: 0,
    // Generate in-between frames when the stream is ~30 fps (adds ~1 frame of latency)
    video_motion_smoothing: false,
    force_region_ip: '',
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
    // Gamepad remapping: { XboxButton: physicalButtonIndex }. Empty = default layout
    controller_mapping: {},

    // Network interface used for the stream connection: 'nat' (system default), 'wifi' or 'lan'
    network_interface: 'nat',
    app_lowresolution: false,

    video_enabled: true,
    audio_enabled: true,

    // WebUI
    webui_autostart: false,
    webui_port: 9003,

    // Selected language for i18n
    language: 'en-US',
}
