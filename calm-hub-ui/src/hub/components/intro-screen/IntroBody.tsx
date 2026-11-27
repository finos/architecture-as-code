import { NamespaceCounts, DomainControlCount } from '../../../model/counts.js';
import { Theme } from '../../../theme/useTheme.js';
import { BrandLockup } from '../../../components/branding/BrandLockup.js';
import { useNavigationSettings } from '../../../components/navigation/navigation-settings.js';
import { IntroSearchBar } from './IntroSearchBar.js';
import { IntroBrowse } from './IntroBrowse.js';
import { MyNamespaceCard } from './MyNamespaceCard.js';
import { PersonalNamespaceControl } from '../../hooks/usePersonalNamespace.js';

export interface IntroBodyProps {
    namespaceCounts: NamespaceCounts[];
    domainCounts: DomainControlCount[];
    personalNamespace?: PersonalNamespaceControl;
}

/** The logo, the search and the browse cards of the home page. */
export function IntroBody({ namespaceCounts, domainCounts, personalNamespace, theme }: IntroBodyProps & { theme: Theme }) {
    const { showNamespaces } = useNavigationSettings();
    return (
        <div className="min-h-full flex flex-col items-center px-6 py-16 sm:py-24">
            <BrandLockup theme={theme} size="hero" />

            <div className="w-full flex justify-center mt-10 sm:mt-12">
                <IntroSearchBar />
            </div>
            {personalNamespace && showNamespaces && (
                <div className="w-full flex justify-center mt-14 sm:mt-16 empty:hidden">
                    <MyNamespaceCard personalNamespace={personalNamespace} />
                </div>
            )}

            <div className="w-full flex justify-center mt-14 sm:mt-16">
                <IntroBrowse namespaceCounts={namespaceCounts} domainCounts={domainCounts} />
            </div>
        </div>
    );
}
