import React, {useMemo, useRef} from 'react';
import styles from './lab.module.css';

const TOKEN_CLASS = {
    key: 'tokKey',
    string: 'tokString',
    number: 'tokNumber',
    literal: 'tokLiteral',
    punct: 'tokPunct',
};

const TOKEN_RE =
    /("(?:\\.|[^"\\\n])*"?)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],:])/g;
const KEY_LOOKAHEAD_RE = /\s*:/y;

/**
 * Minimal JSON lexer for the highlight overlay. Best-effort by design:
 * unknown/broken input falls through as plain text and the function
 * never throws (the textarea, not this layer, is the source of truth).
 * A string is a "key" when the next non-space character is `:`.
 */
function tokenizeJson(text) {
    try {
        const tokens = [];
        let last = 0;
        let match;
        TOKEN_RE.lastIndex = 0;
        while ((match = TOKEN_RE.exec(text)) !== null) {
            if (match.index > last) {
                tokens.push({text: text.slice(last, match.index), type: 'plain'});
            }
            const [full, str, num, lit] = match;
            if (str !== undefined) {
                KEY_LOOKAHEAD_RE.lastIndex = TOKEN_RE.lastIndex;
                const isKey = KEY_LOOKAHEAD_RE.test(text);
                tokens.push({text: full, type: isKey ? 'key' : 'string'});
            } else if (num !== undefined) {
                tokens.push({text: full, type: 'number'});
            } else if (lit !== undefined) {
                tokens.push({text: full, type: 'literal'});
            } else {
                tokens.push({text: full, type: 'punct'});
            }
            last = TOKEN_RE.lastIndex;
        }
        if (last < text.length) {
            tokens.push({text: text.slice(last), type: 'plain'});
        }
        return tokens;
    } catch {
        return [{text, type: 'plain'}];
    }
}

export default function Editor({fileName, value, dirty, onChange, onSave, chromeless = false}) {
    const gutterRef = useRef(null);
    const highlightRef = useRef(null);
    const textareaRef = useRef(null);
    const lineCount = value.split('\n').length;
    const tokens = useMemo(() => tokenizeJson(value), [value]);

    const syncScroll = () => {
        const textarea = textareaRef.current;
        if (!textarea) {
            return;
        }
        if (gutterRef.current) {
            gutterRef.current.scrollTop = textarea.scrollTop;
        }
        if (highlightRef.current) {
            highlightRef.current.scrollTop = textarea.scrollTop;
            highlightRef.current.scrollLeft = textarea.scrollLeft;
        }
    };

    const handleKeyDown = (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
            event.preventDefault();
            onSave();
            return;
        }
        if (event.key === 'Tab') {
            event.preventDefault();
            const el = event.target;
            const {selectionStart, selectionEnd} = el;
            onChange(value.slice(0, selectionStart) + '  ' + value.slice(selectionEnd));
            requestAnimationFrame(() => {
                el.setSelectionRange(selectionStart + 2, selectionStart + 2);
            });
        }
    };

    return (
        <div className={chromeless ? styles.paneFill : styles.editorPane}>
            {!chromeless && (
                <div className={styles.paneHeader}>
                    <span className={styles.paneDots} aria-hidden="true">
                        <i /><i /><i />
                    </span>
                    <span className={styles.editorFileName}>{fileName}</span>
                    {dirty && (
                        <span className={styles.dirtyDot} title="Unsaved changes" aria-label="Unsaved changes">
                            ●
                        </span>
                    )}
                    <button
                        type="button"
                        className={styles.saveBtn}
                        onClick={onSave}
                        title="Save (Cmd/Ctrl+S)">
                        Save (⌘S)
                    </button>
                </div>
            )}
            <div className={styles.editorBody}>
                <div className={styles.gutter} ref={gutterRef} aria-hidden="true">
                    {Array.from({length: lineCount}, (_, index) => (
                        <div key={index}>{index + 1}</div>
                    ))}
                </div>
                <div className={styles.editorStack}>
                    {/* Coloured mirror of the textarea. The trailing space keeps
                        its height in step when the value ends with a newline (a
                        textarea renders that final empty line, a pre collapses it). */}
                    <pre className={styles.highlightLayer} ref={highlightRef} aria-hidden="true">
                        {tokens.map((token, index) =>
                            token.type === 'plain' ? (
                                token.text
                            ) : (
                                <span key={index} className={styles[TOKEN_CLASS[token.type]]}>
                                    {token.text}
                                </span>
                            ),
                        )}
                        {' '}
                    </pre>
                    <textarea
                        ref={textareaRef}
                        className={styles.editorTextarea}
                        aria-label={`Edit ${fileName}`}
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                        onKeyDown={handleKeyDown}
                        onScroll={syncScroll}
                        spellCheck={false}
                        wrap="off"
                    />
                </div>
            </div>
        </div>
    );
}
