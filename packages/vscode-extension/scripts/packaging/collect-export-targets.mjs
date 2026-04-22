export function collectExportTargets(exportsField) {
  if (typeof exportsField === 'string') {
    return [exportsField];
  }

  if (Array.isArray(exportsField)) {
    return exportsField.flatMap((entry) => collectExportTargets(entry));
  }

  if (exportsField && typeof exportsField === 'object') {
    return Object.values(exportsField).flatMap((entry) => collectExportTargets(entry));
  }

  return [];
}
