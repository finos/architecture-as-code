# Developing the CALM CLI

## One-time environment set-up

### [Flox](https://flox.dev) users

  1. Clone the git repo and `cd` into the directory.
  1. Run `flox activate`.  The first time you do this, it will locally install all the dependencies and Node packages, and configure the environment ready for you to develop and test.


### Everyone else

  1. Install Node v20.18.1 (use `nvm` to manage Node versions if needed).  The `canvas` package we use does not seem to be compatible with later versions of node.
  1. Make sure `libuuid.so` is installed (`ldconfig -p | grep libuuid`) and install it if not (instructions will depend on your OS).
  1. Clone the git repo and `cd` into the directory
  1. Run the following:
  ```shell
     npm install
     npm run build
     npx link cli
  ```

## Building & linking the CLI

When you've made a change to the CLI and want to test it out, you can rerun the build and link steps from within the `cli` directory:

```shell
npm run build
npx link .
```

This will make the CLI available on your local `node_modules` path.

`npx link` uses the `link` package to symlink the `calm` executable in `node_modules/.bin` to your locally-built CLI.

Note: you can also use `npm link` but this installs to your global package registry.
This will make the executable available as just `calm`, but will pollute your global NPM profile and may require `sudo` depending on your OS.

## Additional Commands

Some other commands that you might find useful during development include:

- `npm run lint` to point out any lint errors in the code
- `npm run test` to run the tests against the code base

You can find the full list by examining the `package.json`

## OWASP DEPENDENCY-CHECK
The [OWASP dependency check tool](https://jeremylong.github.io/DependencyCheck/) will run on PRs and periodically on the committed code, but it can be helpful to be able to run this locally to investigate CVEs.

To use the dependency check tool locally, first install the tool following the instructions for your operating system [here](https://jeremylong.github.io/DependencyCheck/dependency-check-cli/index.html).

Once that is done the tool is configured as a script in the package.json, run `npm run dependency-check`; the reports will be output to `cli/dependency-check-report`.