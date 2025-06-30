# Dual account setup for Comfort Cloud

While it is not strictly necessary to use a separate Comfort Cloud account for this plugin, it might prevent you from being logged out from your app (on the phone) while using this Homebridge plugin at the same time.

## New Method
You can now share devices from one Comfort Cloud account to another (iOS app version 2.2.0 or above required).

## Old Method (deprecated)

For the purpose of this guide, we define "primary account" as the one you use to manage your units from your phone, and "secondary account" as the one used for Homebridge.

The primary account will initially register and own the device(s), and then grant your secondary account the permission to control them.

#### Setup

To connect your air conditioners to your primary Comfort Cloud account in first place, please follow your device's user manual. Getting Panasonic ACs connected can be a fiddly affair at times and might require some familiarisation with the IR remote and the various numbers and modes.

Once your devices are registered and linked with your primary account, follow the steps below to share the unit(s) with your secondary (Homebridge) account.

#### 1. Creating a secondary account for Homebridge
- Sign out of your primary account in the Comfort Cloud app.
- Create a secondary account with a new email.

Tip: If you have two phones available, it is easier to operate them at the same time during the setup process (one for each account). In that case, you don't have to switch accounts and device sharing requests can simply be confirmed by opening the push notification that is delivered to the primary account when a request is made.

#### 2. Create device sharing request
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

#### 3. Confirm device sharing request
- Log back into your primary account.
- Tap on the device you have requested access for.
- Click the hamburger menu and expand the "Owner" menu item, click "User list".
- You should see an entry waiting approval status.
- Click the "Waiting Approval" button.
- Select the "Allow both monitoring and controlling air conditioner" permission and confirm.
- The waiting for approval button should have disappeared and replaced with a blue check icon.
