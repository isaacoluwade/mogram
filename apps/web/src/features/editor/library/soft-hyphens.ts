/**
 * Lets long single words ("Automanaged") break with a hyphen in a narrow tile: dictionaries don't
 * know most product names, so soft hyphens mark where a break may go. A CamelCase word
 * ("NetworkPolicy") breaks between its words first.
 */
export function softHyphens(name: string): string {
  return name.replace(/\p{L}{11,}/gu, (word) =>
    word
      .split(/(?<=\p{Ll})(?=\p{Lu})/u)
      .map((part) =>
        part.length >= 11 ? part.replace(/(\p{L}{6})(?=\p{L}{4})/gu, "$1\u00AD") : part,
      )
      .join("\u00AD"),
  );
}
