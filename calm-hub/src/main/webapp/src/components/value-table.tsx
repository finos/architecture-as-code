interface ValueTableProps {
    header: string;
    values: string[];
    callback: (value: string) => void;
    currentValue: string | undefined;
}

export function ValueTable({
    header,
    values,
    callback,
    currentValue,
}: ValueTableProps) {
    return (
        <div className="border grow">
            <div className="p-5">
                <b>{header}</b>
            </div>
            <hr />
            <div>
                {values.map((value) => {
                    let styles = 'h-fit p-5 hover:bg-gray-50';

                    if (currentValue === value) {
                        styles = styles + ' bg-[#eee]';
                    }

                    return (
                        <div
                            key={value}
                            className={styles}
                            onClick={() => callback(value)}
                        >
                            {value}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
