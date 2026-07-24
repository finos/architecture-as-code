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
    hasConnectsRelationship,
} from './lesson';

const PROGRESS_KEY = 'calm-lab-progress-v1';
const EDITOR_FILE_LABEL = 'architecture/trading-system.architecture.json';

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

    const flagsRef = useRef({hasValidatedOk: false, validatedWithRelationship: false});
    const [editorText, setEditorText] = useState(() => vfs.read(ARCHITECTURE_FILE) ?? '');
    const [dirty, setDirty] = useState(false);
    const [cwd, setCwd] = useState(() => vfs.getCwd());
    const [validation, setValidation] = useState(null);
    const [completed, setCompleted] = useState(loadProgress);
    const [terminalNonce, setTerminalNonce] = useState(0);

    const recompute = () => {
        const text = vfs.read(ARCHITECTURE_FILE) ?? '';
        const result = validateArchitecture(text);
        setValidation(result);
        const state = {
            doc: result.doc || null,
            validation: result,
            hasValidatedOk: flagsRef.current.hasValidatedOk,
            validatedWithRelationship: flagsRef.current.validatedWithRelationship,
        };
        setCompleted((prev) => {
            let changed = false;
            const next = new Set(prev);
            for (const step of STEPS) {
                if (!next.has(step.id) && step.check(state)) {
                    next.add(step.id);
                    changed = true;
                }
            }
            if (changed) {
                saveProgress(next);
                return next;
            }
            return prev;
        });
    };

    useEffect(() => {
        recompute();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleEvent = (event) => {
        if (event.type === 'validate' && event.file === ARCHITECTURE_FILE && event.ok) {
            flagsRef.current.hasValidatedOk = true;
            const result = validateArchitecture(vfs.read(ARCHITECTURE_FILE) ?? '');
            if (result.doc && hasConnectsRelationship(result.doc)) {
                flagsRef.current.validatedWithRelationship = true;
            }
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

    const handleReset = () => {
        vfs.seed(SEED_FILES);
        clearProgress();
        flagsRef.current = {hasValidatedOk: false, validatedWithRelationship: false};
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

    return (
        <main>
            <section className={clsx(shared.banner, styles.banner)}>
                <div className={clsx(shared.wrap, styles.bannerRow)}>
                    <div>
                        <span className={shared.eyebrow}>Learn · Lab</span>
                        <h1>CALM Learning Lab</h1>
                        <p>
                            Model and validate a real CALM architecture — terminal, editor and
                            live diagram, entirely in your browser.
                        </p>
                    </div>
                    <button
                        type="button"
                        className={clsx(shared.btnGhost, styles.resetBtn)}
                        onClick={handleReset}>
                        Reset lesson
                    </button>
                </div>
            </section>

            <section className={styles.labSection}>
                <div className={styles.grid}>
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

                    <div className={styles.mainCol}>
                        <Editor
                            fileName={EDITOR_FILE_LABEL}
                            value={editorText}
                            dirty={dirty}
                            onChange={(text) => {
                                setEditorText(text);
                                setDirty(true);
                            }}
                            onSave={handleSave}
                        />
                        <Terminal key={terminalNonce} cwd={cwd} onRun={runShell} />
                    </div>

                    <aside className={styles.side}>
                        <Diagram jsonText={editorText} />
                        <div className={styles.statusCard}>
                            <div className={styles.statusTitle}>validation</div>
                            {!validation ? (
                                <div className={styles.statusDim}>checking…</div>
                            ) : validation.ok ? (
                                <div className={styles.statusOk}>✓ valid CALM architecture</div>
                            ) : (
                                <>
                                    <div className={styles.statusErr}>
                                        ✗ {errorCount} problem{errorCount === 1 ? '' : 's'} found
                                    </div>
                                    <ul className={styles.statusList}>
                                        {validation.parseError && <li>{validation.parseError}</li>}
                                        {validation.errors.slice(0, 4).map((error) => (
                                            <li key={`${error.path}|${error.message}`}>
                                                {error.path} — {error.message}
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                            {dirty && (
                                <div className={styles.statusDim}>
                                    unsaved changes — save to re-check
                                </div>
                            )}
                        </div>
                    </aside>
                </div>
            </section>
        </main>
    );
}
