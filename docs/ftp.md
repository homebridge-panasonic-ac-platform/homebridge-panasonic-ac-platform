# FTP (Raspberry Pi example):

### Activate FTP

- You can activate FTP by going to Homebridge Terminal and type: 'sudo hb-config'. 
- There go to Configure OS / System options / SSH and activate it (yes, SSH will also activate FTP). 
- You can also change password go to Configure OS / System options / Password.

### FTP connection config:

- host: `IP of your raspberry`
- username: `pi`
- password: `your password` (default: raspberry)
- port: `22` (using SFTP)

- root folder of the plugin: `/var/lib/homebridge/node_modules/homebridge-panasonic-ac-platform`
  or check in Homebridge Status page in status widget.
