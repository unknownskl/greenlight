# Changelog

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