import { describe, expect, it, vi } from 'vitest';
import { createFeatureEvent } from './feature-event';

describe('createFeatureEvent', () => {
    it('sends values to subscribers and stops after unsubscribe', () => {
        const event = createFeatureEvent<string>();
        const listener = vi.fn();
        const unsubscribe = event.subscribe(listener);

        event.emit('first');
        unsubscribe();
        event.emit('second');

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith('first');
    });
});