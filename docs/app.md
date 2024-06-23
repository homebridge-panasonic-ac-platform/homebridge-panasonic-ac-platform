# Panasonic Comfort Cloud app (for Android)

## Get hardcoded app values (APP_CLIENT_ID and AUTH_0_CLIENT)
- get com-panasonic-accsmart-v1.20.0.apk, E.G. from [https://apkpure.com](https://apkpure.com)
- decompile it online: [https://www.decompiler.com](https://www.decompiler.com)
- download and unzip decompiled files or browse online
- value for `client_id` is in `/sources/com/panasonic/ACCsmart/ui/login/auth0/Auth0LoginActivity.java` (use search)

## Intercept the traffic from the app to the api server. 
Author of this manual: [@heldchen](https://github.com/heldchen). Tkanks!

The Android APK is using a <network-security-config> that pins the TLS certificate of the api servers to cirumvent this.

preparations:

- install [Android Studio](https://developer.android.com/studio) create a fresh Virtual Device (Pixel 8 Pro with Play Store, rest default settings) and start the Virtual Device.
- install [HttpToolkit](https://httptoolkit.com) and start it.
- download the [httptoolkit.apk](https://github.com/httptoolkit/httptoolkit-android/releases/tag/v1.3.12), drag-drop it to the Virtual Device, started it & followed onboarding.

### patching com-panasonic-accsmart-v1.20.0.apk for https interception:

- download com-panasonic-accsmart-v1.20.0.apk from one of the APK mirrors
- download recent [apktool](https://apktool.org) & [uber-apk-signer](https://github.com/patrickfav/uber-apk-signer)
- prepare: `java -jar apktool.jar if com-panasonic-accsmart-v1.20.0.apk`
- decompile: `java -jar apktool.jar d com-panasonic-accsmart-v1.20.0.apk`
- update `res/xml/network_security_config.xml` to

```
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
<!--
    <base-config cleartextTrafficPermitted="true" />
    <domain-config>
        <domain includeSubdomains="true">accsmart.panasonic.com</domain>
        <domain includeSubdomains="true">stg-grac.panasonic.com</domain>
        <domain includeSubdomains="true">192.168.102.1</domain>
        <pin-set expiration="2029-05-29">
            <pin digest="SHA-256">rS4Ex7fMz9dQhgdB6qjxP+jJJQwjIeb+7RhvvdO6xy8=</pin>
        </pin-set>
    </domain-config>
-->
  <base-config>
      <trust-anchors>
          <certificates src="system" />
          <certificates src="user" overridePins="true" />
      </trust-anchors>
  </base-config>
</network-security-config>
```
replace `192.168.102.1` to your IP.

- recompile: `java -jar apktool.jar b com-panasonic-accsmart-v1.20.0`
- sign apk: `java -jar uber-apk-signer.jar --apks com-panasonic-accsmart-v1.20.0/dist/com-panasonic-accsmart-v1.20.0.apk`
- drag and drop the signed apk to the Virtual Device to install the apk

Now when starting the Comfort Cloud app, all traffic is successfully intercepted.
