export function createConsumerPackageManifest(packageManifest) {
  const dependencies = Object.fromEntries(
    Object.entries(packageManifest.dependencies ?? {}).map(([packageName, version]) => [
      packageName,
      version === 'workspace:*' ? packageManifest.version : version,
    ]),
  );

  return {
    name: packageManifest.name,
    version: packageManifest.version,
    type: packageManifest.type,
    main: packageManifest.main,
    module: packageManifest.module,
    types: packageManifest.types,
    exports: packageManifest.exports,
    dependencies,
  };
}
