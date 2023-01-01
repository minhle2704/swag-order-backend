import { generateString } from "./index.js";

export const generateTemporaryPassword = () =>
  generateString(
    "0123456789abcdefghijklmnopqrstuvwxyz!@#$%^&*()ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    12
  );
