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

See: [advanced config](https://github.com/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform/blob/master/docs/config.md).



## Fan speed, Quiet Mode, Powerful Mode

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

## Troubleshooting

- If you have any issues with this plugin, please enable debug mode (in both the plugin and homebridge settings) and restart homebridge / child bridge. This will include more detailed information in the log.
- If you run into login errors despite using the correct login details, make sure you accepted the latest terms and conditions after logging into the Comfort Cloud app.
- It's recommended you run this plugin as a [child bridge](https://github.com/homebridge/homebridge/wiki/Child-Bridges).

## Contributing and support

- Test/use the plugin and [report issues and share feedback](https://github.com/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform/issues).
- Contribute with your own bug fixes, code clean-ups, or additional features - [Pull Request](https://github.com/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform/pulls).
- See more: [contributing-collaborators.md](https://github.com/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform/blob/master/docs/contributing-collaborators.md). 

## Acknowledgements
- Thanks to [codyc1515](https://github.com/codyc1515) for creating and maintaining [homebridge-panasonic-air-conditioner](https://github.com/codyc1515/homebridge-panasonic-air-conditioner), which served as motivation for this platform plugin and proved particularly helpful in determining API request/response payloads.
- Thanks to the team behind Homebridge. Your efforts do not go unnoticed.

## Disclaimer
- All product and company names are trademarks™ or registered® trademarks of their respective holders. Use of them does not imply any affiliation with or endorsement by them.
- This is not the official Panasonic plugin.
- The plugin uses the official Panasonic API used to support official applications for iOS and Android. Homebridge connect via Internet with Comfort Cloud (Panasonic platform), this solution does not work locally. Panasonic has not provided an official API to support external plugins, so this method may stop working at any time (Panasonic updates its API quite often, E.G. in January 2024, Panasonic introduced two-factor authentication). Alternatives: 
    - Local access, but this requires reworking of the equipment, which will lose the warranty, so rather not recommended.
    - Control by IR (imitates an IR remote control), E.G. through the Aqata Hub M2 or M3 gate, but it only allows you to send commands (not possible to read the state).
- Despite the efforts made, the operation of the plugin is without any guarantees and at your own risk.

