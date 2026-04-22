const extensionIdName = 'datalog-language-support';
const extensionPublisher = 'michaelgolfi';

export const stagedExtensionId = `${extensionPublisher}.${extensionIdName}`;

export function createStageExtensionManifest(extensionManifest) {
  return {
    name: extensionIdName,
    publisher: extensionPublisher,
    displayName: extensionManifest.displayName,
    description: extensionManifest.description,
    version: extensionManifest.version,
    engines: extensionManifest.engines,
    categories: extensionManifest.categories,
    activationEvents: extensionManifest.activationEvents,
    contributes: extensionManifest.contributes,
    main: extensionManifest.main,
  };
}
