/* eslint-disable prettier/prettier */
/**
 * 
 * @param text - The text to slugify
 * @returns 
 * A slugified version of the input text, suitable for use in URLs.
 * The function converts the text to lowercase, replaces spaces with hyphens, and removes any non-word characters.
 */
export function slugify(text: string): string {
    return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
  }
  