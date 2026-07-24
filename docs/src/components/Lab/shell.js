/**
 * Command interpreter for the lab terminal. Pure logic: takes an input
 * line plus a context (vfs, cwd accessors, validation engine, event
 * sink) and returns coloured output lines for the terminal to render.
 *
 * Line kinds: 'out' (normal), 'ok' (green), 'err' (red), 'dim' (muted),
 * and the special 'clear' sentinel telling the terminal to empty its
 * scrollback.
 */

const HELP_LINES = [
    {text: 'Available commands:', kind: 'out'},
    {text: '  ls [path]            list files', kind: 'dim'},
    {text: '  cat <file>           print a file', kind: 'dim'},
    {text: '  cd <dir>             change directory', kind: 'dim'},
    {text: '  pwd                  print working directory', kind: 'dim'},
    {text: '  echo <text>          print text', kind: 'dim'},
    {text: '  clear                clear the terminal', kind: 'dim'},
    {text: '  calm validate <file> validate a CALM architecture', kind: 'dim'},
    {text: '  calm --version       show the lab engine version', kind: 'dim'},
];

const CALM_HELP_LINES = [
    {text: 'calm — CALM in your browser', kind: 'out'},
    {text: '  calm validate <file>   validate against the CALM 1.2 schemas', kind: 'dim'},
    {text: '  calm --version         show the lab engine version', kind: 'dim'},
    {text: '  calm help              show this help', kind: 'dim'},
];

function runCalm(args, ctx) {
    const [sub, ...rest] = args;
    if (!sub || sub === 'help' || sub === '--help') {
        return CALM_HELP_LINES;
    }
    if (sub === '--version' || sub === '-v') {
        return [{text: 'browser lab · engine: CALM 1.2 schemas + Ajv', kind: 'out'}];
    }
    if (sub === 'validate') {
        const target = rest[0];
        if (!target) {
            return [{text: 'usage: calm validate <file>', kind: 'err'}];
        }
        const path = ctx.vfs.resolve(ctx.getCwd(), target);
        if (!ctx.vfs.exists(path)) {
            return [{text: `calm validate: file not found: ${target}`, kind: 'err'}];
        }
        const result = ctx.engine.validateArchitecture(ctx.vfs.read(path));
        if (ctx.onEvent) {
            ctx.onEvent({type: 'validate', file: path, ok: result.ok});
        }
        if (result.ok) {
            return [{text: `✓ ${target} is a valid CALM architecture`, kind: 'ok'}];
        }
        if (result.parseError) {
            return [{text: `  ✗ / — ${result.parseError}`, kind: 'err'}];
        }
        return [
            {text: `${target}: ${result.errors.length} problem${result.errors.length === 1 ? '' : 's'} found`, kind: 'dim'},
            ...result.errors.map((error) => ({text: `  ✗ ${error.path} — ${error.message}`, kind: 'err'})),
        ];
    }
    return [
        {
            text: `\`calm ${sub}\` isn't available in the browser lab yet — see the full CLI docs at /working-with-calm/cli`,
            kind: 'dim',
        },
    ];
}

export function runCommand(input, ctx) {
    const trimmed = input.trim();
    if (!trimmed) {
        return [];
    }
    const [cmd, ...args] = trimmed.split(/\s+/);
    const {vfs} = ctx;

    switch (cmd) {
        case 'help':
            return HELP_LINES;
        case 'pwd':
            return [{text: ctx.getCwd(), kind: 'out'}];
        case 'clear':
            return [{text: '', kind: 'clear'}];
        case 'echo':
            return [{text: args.join(' '), kind: 'out'}];
        case 'ls': {
            const path = vfs.resolve(ctx.getCwd(), args[0] || '.');
            if (vfs.exists(path)) {
                return [{text: path.split('/').pop(), kind: 'out'}];
            }
            if (vfs.isDir(path)) {
                return vfs.list(path).map((entry) => ({
                    text: entry.isDir ? `${entry.name}/` : entry.name,
                    kind: entry.isDir ? 'dim' : 'out',
                }));
            }
            return [{text: `ls: no such file or directory: ${args[0] || path}`, kind: 'err'}];
        }
        case 'cat': {
            if (!args[0]) {
                return [{text: 'usage: cat <file>', kind: 'err'}];
            }
            const path = vfs.resolve(ctx.getCwd(), args[0]);
            if (vfs.isDir(path) && !vfs.exists(path)) {
                return [{text: `cat: ${args[0]}: is a directory`, kind: 'err'}];
            }
            const content = vfs.read(path);
            if (content === null) {
                return [{text: `cat: ${args[0]}: no such file`, kind: 'err'}];
            }
            return content
                .replace(/\n$/, '')
                .split('\n')
                .map((text) => ({text, kind: 'out'}));
        }
        case 'cd': {
            const path = vfs.resolve(ctx.getCwd(), args[0] || '/workspace');
            if (!vfs.isDir(path)) {
                return [{text: `cd: no such directory: ${args[0] || path}`, kind: 'err'}];
            }
            ctx.setCwd(path);
            return [];
        }
        case 'calm':
            return runCalm(args, ctx);
        default:
            return [{text: `command not found: ${cmd} — try \`help\``, kind: 'err'}];
    }
}
