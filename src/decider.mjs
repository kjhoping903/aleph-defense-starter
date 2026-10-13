// Only engine-verified decision-contract requests belong at this boundary.
// The engine verifies login and the subject/device binding before calling decide.
export const RULE_IDS = Object.freeze(['device_registered', 'notes_read_scope']);

export async function decide(request) {
  const registered = request?.schema === 'aleph.decision.v1'
    && typeof request.subjectId === 'string' && request.subjectId.trim().length > 0
    && typeof request.deviceId === 'string' && /^[a-f0-9]{16}$/u.test(request.deviceId)
    && request.deviceRegistered === true;
  const notesRead = request?.service === 'notes' && request.method === 'GET'
    && ((request.route === 'GET /notes' && request.path === '/notes')
      || (request.route === 'GET /notes/:id' && typeof request.path === 'string'
        && /^\/notes\/[^/?#]+$/u.test(request.path)));
  const allowed = registered && notesRead;
  return {
    schema: 'aleph.decision.v1',
    requestId: request?.requestId,
    decision: allowed ? 'allow' : 'deny',
    // Keep the existing denial code; do not invent an unregistered engine code.
    reasonCode: allowed ? 'approved' : 'device_not_registered',
    ruleIds: !registered ? ['device_registered'] : ['device_registered', 'notes_read_scope'],
  };
}
