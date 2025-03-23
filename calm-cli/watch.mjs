/**
 * This script uses `chokidar` to watch for changes in the `src` and `shared/dist` directories.
 * When a change is detected, it triggers a rebuild of the project by running the `npm run build` command.
 * 
 * The purpose of this script is to automate the build process during development, ensuring that any changes
 * to the source files or shared distribution files are quickly reflected in the build output.
 * 
 * The script sets a debounce timeout of 5 seconds to prevent multiple rapid rebuilds in quick succession.
 * It also ignores changes to `.map` files to avoid unnecessary rebuilds from compiled JavaScript files.
 * 
 * Usage:
 * - Run this script to start watching for changes and automatically rebuild the project when changes are detected.
 */
import { exec } from 'child_process';
import chokidar from 'chokidar';

let timeout;

const runBuild = () => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
        console.log('Rebuilding...');
        exec('npm run build', (err, stdout, stderr) => {
            if (err) {
                console.error(`Error during build: ${stderr}`);
                return;
            }
            console.log(stdout);
        });
    }, 5000); 
};


const watcher = chokidar.watch(['src', '../shared/dist'], {
    persistent: true,
    ignoreInitial: true,
    ignored: ['**/*.map']
});

watcher.on('all', (event, path) => {
    console.log(`File ${path} has been ${event}.`);
    runBuild();
});

console.log('Watching for changes in src and shared/dist...');