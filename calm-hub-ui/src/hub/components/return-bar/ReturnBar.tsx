import { useLocation } from 'react-router-dom';
import { IoAlertCircleOutline } from 'react-icons/io5';
import { ReturnLink } from '../../../navigation/ReturnLink.js';
import { readReturnPoints } from '../../../navigation/returnPoints.js';

/**
 * Above the content pane: the link back to the page the user came from, and notices for a part of a link that this
 * page cannot show, such as an element that is not in the version. The page itself still shows.
 */
export function ReturnBar({ notices }: { notices: readonly string[] }) {
    const { state } = useLocation();
    if (readReturnPoints(state).length === 0 && notices.length === 0) return null;
    return (
        <div className="shrink-0 flex flex-col gap-2 px-4 pt-3 min-w-0" data-testid="return-bar">
            <ReturnLink className="self-start max-w-full" />
            {notices.map((notice) => (
                <p
                    key={notice}
                    role="status"
                    className="flex items-start gap-2 rounded-box border border-warning/50 bg-warning/10 px-3 py-2 text-sm text-base-content wrap-anywhere"
                >
                    <IoAlertCircleOutline aria-hidden="true" className="shrink-0 mt-0.5 text-warning" size={16} />
                    {notice}
                </p>
            ))}
        </div>
    );
}
