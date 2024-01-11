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
Refresh interval in minutes. 0 - disabled. Recomended min. 10 minutes. Maximum 360 minutes (6 hours). Note: More frequent refresh would result in too much daily number of requests to the Panasonic server, which could result in an account lock for 24 hours, or even a complete API lock.

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
