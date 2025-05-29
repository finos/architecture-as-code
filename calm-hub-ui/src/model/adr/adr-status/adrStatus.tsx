export enum adrStatus {
    draft = 'draft',
    proposed = 'proposed',
    accepted = 'accepted',
    superseded = 'superseded',
    rejected = 'rejected',
    deprecated = 'deprecated',
}

export function displayAdrStatus(adrStatus: adrStatus) {
    let adrStatusStyling =
        'inline rounded-full text-center text-s ps-3 pe-3 ms-3 relative bottom-1 font-bold border-solid border-2';
    let adrStatusString = adrStatus.charAt(0).toUpperCase() + adrStatus.slice(1);

    switch (adrStatus) {
        case 'draft': {
            adrStatusStyling = adrStatusStyling + ' border-orange-500 text-orange-500';
            break;
        }
        case 'proposed': {
            adrStatusStyling = adrStatusStyling + ' border-teal-500 text-teal-500';
            break;
        }
        case 'accepted': {
            adrStatusStyling = adrStatusStyling + ' border-lime-500 text-lime-500';
            break;
        }
        case 'superseded': {
            adrStatusStyling = adrStatusStyling + ' border-violet-500 text-violet-500';
            break;
        }
        case 'rejected': {
            adrStatusStyling = adrStatusStyling + ' border-red-500 text-red-500';
            break;
        }
        case 'deprecated': {
            adrStatusStyling = adrStatusStyling + ' border-slate-500 text-slate-500';
        }
    }

    return <div className={adrStatusStyling}>{adrStatusString}</div>;
}
