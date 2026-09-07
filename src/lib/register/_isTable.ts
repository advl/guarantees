/** Whether a parsed value is a table: an object that is not a list. */
export default function _isTable(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
