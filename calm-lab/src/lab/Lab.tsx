import {useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent} from 'react';
import clsx from 'clsx';
import styles from './lab.module.css';
import Terminal from './Terminal';
import Editor from './Editor';
import HubDiagram from './HubDiagram';
import ErrorBoundary from '../ErrorBoundary';
import {createVfs, type Vfs} from './vfs';
import {validateArchitecture, ENGINE_VERSION, type LabValidation} from '../engine';
import {completeCommand, runCommand, type Line} from '../shell';
import {
    ARCHITECTURE_FILE,
    COMPLETION,
    HOME_DIR,
    SEED_FILES,
    STEPS,
    type LessonState,
    type LessonStep,
} from './lesson';

const PROGRESS_KEY = 'calm-lab-progress-v1';
const UI_PREFS_KEY = 'calm-lab-ui-v1';
const EDITOR_FILE_LABEL = 'architecture/trading-system.architecture.json';
const MIN_PANE_HEIGHT = 120;
const SPLITTER_SIZE = 8;
const AUTO_EXPAND = 'auto';

function loadProgress(): Set<string> {
    try {
        const raw = window.localStorage?.getItem(PROGRESS_KEY);
        if (raw) {
            const ids: unknown = JSON.parse(raw);
            if (Array.isArray(ids)) {
                return new Set(ids.filter((id): id is string => STEPS.some((step) => step.id === id)));
            }
        }
    } catch {
        // ignore — start fresh
    }
    return new Set();
}

function saveProgress(completed: Set<string>): void {
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

function loadUiPrefs(): Record<string, unknown> {
    try {
        const raw = window.localStorage?.getItem(UI_PREFS_KEY);
        if (raw) {
            const prefs: unknown = JSON.parse(raw);
            if (prefs && typeof prefs === 'object') {
                return prefs as Record<string, unknown>;
            }
        }
    } catch {
        // ignore
    }
    return {};
}

function saveUiPrefs(prefs: Record<string, unknown>): void {
    try {
        window.localStorage?.setItem(UI_PREFS_KEY, JSON.stringify(prefs));
    } catch {
        // ignore
    }
}

/** Render `code` spans in lesson copy. */
function inline(text: string) {
    return text
        .split('`')
        .map((part, index) => (index % 2 ? <code key={index}>{part}</code> : part));
}

function CopyButton({text}: {text: string}) {
    const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => () => clearTimeout(timerRef.current), []);
    const flash = (next: 'copied' | 'failed') => {
        setState(next);
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setState('idle'), 1800);
    };
    const fallbackCopy = () => {
        try {
            const scratch = document.createElement('textarea');
            scratch.value = text;
            scratch.style.position = 'fixed';
            scratch.style.opacity = '0';
            document.body.appendChild(scratch);
            scratch.focus();
            scratch.select();
            scratch.setSelectionRange(0, text.length);
            const ok = document.execCommand('copy');
            document.body.removeChild(scratch);
            return ok;
        } catch {
            return false;
        }
    };
    const copy = () => {
        // Call writeText synchronously in the click gesture (Safari requires
        // it); fall back to execCommand if it is missing or rejects.
        if (navigator.clipboard?.writeText) {
            navigator.clipboard
                .writeText(text)
                .then(() => flash('copied'))
                .catch(() => flash(fallbackCopy() ? 'copied' : 'failed'));
        } else {
            flash(fallbackCopy() ? 'copied' : 'failed');
        }
    };
    return (
        <button type="button" className={styles.copyBtn} onClick={copy}>
            {state === 'copied' ? 'Copied ✓' : state === 'failed' ? 'Copy failed — select the text' : 'Copy'}
        </button>
    );
}

interface StepItemProps {
    step: LessonStep;
    index: number;
    done: boolean;
    current: boolean;
    open: boolean;
    onToggle(): void;
}

