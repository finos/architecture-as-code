/** A request failed. The button stays while it tries again, so focus stays on it. */
export function RetryAlert({ message, retrying, onRetry }: { message: string; retrying: boolean; onRetry: () => void }) {
    return (
        <div role="alert" className="alert alert-error alert-soft flex flex-wrap text-base-content">
            <span>{message}</span>
            <button
                type="button"
                className={`btn btn-sm${retrying ? ' btn-disabled' : ''}`}
                aria-disabled={retrying}
                onClick={() => {
                    if (!retrying) onRetry();
                }}
            >
                {retrying ? 'Trying again…' : 'Try again'}
            </button>
        </div>
    );
}
