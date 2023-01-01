export const generateString = (chars, length) => {
  let string = "";
  for (let i = 0; i <= length; i++) {
    const index = Math.floor(Math.random() * chars.length);
    string += chars[index];
  }
  return string;
};
