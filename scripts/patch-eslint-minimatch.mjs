import fs from 'node:fs';
import path from 'node:path';

const applyPatch = ({ filePath, expected, replacement, label }) => {
    if (!fs.existsSync(filePath)) {
        console.log(`skipping ${label}: ${filePath} not found`);
        return;
    }

    const source = fs.readFileSync(filePath, 'utf8');
    if (source.includes(replacement)) {
        console.log(`${label} patch already applied`);
        return;
    }

    if (!source.includes(expected)) {
        throw new Error(`Expected pattern not found for ${label}`);
    }

    fs.writeFileSync(filePath, source.replace(expected, replacement));
    console.log(`patched ${label}`);
};

{
    const filePath = path.resolve('node_modules/@vscode/vsce/out/package.js');
    if (!fs.existsSync(filePath)) {
        throw new Error(`Expected file for @vscode/vsce minimatch runtime shim at ${filePath}`);
    }

    const source = fs.readFileSync(filePath, 'utf8');
    const importLine = 'const minimatch_1 = __importDefault(require("minimatch"));';
    const oldShim =
        'if (typeof minimatch_1.default !== "function" && typeof minimatch_1.default?.minimatch === "function") {\n' +
        '    minimatch_1.default = minimatch_1.default.minimatch;\n' +
        '}';
    const newShim =
        'if (typeof minimatch_1.default !== "function") {\n' +
        '    const minimatchFallback = typeof minimatch_1.minimatch === "function"\n' +
        '        ? minimatch_1.minimatch\n' +
        '        : (typeof minimatch_1.default?.minimatch === "function" ? minimatch_1.default.minimatch : undefined);\n' +
        '    if (minimatchFallback) {\n' +
        '        minimatch_1.default = minimatchFallback;\n' +
        '    }\n' +
        '}';

    if (source.includes(newShim)) {
        console.log('@vscode/vsce minimatch runtime shim patch already applied');
    } else if (source.includes(oldShim)) {
        fs.writeFileSync(filePath, source.replace(oldShim, newShim));
        console.log('patched @vscode/vsce minimatch runtime shim');
    } else if (source.includes(importLine)) {
        fs.writeFileSync(filePath, source.replace(importLine, `${importLine}\n${newShim}`));
        console.log('patched @vscode/vsce minimatch runtime shim');
    } else {
        throw new Error('Expected pattern not found for @vscode/vsce minimatch runtime shim');
    }
}
