# Contribution guidelines

## For collaborators

### Discuss ideas

If you want to make changes, it's often best to talk about it before starting to work on it and submitting a pull request. Feel free to open an issue to present your idea and link the conversation in the resulting pull request.

### Guidelines

For all contributions, please consider the following:

- Each pull request should implement ONE feature or bugfix. If you want to add or fix more than one thing, submit more than one pull request.
- Do not commit changes to files that are irrelevant to your feature or bugfix (e.g. `.gitignore`).
- Do not add unnecessary dependencies.
- Be aware that the pull request review process is not immediate, and is generally proportional to the size of the request.

### Create a branch

This project uses [GitHub flow](https://docs.github.com/en/get-started/quickstart/github-flow) - a lightweight, branch-based workflow. If you want to makes changes, you need to create a new branch in your (forked) repository.

A short, descriptive branch name enables all collaborators to see ongoing work at a glance. For example, `increase-timeout` or `adjust-sensor-settings`. Version numbers are not suitable branch names.

```bash
# Create and check out a new branch
git checkout -b branch-name
```

### Make changes
On your branch, make any desired and necessary changes. Do not edit any JavaScript files (`.js`) in the `dist` directory.

Instead, change the TypeScript files (`.ts`) in the `src` directory and then build the project using the following commands:

```bash
# Build once
npm run build

# Build and watch changes
npm run build-watch
```

### Test changes

To test your changes locally, copy the entire project directory into the `node_modules` directory of your Homebridge installation. This is where all plugins are stored.

The way to achieve this will vary by platform and your development setup. If you run Homebridge in Docker container and you edit the project on the same machine, you can use the following script to do the copying.

```bash
# Create the copy script
touch copy-to-homebridge.sh
chmod u+x copy-to-homebridge.sh
nano copy-to-homebridge.sh
```

Content of the script:

```bash
#!/bin/bash

REPOSITORY_DIR=~/projects/homebridge-panasonic-ac-platform
HOMEBRIDGE_PLUGIN_DIR=~/path-to-your-homebridge-volume/node_modules/homebridge-panasonic-ac-platform

rm -rf $HOMEBRIDGE_PLUGIN_DIR
mkdir -p $HOMEBRIDGE_PLUGIN_DIR

rsync -ar --exclude='.git' $REPOSITORY_DIR $HOMEBRIDGE_PLUGIN_DIR
```

### Increase version number
Since you are introducing new changes which would find their way into the next release, you can increase the version number in the `package.json` and `package-lock.json` files.

Preferably, use the following commands rather than editing the files manually:

```bash
# Backward compatible bug fixes
# Example: 1.3.2 -> 1.3.3
npm --no-git-tag-version version patch

# Backward compatible new features
# Example: 1.3.2 -> 1.4.0
npm --no-git-tag-version version minor

# Changes that break backward compatibility
# Example: 1.3.2 -> 2.0.0
npm --no-git-tag-version version major
```

### Commit changes
Give each commit a descriptive message to help you and other contributors understand what changes it contains.

Ideally, each commit contains an isolated, complete change. This makes it easy to revert your changes if you decide to take a different approach.

```bash
# Option 1: Stage all files
git add .

# Option 2: Stage specific files
git add file1 file2 ...

git commit -m "Short description of changes"
```

### Push changes

```bash
# Assuming 'origin' is the name of your remote
git push -u origin branch-name
```

### Create a pull request
Ask collaborators for feedback on your changes. Include a summary of the changes and what problem they solve. You can use images, links, and tables to help convey this information.

If your pull request (PR) addresses an issue, link the issue so that issue stakeholders are aware of the pull request and vice versa.

After submitting your pull request, only add additional commits if it's to fix issues or to incorporate feedback. If you notice that things are missing, you have two options:
1) Inform reviewers that more commits are coming and they should hold off reviewing.
2) Delete your PR and resubmit it at a later time when the proposed changes are complete.

This prevents scope creep and helps reviewers to keep an overview of changes. Aim for PRs to be complete and well-tested – they are not a development or test environment.

### Check workflow runs
After publishing your pull request, pay attention to the workflows that are run.

For security purposes, workflows on pull requests to public repositories from some outside contributors will might need to be approved first.

If the workflows highlight errors, fix them and push additional commits to your branch. This will automatically update the pull request and run the checks again.

## For maintainers

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
