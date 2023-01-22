# Homebridge Panasonic AC Platform

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![GitHub version](https://img.shields.io/github/package-json/v/embee8/homebridge-panasonic-ac-platform?label=GitHub)](https://github.com/embee8/homebridge-panasonic-ac-platform)
[![Publish package to npm](https://img.shields.io/github/workflow/status/embee8/homebridge-panasonic-ac-platform/Publish%20package%20to%20npm?label=Publish%20to%20npm)](https://github.com/embee8/homebridge-panasonic-ac-platform/actions/workflows/npm-publish.yml)
[![npm version](https://img.shields.io/npm/v/homebridge-panasonic-ac-platform?color=%23cb3837&label=npm)](https://www.npmjs.com/package/homebridge-panasonic-ac-platform)

`homebridge-panasonic-ac-platform` is a dynamic platform plugin for [Homebridge](https://homebridge.io) that provides HomeKit support for Panasonic single and multi-split air conditioning systems.

## How it works
The plugin communicates with your AC units through the Comfort Cloud service. This means your units must be registered and set up there before you can use this plugin.

All devices that are set up on your Comfort Cloud account will appear in your Home app. If you remove a device from your Comfort Cloud account, it will also disappear from your Home app after you restart Homebridge.

## Comfort Cloud account

In the past, using the same account on multiple devices often resulted in being logged out of one of them. This made it necessary to create a secondary account in order for the plugin to operate reliably.

Recent improvements to Panasonic's token management should now allow you to simply use your main login details for the Homebridge plugin as well (see Comfort Cloud app release notes for 1.14.0).

In case you are still experiencing random logouts, refer to [this guide](https://github.com/embee8/homebridge-panasonic-ac-platform/blob/master/docs/dual-account-setup.md) for instructions on how to create a dual-account setup. It explains how devices can be shared with a dedicated account that can be used for Homebridge.

In case of a "Login Fail" Error, you must first login in Your Comfort Cloud APP to accept the New "Privacy Notice" and after acceptation the plugin works again.

It is a good practice to have this Plugin as a "Child Bridge" so this plugin can not block your other Plugins/Devices.

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
        "appVersionOverride": "1.16.0",
        "suppressOutgoingUpdates": false,
        "minHeatingTemperature": 16
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

## Troubleshooting

If you have any issues with this plugin, enable the debug mode in the settings (and restart the plugin). This will print additional information to the log. If this doesn't help you resolve the issue, feel free to create a [GitHub issue](https://github.com/embee8/homebridge-panasonic-ac-platform/issues) and attach the available debugging information.

## Contributing

You can contribute to this project in the following ways:

* Test/use the plugin and [report issues and share feedback](https://github.com/embee8/homebridge-panasonic-ac-platform/issues).

* Review source code changes [before](https://github.com/embee8/homebridge-panasonic-ac-platform/pulls) and [after](https://github.com/embee8/homebridge-panasonic-ac-platform/commits/master) they are published.

* Contribute with your own bug fixes, code clean-ups, or additional features (pull requests are accepted).

## Acknowledgements
* Thanks to [codyc1515](https://github.com/codyc1515) for creating and maintaining [homebridge-panasonic-air-conditioner](https://github.com/codyc1515/homebridge-panasonic-air-conditioner), which served as motivation for this platform plugin and proved particularly helpful in determining API request/response payloads.

* Thanks to the team behind Homebridge. Your efforts do not go unnoticed.

## Disclaimer
All product and company names are trademarks™ or registered® trademarks of their respective holders. Use of them does not imply any affiliation with or endorsement by them.
