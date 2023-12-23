#!/bin/bash
cd /usr/bin
/usr/bin/flatpak run io.github.unknownskl.greenlight --enable-features=VaapiIgnoreDriverChecks,VaapiVideoDecoder,PlatformHEVCDecoderSupport,CanvasOopRasterization --enable-oop-rasterization --disable-features=UseChromeOSDirectVideoDecoder --enable-accelerated-video-decode --ozone-platform-hint=x11
