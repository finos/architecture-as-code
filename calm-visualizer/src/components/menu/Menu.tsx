interface MenuProps {
    callback: (instanceFile: File) => void;
}

function Menu({ callback }: MenuProps) {
    const handleUpload = (file: File) => {
        callback(file);
    };

    return (
        <ul className="menu menu-horizontal px-1 z-1">
            <li>
                <details>
                    <summary>File</summary>
                    <ul className="p-2 z-1">
                        <li>
                            <label>
                                Upload
                                <input
                                    id="file"
                                    type="file"
                                    className="hidden"
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                        e.target.files && handleUpload(e.target.files[0])
                                    }
                                />
                            </label>
                        </li>
                        <li>
                            <label>Save As</label>
                        </li>
                    </ul>
                </details>
            </li>
            <li>
                <details>
                    <summary>Edit</summary>
                </details>
            </li>
        </ul>
    );
}
// TODO: add edit ability
export default Menu;
