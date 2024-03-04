# CALM Specification Visualizer

This is a tool for visualizing a CALM Specification.
The tool will create a directed graph which represents the architecture that you've laid out in your spec.

## Features

- The nodes of the graph can be dragged around to create a better layout if you need it.
- You can right click on a node to get a json representation of the node which could contain details that aren't shown in the graph.

## How to use

- Clone the project
- Run `npm install`
- Edit the following line of App.tsx to point to your CALM specification:

```typescript
import * as calmSpec from "./assets/traderx-calm.json";
```

- Start the app with `npm start`
- Follow the link in the terminal output to open the app in a browser and view the graph

## Example

There is an example CALM Specification at `src/assets/traderx-calm.json`.
By default, the app will use this spec to create the graph, which looks like this:

![Example CALM Spec](example-graph.png "Example CALM Spec")
