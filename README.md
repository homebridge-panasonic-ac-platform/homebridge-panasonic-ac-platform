# Homebridge Panasonic AC Platform

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![GitHub version](https://img.shields.io/github/package-json/v/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform?label=GitHub)](https://github.com/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform)
[![npm version](https://img.shields.io/npm/v/homebridge-panasonic-ac-platform?color=%23cb3837&label=npm)](https://www.npmjs.com/package/homebridge-panasonic-ac-platform)

`homebridge-panasonic-ac-platform` is a dynamic platform plugin for [Homebridge](https://homebridge.io) that provides HomeKit support for Panasonic single and multi-split air conditioning systems.

## How it works
The plugin communicates with your AC units through the Comfort Cloud service. This means your units must be registered and set up there before you can use this plugin.

All devices that are set up on your Comfort Cloud account will appear in your Home app. If you remove a device from your Comfort Cloud account, it will also disappear from your Home app after you restart Homebridge.

## Comfort Cloud account

In the past, using the same account on multiple devices often resulted in being logged out of one of them. This made it necessary to create a secondary account in order for the plugin to operate reliably.

Recent improvements to Panasonic's token management should now allow you to simply use your main login details for the Homebridge plugin as well (see Comfort Cloud app release notes for 1.14.0).

In case you are still experiencing random logouts, refer to [this guide](https://github.com/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform/blob/master/docs/dual-account-setup.md) for instructions on how to create a dual-account setup. It explains how devices can be shared with a dedicated account that can be used for Homebridge.

## Homebridge setup
Configure the plugin through the settings UI or directly in the JSON editor:

```json
{
  "platforms": [
    {
        "platform": "Panasonic AC Platform",
        "name": "Homebridge Panasonic AC Platform",
        "email": "mail@example.com",
        "password": "********",
        "exposeOutdoorUnit": true,
        "debugMode": false,
        "appVersionOverride": "1.19.0",
        "suppressOutgoingUpdates": false,
        "minHeatingTemperature": 16,
        "maxAttempts": 0,
        "refreshInterval": 10,
        "oscilateSwitch": "swing",
        "startSwing": false,
        "startNanoe": false,
        "startEcoNavi": false,
        "startInsideCleaning": false
    }
  ]
}
```

Required:

* `platform` (string):
Tells Homebridge which platform this config belongs to. Leave as is.

* `name` (string):
Will be displayed in the Homebridge log.

* `email` (string):
The username of your Comfort Cloud account.

* `password` (string):
The password of your account.

Optional:

* `exposeOutdoorUnit` (boolean):
If `true`, the plugin will create a separate accessory for your outdoor unit which will display the (outdoor) temperature it measures. This can be used for monitoring and automation purposes.

* `debugMode` (boolean):
If `true`, the plugin will print debugging information to the Homebridge log.

* `appVersionOverride` (string):
The plugin will automatically use the last known working value when this setting is empty or undefined (default). This setting allows you to override the default value if needed. It should reflect the latest version on the App Store, although older clients might remain supported for some time.

* `suppressOutgoingUpdates` (boolean):
If `true`, changes in the Home app will not be sent to Comfort Cloud. Useful for testing your installation without constantly switching the state of your AC to minimise wear and tear.

* `minHeatingTemperature` (integer):
The default heating temperature range is 16-30°C. Some Panasonic ACs have an additional heating mode for the range of 8-15°C. If you own such a model, you can use this setting to adjust the minimum value. Leave it empty or undefined to use the default value.

* `maxAttempts` (integer):
Maximum number of failed login attempts. If set to 0 - without the limit.

* `refreshInterval` (integer):
Refresh interval in minutes. Minimum 1 minute, maximum 360 minutes (6 hours). Note: More frequent refresh would result in too much daily number of requests to the Panasonic server, which could result in an account lock for 24 hours, or even a complete API lock.

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

## Oscillate Switch

Decide what the switch should control: Swing Mode, Nanoe, Eco Navi or Inside Cleaning.

## Default values

Value with each state change made with Homekit (e.g. activation) separate for: Swing Mode, Nanoe, Eco Navi or Inside Cleaning. Available options: do nothing, set on, set off.

## Swing modes

Homekit doesn't have so many switches to support all Swing modes. That's why here you can choose how it works.

* The setting `Swing Directions` (`swingModeDirections` in the JSON config) controls which swing direction(s) will be activated when 'Oscillate' is switched on.

* The setting `Swing Mode Default Position (Left-Right)` (`swingModeDefaultPositionLeftRight` in the JSON config) controls the desired position of the Left-Right flaps when 'Oscillate' is switched off or the swing directions setting (see above) is "Up-Down only".

* The setting `Swing Mode Default Position (Up-Down)` (`swingModeDefaultPositionUpDown` in the JSON config) controls the desired position of the Up-Down flaps when 'Oscillate' is switched off or the swing directions setting (see above) is "Left-Right only".

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

* Review source code changes [before](https://github.com/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform/pulls) and [after](https://github.com/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform/commits/master) they are published.

* Contribute with your own bug fixes, code clean-ups, or additional features (pull requests are accepted).

## Acknowledgements
* Thanks to [codyc1515](https://github.com/codyc1515) for creating and maintaining [homebridge-panasonic-air-conditioner](https://github.com/codyc1515/homebridge-panasonic-air-conditioner), which served as motivation for this platform plugin and proved particularly helpful in determining API request/response payloads.

* Thanks to the team behind Homebridge. Your efforts do not go unnoticed.

## Disclaimer
All product and company names are trademarks™ or registered® trademarks of their respective holders. Use of them does not imply any affiliation with or endorsement by them.
