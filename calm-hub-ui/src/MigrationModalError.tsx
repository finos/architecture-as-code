import { IoConstructOutline } from 'react-icons/io5';
import { migrationStore } from './service/utils/migration-store.js';
import { useMigrationError } from './service/utils/use-migration-store.js';

export function MigrationErrorModal() {
    const message = useMigrationError();

    if (!message) {
        return null;
    }

    const handleClose = () => migrationStore.setMigrationError(null);

    return (
        <dialog className="modal modal-open" open>
            <div className="modal-box">
                <div className="flex items-center gap-3 mb-1">
                    <IoConstructOutline className="text-2xl shrink-0 text-warning" aria-hidden />
                    <h3 className="font-bold text-lg">Keep CALM</h3>
                </div>
                <p className="py-3 text-base-content/70">{message}</p>
                <div className="modal-action">
                    <button className="btn btn-primary" onClick={handleClose}>
                        Close
                    </button>
                </div>
            </div>
            <form method="dialog" className="modal-backdrop">
                <button onClick={handleClose}>close</button>
            </form>
        </dialog>
    );
}
