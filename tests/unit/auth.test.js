import { beforeEach, describe, expect, it, vi } from 'vitest';

const oauth = vi.hoisted(() => ({
    load: vi.fn(),
    init: vi.fn()
}));

vi.mock('@atproto/oauth-client-browser', () => ({
    BrowserOAuthClient: {
        load: oauth.load
    }
}));

import { AuthService } from '../../js/auth.js';

describe('AuthService bootstrap sharing', () => {
    beforeEach(() => {
        oauth.load.mockReset();
        oauth.init.mockReset();
    });

    it('coalesces landing and authenticated setup onto one OAuth initialization', async () => {
        const session = { did: 'did:plc:test' };
        oauth.init.mockResolvedValue({ session });
        oauth.load.mockResolvedValue({ init: oauth.init });

        const service = new AuthService();
        const [landingResult, appResult] = await Promise.all([
            service.setup(),
            service.setup()
        ]);

        expect(oauth.load).toHaveBeenCalledTimes(1);
        expect(oauth.init).toHaveBeenCalledTimes(1);
        expect(landingResult.session).toBe(session);
        expect(appResult.session).toBe(session);
    });

    it('allows a fresh setup after sign out', async () => {
        const firstSession = {
            did: 'did:plc:first',
            signOut: vi.fn(async () => {})
        };
        const secondSession = { did: 'did:plc:second' };

        oauth.init
            .mockResolvedValueOnce({ session: firstSession })
            .mockResolvedValueOnce({ session: secondSession });
        oauth.load
            .mockResolvedValueOnce({ init: oauth.init })
            .mockResolvedValueOnce({ init: oauth.init });

        const service = new AuthService();
        await service.setup();
        await service.signOut();
        const result = await service.setup();

        expect(firstSession.signOut).toHaveBeenCalledTimes(1);
        expect(oauth.load).toHaveBeenCalledTimes(2);
        expect(result.session).toBe(secondSession);
    });
});