import { expect, it } from 'vitest';
import index from '../../../../calm-hub/src/main/resources/META-INF/calm-extensions/builtin/index.txt?raw';
import evaluation from '../../../../calm-hub/src/main/resources/META-INF/calm-extensions/builtin/control-evaluation/extension.json' with { type: 'json' };
import deployment from '../../../../calm-hub/src/main/resources/META-INF/calm-extensions/builtin/deployment/extension.json' with { type: 'json' };
import { BUILTIN_EXTENSION_IDS } from '../../extensions/extensionIdentity.js';
import { BUILTIN_DECORATOR_VIEWS } from './builtinDecoratorViews.js';

it('is the same as the built-in manifests on the Hub classpath', () => {
    const manifests = [evaluation, deployment];
    const ids = index.split('\n').map((line) => line.trim()).filter(Boolean);
    expect(ids).toEqual(manifests.map((manifest) => manifest.id));
    expect(new Set(ids)).toEqual(BUILTIN_EXTENSION_IDS);
    const fromManifests = manifests.flatMap((manifest) =>
        manifest.contributes['decorator-views'].map((view) => ({
            ...view,
            source: { id: manifest.id, name: manifest.name, builtIn: true },
        })));
    expect(BUILTIN_DECORATOR_VIEWS).toEqual(fromManifests);
});
