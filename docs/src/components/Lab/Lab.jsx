import React, {useEffect, useRef, useState} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import shared from '../shared.module.css';
import styles from './lab.module.css';
import Terminal from './Terminal';
import Editor from './Editor';
import Diagram from './Diagram';
import {createVfs} from './vfs';
import {validateArchitecture} from './engine';
import {runCommand} from './shell';
import {
    ARCHITECTURE_FILE,
    COMPLETION,
    HOME_DIR,
    SEED_FILES,
    STEPS,
} from './lesson';

const PROGRESS_KEY = 'calm-lab-progress-v1';
const UI_PREFS_KEY = 'calm-lab-ui-v1';
const EDITOR_FILE_LABEL = 'architecture/trading-system.architecture.json';
const MIN_PANE_HEIGHT = 120;
const SPLITTER_SIZE = 8;

function loadProgress() {
    try {
        const raw = window.localStorage?.getItem(PROGRESS_KEY);
        if (raw) {
            const ids = JSON.parse(raw);
            if (Array.isArray(ids)) {
                return new Set(ids.filter((id) => STEPS.some((step) => step.id === id)));
            }
        }
    } catch {
        // ignore — start fresh
    }
    return new Set();
}

function saveProgress(completed) {
    try {
        window.localStorage?.setItem(PROGRESS_KEY, JSON.stringify([...completed]));
    } catch {
        // ignore
    }
}

function clearProgress() {
    try {
        window.localStorage?.removeItem(PROGRESS_KEY);
    } catch {
        // ignore
    }
}

function loadUiPrefs() {
    try {
        const raw = window.localStorage?.getItem(UI_PREFS_KEY);
        if (raw) {
            const prefs = JSON.parse(raw);
            if (prefs && typeof prefs === 'object') {
                return prefs;
            }
        }
    } catch {
        // ignore
    }
    return {};
}

function saveUiPrefs(prefs) {
    try {
        window.localStorage?.setItem(UI_PREFS_KEY, JSON.stringify(prefs));
    } catch {
        // ignore
    }
}

/** Render `code` spans in lesson copy. */
function inline(text) {
    return text
        .split('`')
        .map((part, index) => (index % 2 ? <code key={index}>{part}</code> : part));
}

function StepItem({step, index, done, current}) {
    const [showHint, setShowHint] = useState(false);
    return (
        <li
            className={clsx(
                styles.step,
                current && styles.stepCurrent,
                done && styles.stepDone,
            )}
            aria-current={current ? 'step' : undefined}>
            <div className={styles.stepHead}>
                <span
                    className={clsx(
                        styles.stepBadge,
                        done && styles.stepBadgeDone,
                        current && !done && styles.stepBadgeCurrent,
                    )}
                    aria-hidden="true">
                    {done ? '✓' : index + 1}
                </span>
                <h3>
                    {step.title}
                    {done && <span className={styles.srOnly}> (completed)</span>}
                </h3>
            </div>
            <p className={styles.stepBody}>{inline(step.body)}</p>
            <button
                type="button"
                className={styles.hintBtn}
                aria-expanded={showHint}
                onClick={() => setShowHint((open) => !open)}>
                {showHint ? 'Hide hint' : 'Show hint'}
            </button>
            {showHint && <pre className={styles.hintPre}>{step.hint}</pre>}
        </li>
    );
}

