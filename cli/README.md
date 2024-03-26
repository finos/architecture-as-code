# Getting started

To get started, clone the project and run the following commands:

```
npm install
npm run build
npm install
```

When you've made a change to the CLI and want to test it out, you can rerun the build and link steps.
This will make the CLI available on your local `node_modules` path.

Type `npx calm` into your terminal, and you should see the help text printed out.

If you want to install it to your local shell, you can also run `npm link`.
This will make the executable available as just `calm`, but will pollute your global NPM profile and may require `sudo` depending on your OS.
