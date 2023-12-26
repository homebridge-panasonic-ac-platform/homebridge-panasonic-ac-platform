# For maintainers

### Creating releases

#### Strategy
There are many strategies for release management out there and all of them come with their trade-offs. To keep things simple and easy to maintain, we choose a light-weight approach with the following features:

- All releases are created from the `master` branch.
- Feature branches are considered work in progress until they are merged.
- Pull requests should generally introduce or contain a version number that is greater than the latest release. There is a workflow in place that checks this. This ensures that every change is versioned and we don't try to publish the same package twice. Exceptions apply to non-functional changes like documentation.
- When a pull request is merged onto `master`, a workflow will create a new tag which will reflect the version number in `package.json`. This tag can be used when running release workflows (see below).
- When a release workflow is run, it will create a release on GitHub and publish the package to npm.

#### Merging pull requests
Besides reviewing the proposed changes, check the results of the workflow runs. A failing version check should only be ignored if the pull request only contains non-functional changes, like documentation.

Once a pull request has been merged, the feature branch will automatically be deleted by GitHub as configured in the repository settings.

As stated above, the workflows will be run for the respective tag on the `master` branch. This helps to keep our repository clean and better manageable.

#### Releasing a new version

There are two workflows for creating new releases:

**Create beta release**  
This workflow creates a beta release for the selected tag.

Example: If we run this workflow for tag v1.3.0, it will publish version 1.3.0 to npm using `npm publish --tag beta`.

The beta tag makes sure that beta testers can install the version from their Homebridge installation. All other users will still receive the latest stable build.

**Create production release**  
This workflow creates a production release for the selected tag.

Example 1: If we previously published a beta version of v1.3.0 and we run this workflow for the same tag, it will change the tag of the release from 'beta' to 'latest'.

Example 2: If no previous beta release has been created for a given tag, this workflow will publish a production release using `npm publish`. This is useful for releases that are not sent through a beta, for example hotfixes.

#### Running a workflow
- Navigate to the 'Actions' tab.
- Select the appropriate workflow on the left.
- Click 'Run workflow' on the right.
- Click dropdown under 'Use workflow from'.
- Click 'Tags' and select the appropriate tag.

Note: Release workflows will produce an error if you try to re-publish the same version to npm again. You can release each version only twice – once as a beta release, and once as a production release.

To find out which versions have already been uploaded and with what tags, check the [npm package's versions page](https://www.npmjs.com/package/homebridge-panasonic-ac-platform?activeTab=versions) and the existing [GitHub releases](https://github.com/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform/releases).
