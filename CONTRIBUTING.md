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
Since you are introducing new changes which would find their way into the next release, you need to increase the version number in the `package.json` and `package-lock.json` files.

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

If your pull request addresses an issue, link the issue so that issue stakeholders are aware of the pull request and vice versa.

### Check workflow runs
After publishing your pull request, pay attention to the workflows that are run.

For security purposes, workflows on pull requests to public repositories from some outside contributors will not run automatically, and might need to be approved first.

If the workflows highlight errors, fix them and push additional commits to your branch. This will automatically update the pull request and run the checks again.

## For maintainers

### Creating releases

#### Strategy
There are many strategies for release management out there and all of them come with their trade-offs.

One strategy is to maintain a separate release branch, but this approach requires branch merging and manual tagging, often on the command line.

To keep things simple and easy to maintain, we choose a light-weight approach with the following features:

- All releases are created from the `master` branch.
- Feature branches are considered work in progress until they are merged.
- Every pull request should introduce a new version number. There is a workflow in place that checks this. This ensures that every change is versioned and we don't try to publish the same package twice. Exceptions apply to non-functional changes like documentation.
- When a PR is merged, a workflow will automatically create a tag for the latest commit. The tag will reflect the version number in `package.json`. This tag can be used when running the release workflows (see below).
- If the tag exists already (see exception above), no action is taken. But in this case re-running the release workflow would result in an error.
- When a release workflow is run, it will publish the package to npm and create a release on GitHub.

#### Merging pull requests
Besides reviewing the proposed changes, check the results of the workflow runs. A failing version check should only be ignored if the pull request only contains non-functional changes, like documentation.

Once a pull request has been merged, the feature branch will automatically be deleted by GitHub as configured in the repository settings.

As stated above, the workflows will be run for the respective tag on the `master` branch. This helps to keep our repository clean and better manageable.

#### Workflows

There are two workflows for publishing releases to npm:

**Create beta release**  
This workflow creates a beta release for the selected tag.

Example: If we run this workflow for tag v1.3.0, it will publish version 1.3.0 to npm using `npm publish --tag beta`.

The beta tag makes sure that beta testers can install the version from their Homebridge installation. All other users will still receive the latest stable build.

**Create production release**  
This workflow creates a production release for the selected tag.

Example: If we previously published a beta version of v1.3.0 and we run this workflow for the same tag, it will publish the same version to npm using `npm publish`. This will turn the beta release into a production release.

#### Running a workflow
- Navigate to the 'Actions' tab.
- Select the appropriate workflow on the left.
- Click 'Run workflow' on the right.
- Click dropdown under 'Use workflow from'.
- Click 'Tags' and select the appropriate tag.

Note that a release workflow will produce an error if you try to re-publish the same version again. You can release each version only twice – once as a beta release, and once as a production release.

To find out which versions and tags have been uploaded already, check the [package's versions page](https://www.npmjs.com/package/homebridge-panasonic-ac-platform?activeTab=versions).
