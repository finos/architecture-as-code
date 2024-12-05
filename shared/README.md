# Shared Logic Module

This module provides shared logic such as validation and visualization utilities, intended for use across various plugins and tools in the codebase. It simplifies code reuse and promotes a unified logic layer, making it easier to maintain and extend.



# Spectral validation rules for CALM implementations

`As of November 2024 - Spectral rules are bundled into shared and converted into typescript representation. `

These rules perform simple structural checks on CALM implementation files to verify that they make sense semantically.
For example, if a relationship references a node, then that node should exist in the file.

## Running Spectral Rulesets Manually
**Prerequisites**: You need `npm` on your machine.
Tested on Node v20.11.1.

```bash
npm install -g @stoplight/spectral-cli
```

This will install the `spectral` command globally. 
Note that you may need to add `sudo` if you're on a machine that lets you do this. 

If you can't run things as root, remove `-g`; you'll then need to use `npx spectral` to reference the executable in `node_modules`.

## Running checks
To run the rulesets against the sample spec, which should produce several errors - these commands assume you're running from the root of the repository.

```bash
# 1 Install the project
npm install

# 2 Ensure the project is built. 
npm run build

# 3 Invoke spectral referencing the disted rules you're interested in
spectral lint --ruleset ./shared/dist/spectral/rules-instantiation.js ./shared/spectral-examples/bad-rest-api.json
```

## Learn more
See the [Spectral documentation](https://docs.stoplight.io/docs/spectral/674b27b261c3c-overview) for more information on how to configure the Spectral rules.
