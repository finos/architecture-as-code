import React, {useEffect, useRef, useState} from 'react';
import styles from './lab.module.css';

const WELCOME_LINE = {text: 'CALM learning lab — type `help` to get started.', kind: 'dim'};

function shortPath(cwd) {
    if (cwd === '/workspace') {
        return '~';
    }
    return cwd.startsWith('/workspace/') ? '~' + cwd.slice('/workspace'.length) : cwd;
}

function Prompt({cwd}) {
    return (
        <>
            <span className={styles.promptUser}>learner@calm-lab</span>
            <span className={styles.promptSep}>:</span>
            <span className={styles.promptPath}>{shortPath(cwd)}</span>
            <span className={styles.promptSep}>$</span>
        </>
    );
}

export default function Terminal({cwd, onRun, onComplete, chromeless = false}) {
    const [lines, setLines] = useState([WELCOME_LINE]);
    const [input, setInput] = useState('');
    const [history, setHistory] = useState([]);
    const historyPos = useRef(-1);
    const scrollRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [lines]);

    const submit = () => {
        const value = input;
        const promptCwd = cwd;
        const result = onRun(value) || [];
        if (result.some((line) => line.kind === 'clear')) {
            setLines([]);
        } else {
            setLines((prev) => [...prev, {text: value, kind: 'cmd', promptCwd}, ...result]);
        }
        if (value.trim()) {
            setHistory((prev) => [...prev, value]);
        }
        historyPos.current = -1;
        setInput('');
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            submit();
        } else if (event.key === 'Tab') {
            event.preventDefault();
            if (!onComplete) {
                return;
            }
            const el = event.target;
            const result = onComplete(input, el.selectionStart ?? input.length);
            if (!result) {
                return;
            }
            if (result.value != null) {
                setInput(result.value);
                const caret = result.caret;
                requestAnimationFrame(() => el.setSelectionRange(caret, caret));
            } else if (result.candidates?.length) {
                setLines((prev) => [
                    ...prev,
                    {text: result.candidates.join('  '), kind: 'dim'},
                ]);
            }
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (history.length) {
                const next =
                    historyPos.current === -1
                        ? history.length - 1
                        : Math.max(0, historyPos.current - 1);
                historyPos.current = next;
                setInput(history[next]);
            }
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (historyPos.current !== -1) {
                const next = historyPos.current + 1;
                if (next >= history.length) {
                    historyPos.current = -1;
                    setInput('');
                } else {
                    historyPos.current = next;
                    setInput(history[next]);
                }
            }
        }
    };

    const focusInput = () => {
        if (typeof window !== 'undefined' && window.getSelection?.()?.toString()) {
            return;
        }
        inputRef.current?.focus();
    };

    return (
        <div className={chromeless ? styles.paneFill : styles.terminalPane} onClick={focusInput}>
            {!chromeless && (
                <div className={styles.paneHeader}>
                    <span className={styles.paneDots} aria-hidden="true">
                        <i /><i /><i />
                    </span>
                    terminal
                </div>
            )}
            <div className={styles.termScroll} ref={scrollRef}>
                {lines.map((line, index) =>
                    line.kind === 'cmd' ? (
                        <div className={styles.termLine} key={index}>
                            <Prompt cwd={line.promptCwd} />
                            <span className={styles.lineCmd}> {line.text}</span>
                        </div>
                    ) : (
                        <div
                            className={`${styles.termLine} ${styles[lineClass(line.kind)]}`}
                            key={index}>
                            {line.text || ' '}
                        </div>
                    ),
                )}
                <div className={styles.promptRow}>
                    <Prompt cwd={cwd} />
                    <input
                        ref={inputRef}
                        className={styles.termInput}
                        aria-label="Terminal input"
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        onKeyDown={handleKeyDown}
                        spellCheck={false}
                        autoComplete="off"
                        autoCapitalize="off"
                        autoCorrect="off"
                    />
                </div>
            </div>
        </div>
    );
}

function lineClass(kind) {
    switch (kind) {
        case 'ok':
            return 'lineOk';
        case 'err':
            return 'lineErr';
        case 'dim':
            return 'lineDim';
        default:
            return 'lineOut';
    }
}
