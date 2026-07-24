import React, {useRef} from 'react';
import styles from './lab.module.css';

export default function Editor({fileName, value, dirty, onChange, onSave}) {
    const gutterRef = useRef(null);
    const textareaRef = useRef(null);
    const lineCount = value.split('\n').length;

    const syncScroll = () => {
        if (gutterRef.current && textareaRef.current) {
            gutterRef.current.scrollTop = textareaRef.current.scrollTop;
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
        <div className={styles.editorPane}>
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
            <div className={styles.editorBody}>
                <div className={styles.gutter} ref={gutterRef} aria-hidden="true">
                    {Array.from({length: lineCount}, (_, index) => (
                        <div key={index}>{index + 1}</div>
                    ))}
                </div>
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
    );
}
