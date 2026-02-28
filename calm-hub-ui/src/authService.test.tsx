import { afterEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { checkAuthorityService } from './authService.js';

vi.mock('axios');

describe('checkAuthorityService', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should return true when the authority service responds successfully', async () => {
        vi.mocked(axios.head).mockResolvedValue({ status: 200 });
        const result = await checkAuthorityService();
        expect(result).toBe(true);
    });

    it('should return false when the authority service request fails', async () => {
        vi.mocked(axios.head).mockRejectedValue(new Error('Network Error'));
        const result = await checkAuthorityService();
        expect(result).toBe(false);
    });
});
