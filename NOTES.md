Points for improvement
Do these one at a time, not all at once.

# calm workspace clean
- Should only clean up the currently-active workspace
- Should have a --all flag to clean up everything (current behaviour)

# tree prints too much
- if a file to be printed by calm workspace print is in the files directory inside the bundle, i.e. it was pulled rather than being explicitly calm workspace added, just print (workspace) for the file path instead of the full path.
  Core idea being you only really care about the stuff that was added to the workspace.

# logging is way too verbose for pull command
pull command prints tons of diagnostic logs from the schema loader. these should be suppressed unless --verbose is provided or loading of a file fails completely.


# ignore beyond this point, these are just ideas
Along this idea workspace 'files' directory should probably just go into the current working directory. top level should just be an index.

Maybe a command to take a file in the top level cache and put it in current working directory.

Maybe shared schemas can go into the top level folder to avoid cluttering local workspaces.

logging for most of the workspace commands should probably not use the structured winston logging. the output is the user interface, this is not diagnostic and should be turned off bydefault.