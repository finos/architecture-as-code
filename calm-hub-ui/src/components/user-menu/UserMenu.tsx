import React, { useEffect, useState } from 'react';
import { authService, getUser } from '../../authService.js';
import { User } from 'oidc-client-ts';

export const UserMenu: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const loadUser = async () => {
            const currentUser = await getUser();
            setUser(currentUser);
        };
        loadUser();
    }, []);

    const handleLogout = async () => {
        await authService.logout();
    };

    const displayName = user?.profile?.name || user?.profile?.preferred_username || 'User';
    const email = user?.profile?.email || '';

    if (!user) {
        return null;
    }

    return (
        <div className="relative">
            <button
                className="btn btn-ghost btn-sm gap-2 text-base-content"
                onClick={() => setIsOpen(!isOpen)}
                aria-label="User menu"
            >
                <div className="avatar placeholder">
                    <div className="bg-primary text-primary-content rounded-full w-8 h-8">
                        <span className="text-xs">{displayName.charAt(0).toUpperCase()}</span>
                    </div>
                </div>
                <span className="hidden lg:inline text-sm max-w-32 truncate">{displayName}</span>
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 z-50 w-64 bg-base-100 border border-base-300 rounded-lg shadow-lg">
                        <div className="px-4 py-3 border-b border-base-200">
                            <p className="text-sm font-medium text-base-content">{displayName}</p>
                            {email && <p className="text-xs text-base-content/60 truncate">{email}</p>}
                        </div>
                        <div className="py-1">
                            <button
                                onClick={handleLogout}
                                className="w-full text-left px-4 py-2 text-sm text-error hover:bg-base-200"
                            >
                                Sign out
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
