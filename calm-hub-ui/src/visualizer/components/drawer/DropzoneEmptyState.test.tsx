import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DropzoneEmptyState } from './DropzoneEmptyState.js';

describe('DropzoneEmptyState', () => {
    it('shows the resting prompt and format helper when not dragging', () => {
        render(<DropzoneEmptyState isDragActive={false} />);
        expect(screen.getByTestId('dropzone-empty-state')).toBeInTheDocument();
        expect(screen.getByText(/Drag & drop or/i)).toBeInTheDocument();
        expect(screen.getByText('Browse')).toBeInTheDocument();
        expect(screen.getByText(/Accepts CALM JSON \(architecture \/ pattern\)/i)).toBeInTheDocument();
    });

    it('shows the drop prompt and tints the surface when dragging', () => {
        render(<DropzoneEmptyState isDragActive />);
        expect(screen.getByText(/Drop your file here/i)).toBeInTheDocument();
        // The format helper is hidden while a file is over the zone.
        expect(screen.queryByText(/Accepts CALM JSON/i)).not.toBeInTheDocument();
    });

    it('replaces the format helper with an alert when an error is given', () => {
        render(
            <DropzoneEmptyState
                isDragActive={false}
                error="Couldn't read that file — expected CALM JSON (architecture / pattern)."
            />
        );
        expect(screen.getByRole('alert')).toHaveTextContent(/Couldn't read that file/i);
        // The neutral helper line is replaced by the error, not shown alongside it.
        expect(screen.queryByText(/Accepts CALM JSON/i)).not.toBeInTheDocument();
    });
});