function StepItem({step, index, done, current, open, onToggle}: StepItemProps) {
    const [showHint, setShowHint] = useState(false);
    return (
        <li className={styles.step}>
            <button
                type="button"
                className={styles.stepRow}
                aria-expanded={open}
                onClick={onToggle}>
                <span className={styles.stepIndex}>
                    {String(index + 1).padStart(2, '0')}
                </span>
                <span
                    className={clsx(
                        styles.stepGlyph,
                        done && styles.stepGlyphDone,
                        !done && current && styles.stepGlyphCurrent,
                    )}
                    aria-hidden="true">
                    {done ? '✓' : current ? '●' : '○'}
                </span>
                <span className={styles.stepTitle}>{step.title}</span>
                {done && <span className={styles.srOnly}>(completed)</span>}
            </button>
            <div className={clsx(styles.stepBodyWrap, open && styles.stepBodyOpen)}>
                <div className={styles.stepBodyInner}>
                    <p className={styles.stepBody}>{inline(step.body)}</p>
                    <button
                        type="button"
                        className={styles.hintBtn}
                        aria-expanded={showHint}
                        onClick={() => setShowHint((value) => !value)}>
                        {showHint ? 'Hide hint' : 'Show hint'}
                    </button>
                    {showHint && (
                        <div className={styles.hintBlock}>
                            <div className={styles.hintHead}>
                                <span>{step.hintLabel}</span>
                                <CopyButton text={step.hint} />
                            </div>
                            <pre className={styles.hintPre}>{step.hint}</pre>
                        </div>
                    )}
                </div>
            </div>
        </li>
    );
}

function ProgressDots({completed, currentId, vertical}: {completed: Set<string>; currentId?: string; vertical?: boolean}) {
    return (
        <span
            className={clsx(styles.titleDots, vertical && styles.titleDotsVertical)}
            aria-hidden="true">
            {STEPS.map((step) => (
                <i
                    key={step.id}
                    className={clsx(
                        styles.titleDot,
                        completed.has(step.id)
                            ? styles.dotDone
                            : step.id === currentId
                              ? styles.dotCurrent
                              : styles.dotPending,
                    )}
                />
            ))}
        </span>
    );
}

