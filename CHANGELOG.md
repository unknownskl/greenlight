# Changelog

## v2.2.0 - 2024-02-xx
- Added a WebUI option to make Greenlight available over the network. Enables usage of Greenlight on devices with a chromium based webbrowser.
- Adding human readable waiting time when queued for a xCloud stream (credits to @NiccoMaganeli)
- Added a low resolution mode for the Steam Deck to set a lower resolution then 720p for using FSR #1133
- Updated icons #1127 (credits to @el2zay, and thanks for @jxhug for the suggestion)

## v2.1.1 - 2024-01-29
- Fixed controller input not working on default settings #1118 #1117
- Fixed keyboard mapping on certain keyboard layouts #878
- Fixed N button mapping when using the new Gamepad driver in settings

## v2.1.0 - 2024-01-26
- Fix vibration detection #1076 #813 (credits to @LostVector and @opencv4nodejs)
- Revamped the xCloud UI. New overview page with recent played titles and new added games.
- Set default resolution to 1280*800 to fix several scaling issues on Steamdeck
- Experimental support for second controller (Uses same user profile, so multiplayer in some games does not work correctly) #916
- Fix webrtc plots in debug window (credits to @LostVector)

## v2.0.1 - 2023-12-20
- Bump version to align with Flathub Release

## v2.0.0 - 2023-12-20
- Add patch to remove region restriction on xCloud #850 (credits to @pccr10001)
- Device info updated to stream true 1080p feed from xCloud (credits to @FatCache)
- Flatpak manual build script and AMD VAAPI fix (credits to @Originalimoc)
- Now also released on Flathub 🎉

## v2.0.0-beta15 - 2023-11-28
- Updated xal-node library and removed Rust dependencies. Fixes #1000 #898 #899 #815
- Added extra ports to when trying to attempt a new connection. Forward port 9002 to allow remote streaming. #593
- Added MIT license to clear up confusion #992

## v2.0.0-beta14 - 2023-09-20
- Fixed logout and clear data buttons
- Fixed reliability of the nexus menu button
- Fixed chataudio by upgrading to WebRTC tracks #786 #365
- Improved error handling when starting a new stream

## v2.0.0-beta13 - 2023-09-18
- Added support for Free 2 play games on xCloud #918
- Added support for estimated waiting times (Experimental, times may be way off)
- Added (not-tested) experimental flatpak builds #369 #355
- Rewrote stream IPC Communication backend for better data exchange and improved stream handling
- Rewrote all IPC Communications in the frontend code for better portability
- Upgraded electron base from v21 to v26
- Fixed vibration not working since beta 11 #924
- Fixed an issue which prevented the tokens to be loaded properly and results in problems when streaming #896

## v2.0.0-beta12 - 2023-08-30
- Added experimental Touch input support (works on touchscreen only) #404
- Added experimental Mouse & Keyboard support (Mouse is not working in games yet)
- Added new settings to enable and disable input methods.

## v2.0.0-beta11 - 2023-08-25
- Added microphone support (Experimental) #365 #786
- Updated friendslist UI
- Performance improvements for xcloud page
- Updated streaming menu

## v2.0.0-beta10 - 2023-07-26
- Fixed broken login button after starting the app sometimes #815 (again, for real this time)

## v2.0.0-beta9 - 2023-07-18
- Partial backend refactor and improvements to authentication flow. 
- Fixed broken login button after starting the app sometimes #815
- Fixed an issue where the authentication windows keeps loading when trying to login the first time.
- Fixed update notifier for beta releases

