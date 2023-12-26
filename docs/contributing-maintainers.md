# Contribution guidelines - for maintainers

### Strategy
There are many strategies for release management out there and all of them come with their trade-offs. To keep things simple and easy to maintain, we choose a light-weight approach with the following features: all releases are created from the master branch, feature branches are considered work in progress until they are merged.

### Merging pull requests
Besides reviewing the proposed changes, check the results of the lint compile workflow. 

### Releasing a new version - latest or beta

There is one workflow for creating new releases: latest and beta. This workflow runs automatically when you publish new Github Release (not draft). Create new tag, name should be same as tag, add release notes as description (not required for beta), and select latest (for public / stable) or pre-release (for beta).

- For latest version it should be like: 1.2.3 , 1.2.4 , 1.3.0 , etc.
- For beta version it should be like: 1.2.3-beta.0 , 1.2.3-beta.1 , 1.2.3-beta.2 , etc.

The beta tag makes sure that beta testers can install the version from their Homebridge installation, all other users will still receive the latest stable build.

Note: Workflows will produce an error if you try to re-publish the same version to npm again.

### Existing releases
To find out which versions have already been uploaded and with what tags, check the:
- [npm package's versions page](https://www.npmjs.com/package/homebridge-panasonic-ac-platform?activeTab=versions)
- [GitHub releases](https://github.com/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform/releases)
