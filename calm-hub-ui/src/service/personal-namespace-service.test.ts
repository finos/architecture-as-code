import { describe, it, expect, afterEach, vi } from 'vitest';
import AxiosMockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import { PersonalNamespaceService } from './personal-namespace-service.js';

const PATH = '/api/calm/me/namespace';
const ax = axios.create();
const mock = new AxiosMockAdapter(ax as never);

describe('PersonalNamespaceService', () => {
    const service = new PersonalNamespaceService(ax);

    afterEach(() => {
        mock.reset();
        vi.restoreAllMocks();
    });

    describe('fetchPersonalNamespace', () => {
        it.each([
            [{ name: 'users.alice', exists: false, owned: false }, { status: 'available', name: 'users.alice' }],
            [{ name: 'users.alice', exists: true, owned: true }, { status: 'owned', name: 'users.alice' }],
            [{ name: 'users.alice', exists: true, owned: false }, { status: 'taken', name: 'users.alice' }],
        ])('maps %o to a state', async (body, expected) => {
            mock.onGet(PATH).reply(200, body);
            await expect(service.fetchPersonalNamespace()).resolves.toEqual(expected);
        });

        it('returns unavailable when the feature is off', async () => {
            mock.onGet(PATH).reply(404);
            await expect(service.fetchPersonalNamespace()).resolves.toEqual({ status: 'unavailable' });
        });

        it('returns unsupported for a user name that cannot be a segment', async () => {
            mock.onGet(PATH).reply(422);
            await expect(service.fetchPersonalNamespace()).resolves.toEqual({ status: 'unsupported' });
        });

        it('rejects on any other error', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            mock.onGet(PATH).reply(500);
            await expect(service.fetchPersonalNamespace()).rejects.toThrow('Error fetching personal namespace:');
        });

        it('rejects on a network error', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            mock.onGet(PATH).networkError();
            await expect(service.fetchPersonalNamespace()).rejects.toThrow('Error fetching personal namespace:');
        });
    });

    describe('createPersonalNamespace', () => {
        it.each([201, 200])('returns owned on %i', async (status) => {
            mock.onPut(PATH).reply(status, { name: 'users.alice', exists: true, owned: true });
            await expect(service.createPersonalNamespace()).resolves.toEqual({ status: 'owned', name: 'users.alice' });
        });

        it('reads the state again on 409', async () => {
            mock.onPut(PATH).reply(409);
            mock.onGet(PATH).reply(200, { name: 'users.alice', exists: true, owned: false });
            await expect(service.createPersonalNamespace()).resolves.toEqual({ status: 'taken', name: 'users.alice' });
        });

        it('returns unavailable when the feature is off', async () => {
            mock.onPut(PATH).reply(404);
            await expect(service.createPersonalNamespace()).resolves.toEqual({ status: 'unavailable' });
        });

        it('returns unsupported on 422', async () => {
            mock.onPut(PATH).reply(422);
            await expect(service.createPersonalNamespace()).resolves.toEqual({ status: 'unsupported' });
        });

        it('rejects on any other error', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            mock.onPut(PATH).reply(500);
            await expect(service.createPersonalNamespace()).rejects.toThrow('Error creating personal namespace:');
        });
    });
});
