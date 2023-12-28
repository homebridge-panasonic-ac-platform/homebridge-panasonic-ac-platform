# Contribution guidelines - for collaborators

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