export default function Lab() {
    const vfsRef = useRef<Vfs | null>(null);
    if (!vfsRef.current) {
        vfsRef.current = createVfs(SEED_FILES);
    }
    const vfs = vfsRef.current;

    const flagsRef = useRef({hasValidatedOk: false});
    // Validation is async now, so results can arrive out of order — only the
    // newest recompute is allowed to publish its result.
    const validationSeq = useRef(0);
    // Bumped by "Reset lesson" — anything captured under an older epoch is
    // discarded rather than applied to the fresh lesson.
    const sessionEpoch = useRef(0);
    const [editorText, setEditorText] = useState(() => vfs.read(ARCHITECTURE_FILE) ?? '');
    const [dirty, setDirty] = useState(false);
    const [cwd, setCwd] = useState(() => vfs.getCwd());
    const [validation, setValidation] = useState<LabValidation | null>(null);

    // completedRef mirrors the completed state so progress can be
    // computed and persisted synchronously inside event handlers (a
    // reload right after completing a step must never lose the tick).
    const completedRef = useRef<Set<string> | null>(null);
    if (completedRef.current === null) {
        completedRef.current = loadProgress();
    }
    const [completed, setCompleted] = useState<Set<string>>(() => completedRef.current!);
    const [terminalNonce, setTerminalNonce] = useState(0);

    // Pane tabs.
    const [topTab, setTopTab] = useState<'editor' | 'diagram'>('editor');
    const [bottomTab, setBottomTab] = useState<'terminal' | 'problems'>('terminal');

    // True while the saved architecture has changed since the diagram
    // was last on screen — drives the "updated" dot on the Diagram tab.
    const [diagramStale, setDiagramStale] = useState(false);

    // Guide accordion: AUTO_EXPAND follows the current step; a step id
    // is a manual selection; null means everything is collapsed.
    const [expandedId, setExpandedId] = useState<string | null>(AUTO_EXPAND);

    // Guide panel visibility (persisted UI preference; desktop only —
    // the stored field keeps its original name for compatibility).
    const [guideCollapsed, setGuideCollapsed] = useState(
        () => Boolean(loadUiPrefs().railHidden),
    );

    // Splitter state (desktop IDE layout only).
    const [termHeight, setTermHeight] = useState<number | null>(null);
    const centerRef = useRef<HTMLDivElement | null>(null);
    const termSlotRef = useRef<HTMLDivElement | null>(null);
    const dragCleanupRef = useRef<(() => void) | null>(null);

    useEffect(() => () => dragCleanupRef.current?.(), []);

    const beginDrag = (event: ReactPointerEvent, onMove: (moveEvent: globalThis.PointerEvent) => void) => {
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

    const startTermDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
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

    const recompute = async () => {
        const text = vfs.read(ARCHITECTURE_FILE) ?? '';
        const seq = ++validationSeq.current;
        let result: LabValidation;
        try {
            result = await validateArchitecture(text);
        } catch (error) {
            if (seq !== validationSeq.current) {
                return;
            }
            // The engine itself failed (schema load, Spectral) — say so rather
            // than leaving the status bar on "checking…" forever.
            setValidation({
                ok: false,
                parseError: 'Validation failed: ' + ((error as {message?: string})?.message ?? String(error)),
                issues: [],
                errors: [],
                issueCount: 1,
                errorCount: 1,
                pretty: '',
            });
            return;
        }
        if (seq !== validationSeq.current) {
            return; // a newer recompute has superseded this one
        }
        setValidation(result);
        const state: LessonState = {
            doc: (result.doc as Record<string, unknown> | undefined) || null,
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
            // Collapse the finished step and expand the next one.
            setExpandedId(AUTO_EXPAND);
        }
    };

    useEffect(() => {
        void recompute();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleEvent = (event: {type: 'validate'; file: string; ok: boolean}) => {
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

    const runShell = async (input: string): Promise<Line[]> => {
        // A reset while `calm validate` is in flight starts a fresh lesson —
        // the in-flight command's output, its event and its recompute all
        // belong to the session the learner threw away.
        const epoch = sessionEpoch.current;
        const lines = await runCommand(input, {
            vfs,
            getCwd: () => vfs.getCwd(),
            setCwd: (dir) => {
                vfs.setCwd(dir);
                setCwd(dir);
            },
            onEvent: (event) => {
                if (epoch === sessionEpoch.current) {
                    handleEvent(event);
                }
            },
        });
        if (epoch !== sessionEpoch.current) {
            return [];
        }
        // Not awaited: `ls`, `cat` and `pwd` must not sit behind a Spectral run
        // with the terminal input disabled. validationSeq orders the results.
        void recompute();
        return lines;
    };

    const completeShell = (input: string, cursor: number | undefined) =>
        completeCommand(input, cursor, {vfs, getCwd: () => vfs.getCwd()});

    const handleSave = () => {
        // Saving is the only mutation path to the architecture file
        // (terminal commands are read-only) — flag the diagram as stale
        // when a save actually changes it while the diagram is hidden;
        // an open diagram re-renders live, so no flag is needed then.
        const changed = vfs.read(ARCHITECTURE_FILE) !== editorText;
        vfs.write(ARCHITECTURE_FILE, editorText);
        if (changed && topTab !== 'diagram') {
            setDiagramStale(true);
        }
        setDirty(false);
        recompute();
    };

    const toggleGuide = () => {
        const next = !guideCollapsed;
        saveUiPrefs({...loadUiPrefs(), railHidden: next});
        setGuideCollapsed(next);
    };

    const handleReset = () => {
        sessionEpoch.current += 1;
        vfs.seed(SEED_FILES);
        clearProgress();
        flagsRef.current = {hasValidatedOk: false};
        completedRef.current = new Set();
        setCompleted(new Set());
        setEditorText(vfs.read(ARCHITECTURE_FILE) ?? '');
        setDirty(false);
        setDiagramStale(false);
        setCwd(HOME_DIR);
        setTerminalNonce((nonce) => nonce + 1);
        setExpandedId(AUTO_EXPAND);
        recompute();
    };

    const currentStep = STEPS.find((step) => !completed.has(step.id));
    const effectiveExpanded =
        expandedId === AUTO_EXPAND ? (currentStep?.id ?? null) : expandedId;
    const allDone = completed.size === STEPS.length;
    // The uncapped total: the Problems tab lists at most 20, the badge must
    // still report every error the engine found.
    const errorCount = validation?.errorCount ?? 0;
    const listedCount = validation?.issues?.length ?? 0;
    const totalCount = validation?.issueCount ?? 0;
    // A parse error (or an engine failure) counts as one problem but lists no
    // issues — it is not a truncated list, so it gets no "showing first" note.
    const capped = !validation?.parseError && totalCount > listedCount;
    // Warnings are informational — they are listed but never make a step fail.
    const warnings = validation?.issues?.filter((issue) => issue.severity === 'warning') ?? [];
    const lineCount = editorText.split('\n').length;
    const savedArchitecture = vfs.read(ARCHITECTURE_FILE) ?? '';
    const cssVars =
        termHeight != null
            ? ({'--lab-term-height': `${termHeight}px`} as CSSProperties)
            : undefined;

    return (
        <main className={styles.workspace} style={cssVars}>
            <div className={styles.chassis}>
                <div className={styles.titlebar}>
                    <ProgressDots completed={completed} currentId={currentStep?.id} />
                    <span className={styles.titleLabel}>CALM LEARNING LAB</span>
                    <button
                        type="button"
                        className={styles.resetBtn}
                        onClick={handleReset}>
                        Reset lesson
                    </button>
                </div>

                <div className={styles.chassisBody}>
                    <nav
                        className={clsx(styles.guide, guideCollapsed && styles.guideHiddenDesktop)}
                        aria-label="Lesson guide">
                        <div className={styles.guideHeader}>
                            <span className={styles.guideTitle}>GUIDE</span>
                            <span className={styles.guideProgress}>
                                {completed.size}/{STEPS.length}
                            </span>
                            <button
                                type="button"
                                className={styles.guideCollapseBtn}
                                aria-label="Collapse guide"
                                aria-expanded="true"
                                onClick={toggleGuide}>
                                «
                            </button>
                        </div>
                        <div className={styles.guideScroll}>
                            <ol className={styles.stepsList}>
                                {STEPS.map((step, index) => (
                                    <StepItem
                                        key={step.id}
                                        step={step}
                                        index={index}
                                        done={completed.has(step.id)}
                                        current={currentStep?.id === step.id}
                                        open={effectiveExpanded === step.id}
                                        onToggle={() =>
                                            setExpandedId(
                                                effectiveExpanded === step.id ? null : step.id,
                                            )
                                        }
                                    />
                                ))}
                            </ol>
                            {allDone && (
                                <div className={styles.doneCard}>
                                    <h3>🏁 {COMPLETION.heading}</h3>
                                    <p>{COMPLETION.message}</p>
                                    <div className={styles.doneLinks}>
                                        {COMPLETION.links.map((link) => (
                                            <a href={link.to} key={link.to}>
                                                {link.label}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </nav>

                    <div
                        className={clsx(
                            styles.guideRail,
                            !guideCollapsed && styles.guideRailHidden,
                        )}>
                        <button
                            type="button"
                            className={styles.guideRailBtn}
                            aria-label="Show guide"
                            aria-expanded="false"
                            onClick={toggleGuide}>
                            GUIDE »
                        </button>
                        <ProgressDots
                            completed={completed}
                            currentId={currentStep?.id}
                            vertical
                        />
                    </div>

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
                                    onClick={() => {
                                        setTopTab('diagram');
                                        setDiagramStale(false);
                                    }}>
                                    Diagram
                                    {diagramStale && (
                                        <>
                                            <span
                                                className={styles.staleDot}
                                                title="The diagram has changed since you last viewed it"
                                                aria-hidden="true"
                                            />
                                            <span className={styles.srOnly}>(updated)</span>
                                        </>
                                    )}
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
                                {/* Mounted only while active so the ReactFlow canvas
                                    always measures a real size and fits on open. */}
                                {topTab === 'diagram' && (
                                    // Keyed on the document so an edit retries a
                                    // render the previous buffer crashed.
                                    <ErrorBoundary
                                        key={savedArchitecture}
                                        fallback={
                                            <div className={styles.diagramEmpty}>
                                                the diagram couldn&apos;t be rendered for this
                                                document — fix the problems in the Problems tab
                                            </div>
                                        }>
                                        <HubDiagram jsonText={savedArchitecture} />
                                    </ErrorBoundary>
                                )}
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
                                    onComplete={completeShell}
                                />
                            </div>
                            <div className={styles.tabPanel} hidden={bottomTab !== 'problems'}>
                                <div className={styles.problemsPanel}>
                                    {(!validation || validation.ok) && !warnings.length ? (
                                        <div className={styles.problemsEmpty}>
                                            no problems — the saved file is schema-valid
                                        </div>
                                    ) : !validation || validation.ok ? null : (
                                        <ul className={styles.problemsList}>
                                            {validation.parseError && <li>{validation.parseError}</li>}
                                            {validation.errors.map((error) => (
                                                <li key={`${error.path}|${error.message}`}>
                                                    ✗ {error.path} — {error.message}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {warnings.length > 0 && (
                                        <ul className={styles.problemsList}>
                                            {warnings.map((warning) => (
                                                <li key={`${warning.path}|${warning.message}`}>
                                                    ⚠ {warning.path} — {warning.message}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {capped && (
                                        <div className={styles.problemsEmpty}>
                                            showing first {listedCount} of {totalCount} problems —
                                            run `calm validate {EDITOR_FILE_LABEL}` for the full
                                            report
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={styles.statusBar}>
                    <span>CALM 1.2 · @finos/calm-shared {ENGINE_VERSION}</span>
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
            </div>
        </main>
    );
}
