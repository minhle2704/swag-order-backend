import { generateString } from "./index.js";

export const generateOrderId = () =>
  generateString("0123456789abcdefghijklmnopqrstuvwxyz", 10);
