# Getting started

To get started, clone the project and run the following commands:

```
npm install
npm run build
npx link
```

When you've made a change to the CLI and want to test it out, you can rerun the build and link steps.
This will make the CLI available on your local `node_modules` path.

Type `npx calm` into your terminal, and you should see the help text printed out.

`npx link` uses the `link` package to symlink the `calm` executable in `node_modules/.bin` to your locally-built CLI.

Note: you can also use `npm link` but this installs to your global package registry.
This will make the executable available as just `calm`, but will pollute your global NPM profile and may require `sudo` depending on your OS.
