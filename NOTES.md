bug when NOT working out of root dir. not all the comands seem to correctly discover the root workspaces folder
bug with clean command not deleting properly

Ideas:
User shouldn't be able to work on pulled files that were created by calm pull unless they opt in.
Core idea being you only really care about the stuff that was added to the workspace.
Similarly calm workspace tree shouldn't link files if they were pulled

Along this idea workspace 'files' directory should probably just go into the current working directory. top level should just be an index.

Maybe a command to take a file in the top level cache and put it in current working directory.

Maybe shared schemas can go into the top level folder to avoid cluttering local workspaces.

logging for most of the workspace commands should probably not use the structured winston logging. the output is the user interface, this is not diagnostic and should be turned off bydefault.