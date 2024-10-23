# passwordmgr-remote-settings-updater

Script that adds new related websites to the "websites-with-shared-credential-backends" Remote Setting collection via [Apple's open sourced password manager resources](https://github.com/apple/password-manager-resources/blob/e0d5ba899c57482b06776a18c56b1ad714efd928/quirks/websites-with-shared-credential-backends.json) and adds new password rules to the "password-rules" Remote Setting collection via [Apple's open sourced password manager rules](https://github.com/apple/password-manager-resources/blob/main/quirks/password-rules.json).

## Usage

The script will _not run_ without the following environment variables set in `.env`: 
- `AUTHORIZATION`
- `SERVER`

To run this script:

`$ node update-script.js`

**Note**: Corporate VPN access is required to access the Remote Settings servers

The script will exit with a `0` for success and a `1` if there were any errors.
