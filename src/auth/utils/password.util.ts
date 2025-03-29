/* eslint-disable prettier/prettier */
import * as bcrypt from 'bcrypt';

export class PasswordUtils {
  private static readonly SALT_ROUNDS = 10;

  /**
   * Hash a password securely before storing in the database.
   * @param password - The plain text password.
   * @returns A hashed password.
   */
  static async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Validate if the provided password matches the stored hashed password.
   * @param password - The plain text password input.
   * @param hashedPassword - The stored hashed password.
   * @returns Boolean indicating whether passwords match.
   */
  static async comparePasswords(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }
}
