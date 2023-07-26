export const replaceAll = (
  str: string,
  pattern: string | RegExp,
  replacement: string,
) => str.replace(new RegExp(pattern, 'g'), replacement);
