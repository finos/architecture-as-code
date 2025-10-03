interface ValueTableProps {
    header: string;
    values: string[];
    callback: (value: string) => void;
    currentValue: string | undefined;
}

export function ValueTable({ header, values, callback, currentValue }: ValueTableProps) {
    return (
        <div className="border border-base-300 rounded-lg grow overflow-hidden">
            <div className="p-5">
                <b>{header}</b>
            </div>
            <hr className="border-base-300" />
            <div>
                {values.map((value) => {
                    let styles = 'h-fit p-5 hover:bg-base-200 cursor-pointer';

                    if (currentValue === value) {
                        styles = styles + ' bg-base-200';
                    }

                    return (
                        <div key={value} className={styles} onClick={() => callback(value)}>
                            {value}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
