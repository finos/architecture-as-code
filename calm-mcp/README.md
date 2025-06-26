# CALM MCP - With CalmHub

## Required

Running Docker Compose locally.
Use a Mac, because that's what these instructions do :) - PR in any changes for other platforms.

## Getting Started

Start CALM Hub from the `/deploy` directory in the `calm-hub` project using `docker compose up`.
We won't touch this part of the project again. 

To use Claude locally and interact with your MCP server, you will need to install jbang:

```
brew tap jbangdev/tap
brew install jbangdev/tap/jbang
```

You may also need to have maven installed
```
brew install maven
```

Install Claude Desktop from [here](https://claude.ai/download).

## Installing to Maven

run `mvn install` to publish `org.finos:calm-mcp:1.0.0-SNAPSHOT:runner` to your local maven repository

## Configure MCP Server in Claude

Create the following file: `~/Library/Application\ Support/Claude/claude_desktop_config.json` add the following to the file:

```
{
    "mcpServers": {
        "calm-mcp": {
            "command": "jbang",
            "args": ["--quiet",
                    "org.finos:calm-mcp:1.0.0-SNAPSHOT:runner"]
        }
    }
}
```

Starting Claude will also launch the MCP server, which in turn will connect to CalmHub. 
I've added two tools, one to retrieve namespaces another to display some basic information on Calm. 

You can find the logs for the MCP server here: `~/Library/Logs/Claude/`

## Making Changes

I've not done much in terms of changes other than make code changes, mvn install and restart claude. 
There looks to be some interesting tools etc
There are also no tests and minimal structure to this spike!