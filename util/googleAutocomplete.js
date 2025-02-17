// util/googleAutocomplete.js
import axios from 'axios';
import { parseStringPromise } from 'xml2js';

/**
 * Fetch Google Autocomplete suggestions for the given query + countryCode.
 * 
 * @param {string} query - The search term, e.g. "marlboro"
 * @param {string} countryCode - Two-letter country code, e.g. "de", "es", "us"
 * @returns {Promise<string[]>} Array of suggestion strings
 */
export async function getGoogleSuggestions(query, countryCode) {
  const url = `http://google.com/complete/search?output=toolbar&gl=${countryCode}&q=${encodeURIComponent(query)}`;
  const response = await axios.get(url);

  // Parse the XML from Google
  const parsedXml = await parseStringPromise(response.data);

  // The typical structure: <toplevel><CompleteSuggestion><suggestion data="..."/></CompleteSuggestion>...
  const suggestions = [];
  const completeSuggestions = parsedXml?.toplevel?.CompleteSuggestion || [];

  for (const suggestionNode of completeSuggestions) {
    if (
      suggestionNode.suggestion &&
      Array.isArray(suggestionNode.suggestion) &&
      suggestionNode.suggestion[0].$ &&
      suggestionNode.suggestion[0].$.data
    ) {
      suggestions.push(suggestionNode.suggestion[0].$.data);
    }
  }

  return suggestions;
}
