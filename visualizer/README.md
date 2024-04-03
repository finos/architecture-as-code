# CALM Visualizer

This tool will take a CALM specification and convert the nodes and relationships into the [Mermaid](https://mermaid.js.org) format.
It then renders the Mermaid string into an SVG and outputs the file, which you can then open in a browser to view for example.

In order to render Mermaid, we need to have a browser context which isn't usually available in a Node environment.
The way we achieve this is by using the [Playwright](https://playwright.dev) library to create a headless browser in the background to render the Mermaid.

## Getting Started

This project is intended to be consumed as a library.
To test out your changes, you'll need to run the following commands:

```
npm install
npm run build
npm run package
```

This will output a file called `calm-visualizer-<version>.tgz` which you can then import into a project to use.

The library exports a single function called `visualize` which takes a string that represents the file containing the CALM specification, and outputs an svg file with the visualization.

### Example Usage

```typescript
import { visualize } from "calm-visualizer";

const calm = "<insert-calm-spec-here>";
const svg = await visualize(calm);
console.log(svg);
```
