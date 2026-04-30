/**
 * Generates a random reservation code with the following specifications:
 * - Exactly 6 characters
 * - Combination of uppercase letters and numbers
 * - Excludes ambiguous characters: I, 1, 0, O (to avoid misreading)
 *
 * Valid characters: A-H, J-N, P-Z, 2-9 (23 letters + 8 digits = 31 characters total)
 */

const VALID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

export function generateReservationCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * VALID_CHARS.length);
    code += VALID_CHARS[randomIndex];
  }
  return code;
}
