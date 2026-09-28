export type Result<TData, TErrorCode extends string> =
  | { success: true; data: TData }
  | { success: false; error: { code: TErrorCode; message: string } }
