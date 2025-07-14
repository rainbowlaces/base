export function kebabToUpperCamel(str: string) {
  return str
    .split(/[-_\s]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

export function kebabToLowerCamel(str: string) {
  const word = kebabToUpperCamel(str);
  return word.charAt(0).toLowerCase() + word.slice(1);
}

export function camelToKebab(str: string) {
  return str
    .replace(/^([A-Z])/, (_match, p1:string) => p1.toLowerCase())
    .replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, "$1-$2")
    .toLowerCase();
}

export function camelToLowerUnderscore(str: string) {
  return str.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
}

export function camelToUpperUnderscore(str: string) {
  return str.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
}

export function isUpperCamelCase(str: string) {
  return /^[A-Z][a-zA-Z0-9]*$/.test(str);
}

export function isLowerCamelCase(str: string) {
  return /^[a-z][a-zA-Z0-9]*$/.test(str);
}

export function isLowerUnderscore(str: string) {
  return /^[a-z][a-z0-9_]*$/.test(str);
}

export function isUpperUnderscore(str: string) {
  return /^[A-Z][A-Z0-9_]*$/.test(str);
}

export function isKebabCase(str: string) {
  return /^[a-z][a-z0-9-]*$/.test(str);
}

export function stringToSlug(contentName: string): string {
  const sanitized = contentName.replace(/[^a-z0-9\s]/gi, "");
  const collapsedSpaces = sanitized.replace(/\s+/g, " ");
  const slug = collapsedSpaces.trim().toLowerCase().replace(/\s/g, "-");
  return slug;
}

export function truncate(
  str: string,
  length: number,
  appendToEnd = "[TRUNCATED]",
): string {
  if (!str) return "";
  if (str.length > length) {
    if (appendToEnd.length > length) {
      return str.substring(0, length);
    } else {
      return `${str.substring(0, length - appendToEnd.length)}${appendToEnd}`;
    }
  }
  return str;
}
