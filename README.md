<img src="https://github.com/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform/blob/master/logo.png" width="100px"></img>

# Homebridge Panasonic AC Platform

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![Downloads](https://img.shields.io/npm/dt/homebridge-panasonic-ac-platform)](https://www.npmjs.com/package/homebridge-panasonic-ac-platform)
[![GitHub version](https://img.shields.io/github/package-json/v/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform?label=GitHub)](https://github.com/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform/releases)
[![npm version](https://img.shields.io/npm/v/homebridge-panasonic-ac-platform?color=%23cb3837&label=npm)](https://www.npmjs.com/package/homebridge-panasonic-ac-platform)

`homebridge-panasonic-ac-platform` is a dynamic platform plugin for [Homebridge](https://homebridge.io) which provides HomeKit support for Panasonic Comfort Cloud devices (such as single and multi-split air conditioning systems).

## How it works
The plugin communicates with your devices through the Comfort Cloud service. This means you must have a Comfort Cloud account (Panasonic ID) and your units must be registered and set up there before you can use this plugin.

All devices that are set up on your Comfort Cloud account will automaticaly appear in Homebridge and via HomeKit in your Home app (or other HomeKit app). You can also exclude one or more devices. For each device you can apply individual settings. 

## Comfort Cloud account (Panasonic ID)

- Register and manage your Panasonic ID (used to manage Comfort Cloud) via app (iOS / Android) or browser -  [Panasonic ID](https://csapl.pcpf.panasonic.com).
- Panasonic requires 2FA (Two Factor Authentication) for Panasonic account (at this moment not required for this plugin). You can choose TOTP code or SMS. Recommended choice is the TOTP code (32 character length key). This option could be available after clicking on the small link 'try another verification method'). If you already have account you can reset two factor authentication or again configure login method to get TOTP code.
- Instructions on how to create a [dual-account setup](https://github.com/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform/blob/master/docs/dual-account-setup.md).

## Install plugin

This plugin can be easily installed through Homebridge UI or via [NPM](https://www.npmjs.com/package/homebridge-panasonic-ac-platform) "globally" by typing:

    npm install -g homebridge-panasonic-ac-platform

Node v20.19.0 or above is required.

## Configure plugin
Configure the plugin through the settings UI or in the JSON editor.


<details>
<summary><b>config.json example</b></summary>

```json
{
  "platforms": [
    {
      "platform": "Panasonic AC Platform",
      "name": "Homebridge Panasonic AC Platform",
      "email": "mail@example.com",
      "password": "********",
      "key2fa": "GVZCKT2LLBLV2QBXMFAWFXKFKU5EWL2H",
      "suppressOutgoingUpdates": false, 
      "logsLevel": 1,
      "devices": [
        {
            "name": "CS-Z50VKEW+4942673181",
            "excludeDevice": true,
            "minHeatingTemperature": 8,
            "exposeOutdoorTemp": false,
            "exposeNanoe": true,
            "exposeInsideCleaning": false,
            "exposeEcoNavi": false,
            "exposeDryMode": false,
            "exposeQuietMode": true,
            "exposePowerfulMode": false,
            "swingDefaultUD": "CENTER",
            "swingDefaultLR": "CENTER"
        },
        {
            "name": "Bedroom AC",
            "excludeDevice": false,
            "exposeOutdoorTemp": true,
            "exposeNanoe": false,
            "exposeInsideCleaning": true,
        },
      ]
    }
  ]
}
```
#### General

- `platform` (string): Tells Homebridge which platform this config belongs to. Leave as is.

- `name` (string): Name of the plugin displayed in Homebridge log and as plugin bridge name.

- `email` (string): The username of your Comfort Cloud (Panasonic ID) account.

- `password` (string): The password of your Comfort Cloud (Panasonic ID) account.

* `key2fa` (string): 
2FA key received from Panasonic (32 characters). Example: GVZCKT2LLBLV2QBXMFAWFXKFKU5EWL2H. Note: This field is currently not required to make this plugin work, but Panasonic already requires 2FA (code or SMS, recommended code) to log in to Comfort Cloud, so it may be required soon.

* `suppressOutgoingUpdates` (boolean):
When enabled, changes in the Home app will not be sent to Comfort Cloud. Useful for testing your installation without constantly switching the state of your AC.

* `overWriteVersion` (string):
Must be equal to newest Panasonic Comfort Cloud app version from App Store or Play Store. E.G: 2.1.0. Leave empty to automaticaly detect version.

* `logsLevel` (integer):
Logs level. 0 - only errors and important info, 1 - standard, 2 - all (including debug). Note: to see debug messages in logs it is also required to enable Debug in Homebridge Settings.

#### Individual for each device

* `name` (string):
Device name (as it is in Comfort Cloud account) or serial (E.G.: CS-Z50VKEW+2462503161). Devices names and serial numbers are displayed in Homebridge log after restart, names can be also found in Panasonic Comfort Cloud app, serial numbers can be also found on the stickers on the devices.

* `excludeDevice` (boolean):
Exclude device from Homebridge and HomeKit (it will stay in Comfort Cloud).

* `refreshWhenOn` (integer):
Refresh interval when device is turned on. In minutes. 0 = disabled.

* `refreshWhenOff` (integer):
Refresh interval when device is turned off. In minutes. 0 = disabled.

* `minHeatingTemperature` (integer):
The default heating temperature range is 16-30°C. Some Panasonic ACs have an additional heating mode for the range of 8-15°C. You can use this setting to adjust the minimum value. Leave it empty to use the default value.

* `exposeInsideTemp` (boolean):
When enabled it will create a virtual temperature sensor which will display the temperature from inside unit. This can be used for monitoring or automation purposes. Note: It is recomended to use external temperature sensor (not built-in in AC).

* `exposeOutdoorTemp` (boolean):
When enabled it will create a dummy temperature sensor which will display the temperature from outdoor unit. This can be used for monitoring or automation purposes. Note: It may be required for the device to be turned on to retrieve the current temperature from the outdoor unit.

* `exposePower` (boolean): When enabled it will create a switch to control Power (on/off).

* `exposeNanoe` (boolean): When enabled it will create a switch to control Nanoe.

* `exposeInsideCleaning` (boolean): When enabled it will create a switch to control Inside Cleaning.

* `exposeEcoNavi` (boolean): When enabled it will create a switch to control Eco Navi.

* `exposeEcoFunction` (boolean): When enabled it will create a switch to control Eco Function.

* `exposeCoolMode` (boolean): When enabled it will create a switch to control Cool Mode.
 
* `exposeHeayMode` (boolean): When enabled it will create a switch to control Heat Mode.
 
* `exposeDryMode` (boolean): When enabled it will create a switch to control Dry Mode.

* `exposeFanMode` (boolean): When enabled it will create a switch to control Fan Mode.

* `exposeNanoeStandAloneMode` (boolean): When enabled it will create a switch to control Nanoe Stand Alone Mode.

* `exposeQuietMode` (boolean): When enabled it will create a switch to control Quiet Mode. Quiet Mode can also be enabled by setting the speed slider (rotation) to 1.

* `exposePowerfulMode` (boolean): When enabled it will create a switch to control Powerful Mode. Powerful Mode can also be enabled by setting the speed slider (rotation) to 7.

* `exposeSwingUpDown` (boolean): When enabled it will create a switch to control Swing Up Down.

* `exposeSwingLeftRight` (boolean): When enabled it will create a switch to control Swing Left Right.

* `exposeFanSpeed` (boolean): When enabled it will create a switch to control Fan Speed. Value 0 will turn device off, value from 1 to 20 = speed 1, value from 21 to 40 = speed 2, value from 41 to 60 = speed 3, value from 61 to 80 = speed 4, value from 81 to 99 = speed 5 and value 100 = speed auto. Note: changing value will turn off Quiet / Powerful mode.

* `swingDefaultUD` (string):
Desired position of the Up-Down flaps when swing is switched off.

* `swingDefaultLR` (string):
Desired position of the Left-Right flaps when swing is switched off.


</details>

## Device control

HomeKit has a limited number of switches, which is much less than the number of available options in Panasonic Comfort Cloud. Therefore, in the plugin settings you can choose what controls what and add additional sensors and switches. You can apply individual settings for each device.

<details>
<summary><b>Additional sensors and switches</b></summary>
    
- Enable additional sensor for outdoor temp. and/or switches for: Nanoe, Inside Cleaning, Eco Navi, Cool Mode, Heat Mode, Dry Mode, Fan mode, Quiet Mode, Powerful Mode, Swing Up Down, Swing Left Right, Fan Speed, etc.
- Sensor / Switch will work only if device support this function.
- Some values can be changed only when device is turned on (E.G.: Quiet Mode, Powerful mode, Swing Up Down, Swing Left Right).
- These sensors / switches will be available in HomeKit, directly in your main device or in device / settings (wheel icon) / accessories. 
- If you add at least one sensor or switch, the appearance of the air conditioning in HomeKit will change to accessory group (rotation speed and swing will be available after entering the device / settings (wheel icon) / accessories / device / settings (wheel icon)). You can also use the option 'show as separate tiles' to separate the accessories.

</details>

<details>
<summary><b>Fan speed (including Quiet and Powerful Mode)</b></summary>

For the built-in slider (not additional), the following mapping applies:

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

</details>

<details>
<summary><b>Oscilate switch (swing)</b></summary>

- Activation of Oscilate switch from HomeKit will set swing to auto (for up-down and left-right).
- Deactivation of the Oscilate switch from HomeKit will set desired positions - you can set them in plugin config.
- When refreshing data, it will activate switch if at least one of the swing modes be enabled (up-down or left-right or both), otherwise it will be turned off.
- For more control you can add additional switches for up-down swing and left-right swing.
</details>

<details>
<summary><b>Refreshing data of devices</b></summary>

- The data is refreshed automatically (you can set time in config). Data is also refreshed every time the state of the device is changed using HomeKit / Apple Home.
- Why isn't refreshing more often? Each refresh is a connection to the Panasonic server and too many connections result in IP blocking.
- Temperature from outdoor unit is only available when device is on. 

</details>

<details>
<summary><b>Siri and voice commands</b></summary>

If everything works properly and you can control devices using the Apple Home application, you can also control it using Siri. Commands fully depend on Apple.

Examples of commands:
- Hey Siri, turn on [device name] 
- Hey Siri, [device name] , turn off
- Hey Siri, [device name] , set [auto, heat, cool] mode
- Hey Siri, [device name] , set rotation speed to [value from 1 to 8]

You can also combine several commands into one:
- Hey Siri, [device name] , set [auto, heat, cool] mode and rotation speed to [value from 1 to 8]

</details>


## Troubleshooting

<details>
<summary><b>General - plugin doesn't work, crashes or restarts Homebridge, etc.</b></summary>

- Make sure that you can successfully log in and control each device via Panasonic Comfort Cloud application.
- Accept all terms, conditions, etc in Panasonic Comfort Cloud app.
- Update plugin, Homebridge and all its components and Apple hubs to the newest versions.
- Disable other Homebridge plugins to make sure that they are not causing the problem.
- Disconnect each Comfort Cloud device (like AC) from the power and turn it on again (or restart WiFi in them).
- Restart Internet routers.
- Restart Homebridge or plugin bridge.
- Remove one or more plugin devices from Homebridge cache (Homebridge settings > remove one device from cache).
- Set Logs Level to all (in plugin config) and enable debug mode (in Homebridge settings / child bridge settings) - this will include more detailed information in the log.

</details>

<details>
<summary><b>Incorrect display or name of device, sensor or switch</b></summary>
    
Remove device from Homebridge cache (Homebridge settings > remove one device from cache).

</details>

<details>
<summary><b>Wrong temperature</b></summary>
    
- Built-in temperature sensors (in the internal and external unit) give only approximate values (as the manufacturer himself indicates).
- Values from outdoor sensors are shown and updated only when the device is turned on.
- Comfort Cloud updates data only from time to time, the same plugin, which is why the temperature in the Panasonic Comfort Cloud application may be different than in HomeKit / Apple Home. You can force refresh in Panasonic app by pulling down the screen. 
- For these reasons, it is not recommended to use built-in sensors for automation. Instead, it is advisable to use an external sensor.
- So what are these built-in sensors for? Internal sensor is for two simple automations that every AC have built-in: for cooling mode turn off cooling when the room temperature (internal sensor) is equal to or lower than the set, and for heating mode when it is equal or higher. Outdoor sensor is for detecting when AC should run defrost. 
</details>

<details>
<summary><b>Child bridge</b></summary>
    
- It's recommended you run this plugin as a [child bridge](https://github.com/homebridge/homebridge/wiki/Child-Bridges).

</details>

<details>
<summary><b>Comfort Cloud manual</b></summary>

https://www.panasonic.com/global/hvac/products/comfort-cloud/how-to-set-up-comfort-cloud.html

</details>

<details>
<summary><b>Alternatives to this plugin</b></summary>

- Link Comfort Cloud to Google Assistant ([manual](https://www.panasonic.com/global/hvac/products/comfort-cloud/how-to-set-up-comfort-cloud/link-panasonic-comfort-cloud-app-to-google-assistant.html)).

- Link Comfort Cloud to Amazon Alexa ([manual](https://www.panasonic.com/global/hvac/products/comfort-cloud/how-to-set-up-comfort-cloud/link-panasonic-comfort-cloud-app-to-amazon-alexa.html)).

- Official Panasonic Comfort Cloud app for iOS / Android

- Dedicated remote controller.

- Local access, but this requires reworking of the equipment, which will lose the warranty, so rather not recommended ([manual](https://github.com/DomiStyle/esphome-panasonic-ac)).
    
- Control by IR (imitates an IR remote control), but it only allows you to send commands (not possible to read the state). Examples:

  - Aqara Hub M2 or M3. This Hub will directly exposes IR to Homekit. For Hub M2 you need to create scene in Aqara app for every IR command, for IR commands scenes are the only way to sync to HomeKit.

  - Broadlink RM4 Mini or Pro. They work as WiFi devices. You need to install Homebridge plugin ([homebridge-broadlink-rm](https://github.com/kiwi-cam/homebridge-broadlink-rm)) to work with this. For every command there will be separate accessory in HomeKit.
        
  - Any Zigbee IR blaster. You can easily add Zigbee support to Homebridge. Just connect the Conbee stick, enable the support in hb-config (Extra packages / deCONZ), install the appropriate plugin (E.G.: [homebridge-deconz](https://github.com/ebaauw/homebridge-deconz)) and add the selected IR blaster.

    TIP: You can turn off the beep sound in the internal unit that appears on every IR signal receive. In most air conditioning, to do this, hold down the auto on/off button in the internal unit until you hear 4 beeps, then release the button, single press AC reset button on remote, single press the auto on/off button again on the air conditioning - short signal means a sound turned off, a long one means a sound turned on.

</details>

## Contributing and support

- Test/use the plugin and report issues and share feedback: [Issues](https://github.com/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform/issues).
- Contribute with your own bug fixes, code clean-ups, or additional features: [Pull Requests](https://github.com/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform/pulls).
- Develop: [developers.md](https://github.com/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform/blob/master/docs/developers.md).
- Check Comfort Cloud app, how it works and how it comunicates with server: [app.md](https://github.com/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform/blob/master/docs/app.md).

Note: Comfort Cloud and HomeKit have their own requirements and limitations. For this reason, some things cannot be implemented. For example, Comfort Cloud stores some of the settings on the server and some on the device (e.g. fan speed and quiet / powerful mode are stored in the remote control / application and also in this plugin). For example in Homekit slider set to 0 always turn off device and we cannot change this.

## Acknowledgements
- Thanks to [embee8](https://github.com/embee8) for creating this plugin.
- Thanks to everyone helping in the development and obtaining new Comfort Cloud API.
- Thanks to the team behind Homebridge - your efforts do not go unnoticed.

## Disclaimer
- This is not the official Panasonic plugin. It uses the official Panasonic API used to support official applications for iOS and Android. Panasonic has not provided an official API to support external plugins, so this method may stop working at any time.
- Homebridge connects via Internet with Comfort Cloud (Panasonic platform), this solution does not work locally.
- Despite the efforts made, the operation of the plugin is without any guarantees.
- All actions are at your own risk.
- All product and company names are trademarks™ or registered® trademarks of their respective holders. Use of them does not imply any affiliation with or endorsement by them.
