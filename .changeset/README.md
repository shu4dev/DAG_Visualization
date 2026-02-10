# Changesets

This directory contains changeset files for version management.

## How to use

When you make changes that should be released:

```bash
pnpm changeset
```

Follow the prompts to:
1. Select which packages have changed
2. Choose the type of change (major, minor, patch)
3. Write a summary of the changes

The changeset will be added to this directory. When ready to release:

```bash
pnpm version-packages
pnpm release
```

For more information, see the [Changesets documentation](https://github.com/changesets/changesets).
