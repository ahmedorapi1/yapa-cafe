export type SessionAccessActions<T> = {
  startSession: (input: {
    tableNumber: string;
    tableQrToken: string;
    existingSessionId: string | null;
  }) => Promise<T>;
  restoreSession: (input: {
    tableNumber: string;
    sessionId: string;
  }) => Promise<T | null>;
};

export async function resolveSessionAccess<T>(input: {
  tableNumber: string;
  savedSessionId: string | null;
  tableQrToken: string | null;
  actions: SessionAccessActions<T>;
}): Promise<T | null> {
  const tableQrToken = input.tableQrToken?.trim() || null;

  if (tableQrToken) {
    return input.actions.startSession({
      tableNumber: input.tableNumber,
      tableQrToken,
      existingSessionId: input.savedSessionId,
    });
  }

  if (!input.savedSessionId) return null;

  return input.actions.restoreSession({
    tableNumber: input.tableNumber,
    sessionId: input.savedSessionId,
  });
}
