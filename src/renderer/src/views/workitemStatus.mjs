export function patchWorkitemStatus(item, status) {
  const statusId = status?.identifier || status?.id || ''
  return {
    ...item,
    status,
    ...(statusId ? { statusId, statusIdentifier: statusId } : {})
  }
}