export default function Lab() {
    const vfsRef = useRef(null);
    if (!vfsRef.current) {
        vfsRef.current = createVfs(SEED_FILES);
    }
    const vfs = vfsRef.current;

    const flagsRef = useRef({hasValidatedOk: false});
    const [editorText, setEditorText] = useState(() => vfs.read(ARCHITECTURE_FILE) ?? '');
    const [dirty, setDirty] = useState(false);
    const [cwd, setCwd] = useState(() => vfs.getCwd());
    const [validation, setValidation] = useState(null);

    // completedRef mirrors the completed state so progress can be
    // computed and persisted synchronously inside event handlers (a
    // reload right after completing a step must never lose the tick).
    const completedRef = useRef(null);
    if (completedRef.current === null) {
        completedRef.current = loadProgress();
    }
    const [completed, setCompleted] = useState(() => completedRef.current);
    const [terminalNonce, setTerminalNonce] = useState(0);

    // Pane tabs.
    const [topTab, setTopTab] = useState('editor');
    const [bottomTab, setBottomTab] = useState('terminal');

    // Lesson rail visibility (persisted UI preference; desktop only).
    const [railHidden, setRailHidden] = useState(() => Boolean(loadUiPrefs().railHidden));

    // Splitter state (desktop IDE layout only).
    const [termHeight, setTermHeight] = useState(null);
    const centerRef = useRef(null);
    const termSlotRef = useRef(null);
    const dragCleanupRef = useRef(null);

    useEffect(() => () => dragCleanupRef.current?.(), []);

    const beginDrag = (event, onMove) => {
        event.preventDefault();
        const stop = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', stop);
            dragCleanupRef.current = null;
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', stop);
        window.addEventListener('pointercancel', stop);
        dragCleanupRef.current = stop;
    };

    const startTermDrag = (event) => {
        const startY = event.clientY;
        const startHeight = termSlotRef.current?.offsetHeight ?? 0;
        const columnHeight = centerRef.current?.offsetHeight ?? 0;
        const maxHeight = Math.max(
            MIN_PANE_HEIGHT,
            columnHeight - MIN_PANE_HEIGHT - SPLITTER_SIZE,
        );
        beginDrag(event, (moveEvent) => {
            const next = startHeight - (moveEvent.clientY - startY);
            setTermHeight(Math.min(Math.max(next, MIN_PANE_HEIGHT), maxHeight));
        });
    };

    const recompute = () => {
        const text = vfs.read(ARCHITECTURE_FILE) ?? '';
        const result = validateArchitecture(text);
        setValidation(result);
        const state = {
            doc: result.doc || null,
            validation: result,
            hasValidatedOk: flagsRef.current.hasValidatedOk,
        };
        let changed = false;
        const next = new Set(completedRef.current);
        for (const step of STEPS) {
            if (!next.has(step.id) && step.check(state)) {
                next.add(step.id);
                changed = true;
            }
        }
        if (changed) {
            // Persist synchronously, before any render, so a reload
            // immediately after completing a step keeps the tick.
            completedRef.current = next;
            saveProgress(next);
            setCompleted(next);
        }
    };

    useEffect(() => {
        recompute();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleEvent = (event) => {
        if (event.type !== 'validate' || !event.ok) {
            return;
        }
        // Compare resolved-to-resolved so any path spelling that reaches
        // the lesson file ('./x', 'architecture//x', relative from a cd'd
        // directory, ...) counts.
        const eventFile = vfs.resolve('/', event.file || '');
        const lessonFile = vfs.resolve('/', ARCHITECTURE_FILE);
        if (eventFile === lessonFile) {
            flagsRef.current.hasValidatedOk = true;
        }
    };

    const runShell = (input) => {
        const lines = runCommand(input, {
            vfs,
            getCwd: () => vfs.getCwd(),
            setCwd: (dir) => {
                vfs.setCwd(dir);
                setCwd(dir);
            },
            engine: {validateArchitecture},
            onEvent: handleEvent,
        });
        recompute();
        return lines;
    };

    const handleSave = () => {
        vfs.write(ARCHITECTURE_FILE, editorText);
        setDirty(false);
        recompute();
    };

    const toggleRail = () => {
        const next = !railHidden;
        saveUiPrefs({...loadUiPrefs(), railHidden: next});
        setRailHidden(next);
    };

    const handleReset = () => {
        vfs.seed(SEED_FILES);
        clearProgress();
        flagsRef.current = {hasValidatedOk: false};
        completedRef.current = new Set();
        setCompleted(new Set());
        setEditorText(vfs.read(ARCHITECTURE_FILE) ?? '');
        setDirty(false);
        setCwd(HOME_DIR);
        setTerminalNonce((nonce) => nonce + 1);
        recompute();
    };

    const currentStep = STEPS.find((step) => !completed.has(step.id));
    const allDone = completed.size === STEPS.length;
    const errorCount = validation ? validation.errors.length + (validation.parseError ? 1 : 0) : 0;
    const lineCount = editorText.split('\n').length;
    const cssVars =
        termHeight != null ? {'--lab-term-height': `${termHeight}px`} : undefined;

    return (
        <main className={styles.workspace} style={cssVars}>
            <div className={styles.toolbar}>
                <button
                    type="button"
                    className={styles.railToggle}
                    aria-label={railHidden ? 'Show lesson panel' : 'Hide lesson panel'}
                    aria-expanded={!railHidden}
                    onClick={toggleRail}>
                    {railHidden ? '▶ Lessons' : '◀ Lessons'}
                </button>
                <span className={shared.eyebrow}>Learn · Lab</span>
                <h1 className={styles.toolbarTitle}>CALM Learning Lab</h1>
                <button
                    type="button"
                    className={clsx(shared.btnGhost, styles.resetBtn)}
                    onClick={handleReset}>
                    Reset lesson
                </button>
            </div>

            <div className={clsx(styles.grid, railHidden && styles.gridNoRail)}>
                <nav className={styles.stepsRail} aria-label="Lesson steps">
                    <ol className={styles.stepsList}>
                        {STEPS.map((step, index) => (
                            <StepItem
                                key={step.id}
                                step={step}
                                index={index}
                                done={completed.has(step.id)}
                                current={currentStep?.id === step.id}
                            />
                        ))}
                    </ol>
                    {allDone && (
                        <div className={styles.doneCard}>
                            <h3>🏁 {COMPLETION.heading}</h3>
                            <p>{COMPLETION.message}</p>
                            <div className={styles.doneLinks}>
                                {COMPLETION.links.map((link) => (
                                    <Link to={link.to} key={link.to}>
                                        {link.label}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </nav>

                <div className={styles.centerCol} ref={centerRef}>
                    <div className={clsx(styles.tabbedPane, styles.editorSlot)}>
                        <div className={styles.tabBar} role="tablist" aria-label="Editor panes">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={topTab === 'editor'}
                                className={clsx(styles.tab, topTab === 'editor' && styles.tabActive)}
                                onClick={() => setTopTab('editor')}>
                                {EDITOR_FILE_LABEL}
                                {dirty && (
                                    <span
                                        className={styles.dirtyDot}
                                        title="Unsaved changes"
                                        aria-label="Unsaved changes">
                                        ●
                                    </span>
                                )}
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={topTab === 'diagram'}
                                className={clsx(styles.tab, topTab === 'diagram' && styles.tabActive)}
                                onClick={() => setTopTab('diagram')}>
                                Diagram
                            </button>
                            <div className={styles.tabBarActions}>
                                <button
                                    type="button"
                                    className={styles.saveBtn}
                                    onClick={handleSave}
                                    title="Save (Cmd/Ctrl+S)">
                                    Save (⌘S)
                                </button>
                            </div>
                        </div>
                        <div className={styles.tabPanel} hidden={topTab !== 'editor'}>
                            <Editor
                                chromeless
                                fileName={EDITOR_FILE_LABEL}
                                value={editorText}
                                dirty={dirty}
                                onChange={(text) => {
                                    setEditorText(text);
                                    setDirty(true);
                                }}
                                onSave={handleSave}
                            />
                        </div>
                        <div className={styles.tabPanel} hidden={topTab !== 'diagram'}>
                            <Diagram chromeless jsonText={editorText} />
                        </div>
                    </div>
                    <div
                        className={styles.hSplitter}
                        role="separator"
                        aria-orientation="horizontal"
                        aria-label="Resize editor and terminal"
                        onPointerDown={startTermDrag}
                    />
                    <div className={clsx(styles.tabbedPane, styles.termSlot)} ref={termSlotRef}>
                        <div className={styles.tabBar} role="tablist" aria-label="Terminal panes">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={bottomTab === 'terminal'}
                                className={clsx(styles.tab, bottomTab === 'terminal' && styles.tabActive)}
                                onClick={() => setBottomTab('terminal')}>
                                Terminal
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={bottomTab === 'problems'}
                                className={clsx(styles.tab, bottomTab === 'problems' && styles.tabActive)}
                                onClick={() => setBottomTab('problems')}>
                                Problems
                                {errorCount > 0 && (
                                    <span className={styles.tabBadge}>{errorCount}</span>
                                )}
                            </button>
                        </div>
                        <div className={styles.tabPanel} hidden={bottomTab !== 'terminal'}>
                            <Terminal
                                chromeless
                                key={terminalNonce}
                                cwd={cwd}
                                onRun={runShell}
                            />
                        </div>
                        <div className={styles.tabPanel} hidden={bottomTab !== 'problems'}>
                            <div className={styles.problemsPanel}>
                                {!validation || validation.ok ? (
                                    <div className={styles.problemsEmpty}>
                                        no problems — the saved file is schema-valid
                                    </div>
                                ) : (
                                    <ul className={styles.problemsList}>
                                        {validation.parseError && <li>{validation.parseError}</li>}
                                        {validation.errors.map((error) => (
                                            <li key={`${error.path}|${error.message}`}>
                                                ✗ {error.path} — {error.message}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.statusBar}>
                <span>CALM 1.2 · Ajv engine</span>
                {!validation ? (
                    <span>checking…</span>
                ) : validation.ok ? (
                    <span className={styles.statusOk}>✓ schema-valid</span>
                ) : (
                    <button
                        type="button"
                        className={clsx(styles.statusErr, styles.statusErrBtn)}
                        title="Open the Problems tab"
                        onClick={() => setBottomTab('problems')}>
                        ✗ {errorCount} problem{errorCount === 1 ? '' : 's'}
                    </button>
                )}
                <span className={styles.statusFile}>
                    {EDITOR_FILE_LABEL}
                    {dirty ? ' ●' : ''} · {lineCount} lines
                </span>
            </div>
        </main>
    );
}
