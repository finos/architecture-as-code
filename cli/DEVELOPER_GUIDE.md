# Developing the CALM CLI

## Building & linking the CLI

Clone the project and run the following commands:

```shell
npm install
npm run build
npx link
```

When you've made a change to the CLI and want to test it out, you can rerun the build and link steps.
This will make the CLI available on your local `node_modules` path.

`npx link` uses the `link` package to symlink the `calm` executable in `node_modules/.bin` to your locally-built CLI.

Note: you can also use `npm link` but this installs to your global package registry.
This will make the executable available as just `calm`, but will pollute your global NPM profile and may require `sudo` depending on your OS.

## Additional Commands

Some other commands that you might find useful during development include:

- `npm run lint` to point out any lint errors in the code
- `npm run test` to run the tests against the code base

You can find the full list by examining the `package.json`