## v2.0.0-beta8 - 2023-05-31
- Add --connect=<value> option to start a stream op startup #805 #509 
- Add video zoom option #667 (PR#835, Credits to @adolmarro)
- Fix app not closing on Windows and Linux when using OS close button (PR#843, credits to @kohanyirobert)
- Don't always rebuild xal-node if not necessary (PR#842, credits to @kohanyirobert)
- Added debug graphs in debug window #828
- Added new application icons #351 #787

## v2.0.0-beta7 - 2023-04-11
- Smoothen login experience by saving the login tokens and attempt authentication before popup prompt #782
- Add better description for WNSError #798 #788 #702
- Fixed authentication error on windows by registering url protocol #776 #790

## v2.0.0-beta6 - 2023-03-20
- Fixed startup error on Apple M1 and M2 macs

## v2.0.0-beta5 - 2023-03-19
- Replaced authentication process with xal-rs library to optimise authentication flow
- Save settings to localStorage (PR#769, credits to @kohanyirobert)
- Update bitrate selector/editor (PR#768, credits to @kohanyirobert)

## v2.0.0-beta4 - 2023-03-06
- Added stereo sound output

## v2.0.0-bet3 - 2023-02-10
- Fixed xCloud exchange token error when launching an xCloud game. Fixes #732 & #717 (Credits to `award` on the OpenXbox discord)
- Auto-hide menu bar on fullscreen. (Credits to @Willsie-Digital)
- Fixed UI glitching out when starting a stream which errors out

## v2.0.0-beta2 - 2022-11-04
- Fixed login issue where the website is displayed instead of the login page #425
- Bump xbox-xcloud-player to 0.2.0-beta6
- Implemented improved keyboard support (Credits to @JosephMichels)
- Potentional fix for xcloud promise error #511
- Fixed a display issue with controllers on the settings page #469

## v2.0.0-beta1 - 2022-09-20
- Complete rewrite of application and rebrand to Greenlight
- Updated xbox-xcloud-player to 2.0.0 with low latency streaming and rumble support! (Only xCloud)
- Optimised authentication flow to make it more reliable and faster

## v1.2.0 - 2022-08-09
- Promote beta to official release
- Bump dependencies

## v1.2.0-beta6 - 2022-07-16
- Fix error retrieving xCloud token 'InvalidCountry' #300 (credits to `award` on the OpenXbox discord)
- Fix message 'No friends online' when no friends are online
- Added `--fullscreen` argument to launch app in fullscreen #312
- Added switch `--connect=F400000000000000` argument to auto-connect to a console #312
- Updated dependencies

## v1.2.0-beta5 - 2022-07-06
- Add close button action to the Xbox logo to exit full-screen mode on Steam Deck #280
- Possible fix for number input on Steam Deck #237
- Make video background black #292
- Set user agent to latest Edge version as it seemms to impove quality
- Updated dependencies

## v1.2.0-beta4 - 2022-06-16
- Updated electron to version 19 and other dependencies
- Update xCloud Regions in settings #140
- Added support for Apple Silicon #139

## v1.2.0-beta3 - 2022-05-06
- Update dependencies
- Improve bitrate and enable streaming of Xbox 360 games (credits to `award` on the OpenXbox discord)
- Added an overview of connected gamepads on the settings page
- Added button in streaming view to send the Nexus button press for gamepads that do not support the Xbox button

## v1.2.0-beta2 - 2022-02-05
- Rebuild branch from main and started over
- Updated lots of dependencies to latest version
- Updated xbox-xcloud-player to 1.2.0 with support for channel control v2. Should improve reliability of controls
- Fixed homestreaming only login
- Added experimental region switcher in settings

## v1.2.0-beta1 - 2021-11-19
- Updated lots of dependencies to latest version
- Changed the login flow of the application and removed the popup

## v1.1.0 - 2021-10-15
- Added link to MS Flight Simulator wiki page
- Enable Dialog support only in stream configuration
- Enable menu bar on windows to access plugin controls

## v1.1.0-beta4 - 2021-10-09
- Added a update notifier for new updates
- Added keyboard controls for right trigger, left trigger, view and menu button
- Open a popup for authentication for quicker access
- WebUI (beta) stream now opens in full screen
- Fixed modal ui not sending the correct response

## v1.1.0-beta3 - 2021-09-24
- Added support for Opentrack
- Added an option to expose a WebUI to start streams on other devices 

## v1.1.0-beta2 - 2021-09-17
- Implemented xbox-xcloud-player for improved rendering performance
- Improved gamepad responsiveness
- Updated xCloud UI with a better looking library

## v1.1.0-beta1 - 2021-09-14
- xCloud support!
- Cleanup stream timers and intervals when disconnecting from a stream
- Fixed left and right audio channels #30 (Fix credits: @tuxuser)

## v1.0.3 -  2021-09-07
- Add AppImage format for Linux

## v1.0.2 -  2021-08-25
- Improved feedback for connection errors
- Added experimental bitrate control in the debug menu while streaming

## v1.0.1 -  2021-08-03
- Bump dependencies to newer versions
- Fixed an error when logging in using a dev build

## v1.0.0 -  2021-07-30
- First public release