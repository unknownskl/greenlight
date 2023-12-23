#!/bin/bash
cd /usr/bin
/usr/bin/flatpak run dev.unknownskl.greenlight --use-vulkan --use-angle=vulkan --enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan,VaapiIgnoreDriverChecks,VaapiVideoDecoder,PlatformHEVCDecoderSupport,CanvasOopRasterization --enable-oop-rasterization --disable-features=UseChromeOSDirectVideoDecoder --enable-accelerated-video-decode --ozone-platform-hint=x11 --gtk-version=4 --no-sandbox
