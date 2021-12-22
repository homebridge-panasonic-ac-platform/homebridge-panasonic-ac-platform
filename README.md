# Homebridge Panasonic AC Platform
`homebridge-panasonic-ac-platform` is a [Homebridge](https://homebridge.io) dynamic platform plugin that provides HomeKit support for Panasonic air conditioning units.

## How it works
The plugin communicates with your AC units through the Comfort Cloud service which means your units must be registered and set up there.

All devices that are set up on the specified Comfort Cloud account will appear in your Home app. If you remove a device from your Comfort Cloud account, it will also disappear from your Home app after you restart Homebridge.

## Recommendation
It is recommended to manage your Homebridge integration through a separate Comfort Cloud account.

While this is not strictly necessary, using a single account might result in you being logged out from your app (on the phone) while using this Homebridge plugin at the same time. Token management is at the discretion of the manufacturer, and we cannot influence this behaviour.

For this purpose, we define "primary account" as the one you use to manage your units from your phone, and "secondary account" as the one used for Homebridge.

The primary account will initially register and own the device(s), and then grant your secondary account the permission to control them.

Refer to the [Comfort Cloud Setup section](#Comfort-Cloud-Setup) below to set up this dual-account structure.


## Homebridge setup
The plugin can be configured through the settings UI or the corresponding JSON configuration:

```json
{
  ...
  "platforms": [
    ...
    {
        "name": "Homebridge Panasonic AC Platform",
        "email": "mysecondaryemail@example.invalid",
        "password": "********",
        "platform": "Panasonic AC Platform",
        "debugMode": false,
        "appVersion": "1.13.0"
    }
  ]
  ...
}
```

Explanation:

* `name` (string): Will be displayed in the Homebridge log.

* `email` (string): The username of your (ideally secondary) Comfort Cloud account.

* `password` (string): The password of your account.

* `debugMode` (boolean): If true, the plugin will print debugging information to the Homebridge log. 

* `appVersion` (string): This should match the latest app version on the app store.


## Comfort Cloud setup

To connect your air conditioners to your primary Comfort Cloud account in first place, please follow your device's user manual. Getting Panasonic ACs connected can be a fiddly affair at times and might require some familiarisation with the IR remote and the various numbers and modes.

Once your devices are registered and linked with your primary account, follow the steps below to share the unit(s) with your secondary (Homebridge) account.

### 1. Creating a secondary account for Homebridge
- Sign out of your primary account in the Comfort Cloud app.
- Create a secondary account with a new email.

Tip: If you have two phones available, it is easier to operate them at the same time during the setup process (one for each account). In that case, you don't have to switch accounts and device sharing requests can simply be confirmed by opening the push notification that is delivered to the primary account when a request is made.

### 2. Create device sharing request
- Log into your secondary account.
- Tap "+" to add a new device (in any group).
- Select Air Conditioner (first item).
- Select the appropriate Wi-Fi module (built-in or external).
- Tap "Start".
- Select "Other (Air-conditioner used before)".
- Select "Yes" on the question "Was this air-conditioner operated using this smart APP before?", even if it wasn't. If you select "No", the app will ask you to factory-reset the unit, which will disconnect it from the network and may also remove it from the primary account. Hence, avoid option "5" on the IR remote, unless you really want to reset the device/connection.
- Tap "Next" (since your unit should be connected to Wi-Fi at this point already). Don't use the remote to send a signal to the AC at this point.
- Tap "LED is ON" (unless it isn't). The app will now search for active units on your network.
- Select the unit you want to set up, then tap "Register". If it doesn't appear in the list, tap "Retry searching..." (the search can be quite flaky).
- Follow the next few steps using the remote and the option "3" which maps to device registration.
- During this process, you will set up a device password and a request note for the device owner (primary account).
- At the end of the process, you will have created a sharing request.

### 3. Confirm device sharing request
- Log back into your primary account.
- Tap on the device you have requested access for.
- Click the hamburger menu and expand the "Owner" menu item, click "User list".
- You should see an entry waiting approval status.
- Click the "Waiting Approval" button.
- Select the "Allow both monitoring and controlling air conditioner" permission and confirm.
- The waiting for approval button should have disappeared and replaced with a blue check icon.


## Acknowledgements
* Thanks to [codyc1515](https://github.com/codyc1515) for creating and maintaining [homebridge-panasonic-air-conditioner](https://github.com/codyc1515/homebridge-panasonic-air-conditioner), which served as motivation for this platform plugin and proved particularly helpful in determining API request/response payloads.

* Thanks to the team behind Homebridge. Your efforts do not go unnoticed.
