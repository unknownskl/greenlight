#!/bin/bash
cd /usr/bin
/usr/bin/flatpak run dev.unknownskl.greenlight --enable-features=CanvasOopRasterization,VaapiVideoDecoder,VaapiVideoDecodeLinuxGL,VaapiIgnoreDriverChecks,PlatformHEVCDecoderSupport --use-cmd-decoder=passthrough --ignore-gpu-blocklist --enable-zero-copy --enable-gpu-rasterization --enable-native-gpu-memory-buffers --enable-gpu-memory-buffer-video-frames --disable-features=UseChromeOSDirectVideoDecoder --no-sandbox --use-vulkan
