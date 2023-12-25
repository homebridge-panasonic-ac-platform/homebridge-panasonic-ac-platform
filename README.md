# Homebridge Panasonic AC Platform

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![GitHub version](https://img.shields.io/github/package-json/v/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform?label=GitHub)](https://github.com/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform)
[![npm version](https://img.shields.io/npm/v/homebridge-panasonic-ac-platform?color=%23cb3837&label=npm)](https://www.npmjs.com/package/homebridge-panasonic-ac-platform)

`homebridge-panasonic-ac-platform` is a dynamic platform plugin for [Homebridge](https://homebridge.io) that provides HomeKit support for Panasonic Comfort Cloud devices (like single and multi-split air conditioning systems).

## How it works
The plugin communicates with your devices through the Comfort Cloud service. This means you must have a Comfort Cloud account (Panasonic ID) and your units must be registered and set up there before you can use this plugin.

- Register and manage your Panasonic ID (used to manage Comfort Cloud) via app (iOS / Android) or browser [Panasonic ID](https://csapl.pcpf.panasonic.com).
- Instructions on how to create a [dual-account setup](https://github.com/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform/blob/master/docs/dual-account-setup.md).

All devices that are set up on your Comfort Cloud account will appear via HomeKit in your Home app (or other HomeKit app). If you remove a device from your Comfort Cloud account, it will also disappear from your HomeKit app after you restart Homebridge.

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

* `platform` (string):
Tells Homebridge which platform this config belongs to. Leave as is.

* `name` (string):
Will be displayed in the Homebridge log.

* `email` (string):
The username of your Comfort Cloud (Panasonic ID) account.

* `password` (string):
The password of your Comfort Cloud (Panasonic ID) account.

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

- If you have any issues with this plugin, enable the debug mode in the settings (and restart the plugin). This will print additional information to the log. If this doesn't help you resolve the issue, feel free to create a [GitHub issue](https://github.com/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform/issues) and attach the available debugging information.

- If you run into login errors despite using the correct login details, make sure you accepted the latest terms and conditions after logging into the Comfort Cloud app.

- If the plugin affects the general responsiveness and reliability of your Homebridge setup, you can run it as an isolated [child bridge](https://github.com/homebridge/homebridge/wiki/Child-Bridges).

## Contributing

You can contribute to this project in the following ways:

* Test/use the plugin and [report issues and share feedback](https://github.com/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform/issues).

* Contribute with your own bug fixes, code clean-ups, or additional features - [Pull Request](https://github.com/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform/pulls).

## Acknowledgements
* Thanks to [codyc1515](https://github.com/codyc1515) for creating and maintaining [homebridge-panasonic-air-conditioner](https://github.com/codyc1515/homebridge-panasonic-air-conditioner), which served as motivation for this platform plugin and proved particularly helpful in determining API request/response payloads.

* Thanks to the team behind Homebridge. Your efforts do not go unnoticed.

## Disclaimer
All product and company names are trademarks™ or registered® trademarks of their respective holders. Use of them does not imply any affiliation with or endorsement by them.
