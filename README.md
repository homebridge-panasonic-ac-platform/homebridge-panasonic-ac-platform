<img src="https://raw.githubusercontent.com/homebridge/verified/latest/icons/homebridge-panasonic-ac-platform.png" width="100px"></img>

# Homebridge Panasonic AC Platform

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![Downloads](https://img.shields.io/npm/dt/homebridge-panasonic-ac-platform)](https://www.npmjs.com/package/homebridge-panasonic-ac-platform)
[![GitHub version](https://img.shields.io/github/package-json/v/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform?label=GitHub)](https://github.com/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform/releases)
[![npm version](https://img.shields.io/npm/v/homebridge-panasonic-ac-platform?color=%23cb3837&label=npm)](https://www.npmjs.com/package/homebridge-panasonic-ac-platform)

`homebridge-panasonic-ac-platform` is a dynamic platform plugin for [Homebridge](https://homebridge.io) which provides HomeKit support for Panasonic Comfort Cloud devices (such as single and multi-split air conditioning systems).

## How it works
The plugin communicates with your devices through the Comfort Cloud service. This means you must have a Comfort Cloud account (Panasonic ID) and your units must be registered and set up there before you can use this plugin.

All devices that are set up on your Comfort Cloud account will appear in Homebridge and via HomeKit in your Home app (or other HomeKit app). If you remove a device from your Comfort Cloud account, it will also disappear from your Homebridge and HomeKit app after you restart Homebridge (unless you have the option to 'keep accessories of uninstalled plugins' selected in Homebridge settings). 

## Comfort Cloud account (Panasonic ID)

- Register and manage your Panasonic ID (used to manage Comfort Cloud) via app (iOS / Android) or browser [Panasonic ID](https://csapl.pcpf.panasonic.com).
- From January 2024, Panasonic requires 2FA (Two Factor Authentication), you can choose: the code or SMS - the recommended choice is the code.
- Instructions on how to create a [dual-account setup](https://github.com/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform/blob/master/docs/dual-account-setup.md).

## Install plugin

This plugin can be easily installed and configured through Homebridge UI or via [NPM](https://www.npmjs.com/package/homebridge-panasonic-ac-platform) "globally" by typing:

    npm install -g homebridge-panasonic-ac-platform

## Homebridge setup
Configure the plugin through the settings UI or directly in the JSON editor.

Basic settings (required):

```json
{
  "platforms": [
    {
        "platform": "Panasonic AC Platform",
        "name": "Homebridge Panasonic AC Platform",
        "email": "mail@example.com",
        "password": "********"
    }
  ]
}
```

- `platform` (string): Tells Homebridge which platform this config belongs to. Leave as is.
- `name` (string): Will be displayed in the Homebridge log.
- `email` (string): The username of your Comfort Cloud (Panasonic ID) account.
- `password` (string): The password of your Comfort Cloud (Panasonic ID) account.

<details>
<summary><b>Advanced configuration</b></summary>

Example:

```json
{
  "platforms": [
    {
        "platform": "Panasonic AC Platform",
        "name": "Homebridge Panasonic AC Platform",
        "email": "mail@example.com",
        "password": "********",
        "key2fa": "GVZCKT2LLBLV2QBXMFAWFXKFKU5EWL2H",
        "autoMode": "auto",
        "oscilateSwitch": "swing",
        "startSwing": false,
        "startNanoe": false,
        "startEcoNavi": false,
        "startInsideCleaning": false,
        "refreshInterval": 60,
        "excludeDevices": "",
        "exposeOutdoorUnit": true,
        "minHeatingTemperature": 16,    
        "appVersionOverride": "1.20.0",
        "suppressOutgoingUpdates": false, 
        "logsLevel": 0
    }
  ]
}
```

* `key2fa` (string): 
2FA key received from Panasonic (32 characters). Example: GVZCKT2LLBLV2QBXMFAWFXKFKU5EWL2H. Note: This field is currently not required to make this plugin work, but Panasonic already requires 2FA (code or SMS, recommended code) to log in to Comfort Cloud, so it may be required soon.

* `autoMode` (string):
Choose what mode to be turned on after selecting the Auto mode in HomeKit: Fan mode, Dry mode or Auto mode (by default).

* `oscilateSwitch` (string):
Decide what the switch should control: Swing Mode, Nanoe, Eco Navi or Inside Cleaning.

* `startSwing` (string):
Swing value with each state change made with Homekit (e.g. activation): do nothing, set on, set off.

* `startNanoe` (string):
Nanoe value with each state change made with Homekit (e.g. activation): do nothing, set on, set off.

* `startEcoNavi` (string):
Eco Navi value with each state change made with Homekit (e.g. activation): do nothing, set on, set off.

* `startInsideCleaning` (string):
InsideCleaning value with each state change made with Homekit (e.g. activation): do nothing, set on, set off.

* `refreshInterval` (integer):
Note: More frequent refresh would result in too much daily number of requests to the Panasonic server, which could result in an account lock for 24 hours, or even a complete API lock.

* `excludeDevices` (string): 
By default this plugin will add all devices from Comfort Cloud. To exclude one or more, put comma separated names or serial numbers of devices, E.G.: 'CS-Z50VKEW+4962605183,Bedroom AC,CS-Z50VKEW+4962605184,My AC unit'. 

* `exposeOutdoorUnit` (boolean):
If `true`, the plugin will create a separate accessory for your outdoor unit which will display the (outdoor) temperature it measures. This can be used for monitoring and automation purposes.

* `minHeatingTemperature` (integer):
The default heating temperature range is 16-30°C. Some Panasonic ACs have an additional heating mode for the range of 8-15°C. If you own such a model, you can use this setting to adjust the minimum value. Leave it empty or undefined to use the default value.

* `suppressOutgoingUpdates` (boolean):
If `true`, changes in the Home app will not be sent to Comfort Cloud. Useful for testing your installation without constantly switching the state of your AC to minimise wear and tear.

* `appVersionOverride` (string):
The plugin will automatically use the last known working value when this setting is empty or undefined (default). This setting allows you to override the default value if needed. It should reflect the latest version on the App Store, although older clients might remain supported for some time.

* `logsLevel` (integer):
Logs level. 0 - only errors and important info, 1 - standard,2 - all (including debug).

</details>

## Mode (Heat, Cool etc.)

HomeKit has only 3 modes: Auto, Cool, Heat but Panasonic additionally has Fan and Dry. Choose what mode to be turned on after selecting the Auto mode in HomeKit: Fan mode, Dry mode or Auto mode (by default). Everytime When a mode other than Heat or Cool is selected in the Panasonic application or using the remote control, the Auto mode will be enabled in HomeKit.

## Rotation speed (including Quiet Mode, Powerful Mode)

The Home app offers no extra buttons for the Quiet and Powerful Modes. All settings related to a unit's fan speed are controlled through the fan speed slider. The following mapping applies:

| Home app slider position  | Comfort Cloud setting |
| ------------------------: | --------------------- |
| (leftmost) 0              | Device off            |
| 1                         | Quiet mode            |
| 2                         | Fan speed: 1          |
| 3                         | Fan speed: 2          |
| 4                         | Fan speed: 3          |
| 5                         | Fan speed: 4          |
| 6                         | Fan speed: 5          |
| 7                         | Powerful mode         |
| (rightmost) 8             | Auto                  |

## Oscillate Switch

HomeKit has only one 'Oscillate' switch, but most Panasonic ACs have more options: Nanoe, Eco Navi, Inside Cleaning and Swing mode have two swing directions. Decide what the switch should control.

## Swing modes

Homekit doesn't have so many switches to support all Swing modes. That's why here you can choose how it works.

* The setting `Swing Directions` (`swingModeDirections` in the JSON config) controls which swing direction(s) will be activated when 'Oscillate' is switched on.

* The setting `Swing Mode Default Position (Left-Right)` (`swingModeDefaultPositionLeftRight` in the JSON config) controls the desired position of the Left-Right flaps when 'Oscillate' is switched off or the swing directions setting (see above) is "Up-Down only".

* The setting `Swing Mode Default Position (Up-Down)` (`swingModeDefaultPositionUpDown` in the JSON config) controls the desired position of the Up-Down flaps when 'Oscillate' is switched off or the swing directions setting (see above) is "Left-Right only".

## Override values

Values with each state change made with Homekit (e.g. activation). For Swing Mode, Nanoe, Eco Navi and Inside Cleaning. Available options: do nothing, set on, set off.

## Troubleshooting

- If the plugin does not work correctly:
   - Make sure that you can successfully log in and control each device via Panasonic Comfort Cloud application.
   - Make  sure that you accept all terms, conditions, etc in Panasonic Comfort Cloud app.
   - Make sure you have newest plugin version.
   - Make sure that field Comfort Cloud app version (in plugin settings) is empty or have newest Comfort Cloud app version (same as in Apple App Store).
   - Disconnect each Comfort Cloud device (like AC) from the power and turn it on again (or restart WiFi in them), restart routers, restart Homebridge.
   - Set Logs Level to all (in plugin config) and enable debug mode (in Homebridge settings) and restart Homebridge / child bridge. This will include more detailed information in the log.
- It's recommended you run this plugin as a [child bridge](https://github.com/homebridge/homebridge/wiki/Child-Bridges).

## Contributing and support

- Test/use the plugin and [report issues and share feedback](https://github.com/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform/issues).
- Contribute with your own bug fixes, code clean-ups, or additional features - [Pull Request](https://github.com/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform/pulls).
- See more: [contributing-collaborators.md](https://github.com/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform/blob/master/docs/contributing-collaborators.md). 

## Acknowledgements
- Thanks to [embee8](https://github.com/embee8) for creating this plugin.
- Thanks to [codyc1515](https://github.com/codyc1515) for creating and maintaining [homebridge-panasonic-air-conditioner](https://github.com/codyc1515/homebridge-panasonic-air-conditioner), which served as motivation for this platform plugin and proved particularly helpful in determining API request/response payloads.
- Thanks to the team behind Homebridge. Your efforts do not go unnoticed.

## Disclaimer
- All product and company names are trademarks™ or registered® trademarks of their respective holders. Use of them does not imply any affiliation with or endorsement by them.
- This is not the official Panasonic plugin.
- The plugin uses the official Panasonic API used to support official applications for iOS and Android.
- Panasonic has not provided an official API to support external plugins, so this method may stop working at any time.
- Homebridge connect via Internet with Comfort Cloud (Panasonic platform), this solution does not work locally.
- Alternatives: 
    - Local access, but this requires reworking of the equipment, which will lose the warranty, so rather not recommended.
    - Control by IR (imitates an IR remote control), but it only allows you to send commands (not possible to read the state). Examples:
        - Aqara Hub M2 or M3. This Hub will directly exposes IR to Homekit. You need to create scene in Aqara app for every IR command, for IR commands scenes are the only way to sync to HomeKit.
        - Broadlink RM4 Mini or Pro. They work as WiFi devices. You need to install Homebridge plugin ([homebridge-broadlink-rm](https://github.com/kiwi-cam/homebridge-broadlink-rm)) to work with this. For every command there will be separate accessory in HomeKit.
        - Any Zigbee IR blaster. You can easily add Zigbee support to Homebridge. Just connect the Conbee stick, enable the support in hb-config (Extra packages / deCONZ), install the appropriate plugin (E.G.: [homebridge-deconz](https://github.com/ebaauw/homebridge-deconz)) and add the selected IR blaster.
- Despite the efforts made, the operation of the plugin is without any guarantees and at your own risk.

