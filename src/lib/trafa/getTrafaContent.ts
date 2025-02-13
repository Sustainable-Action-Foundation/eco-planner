'use server';

import { TrafaDataResponse, trafaUrl } from "./trafaTypes";

// Trafa is a Swedish transport data provider. As such, their data is only relevant for usage in Sweden.
// This means that everything here in the `trafa` folder is somewhat useless for international implementations,
// but can be useful to show how to implement a new data provider which doesn't follow the pxWebV2 standard.

export default async function getTrafaContent(query: string, language?: 'sv' | 'en') {
  const url = new URL(trafaUrl);
  url.searchParams.append('query', query);
  if (language) {
    url.searchParams.append('lang', language);
  }

  let data: TrafaDataResponse | null = null;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        // The data is available as either 'application/json' or 'application/xml', JSON is easier to parse
        'Accept': 'application/json',
      }
    });
    if (response.ok) {
      data = await response.json();
    } else {
      console.log("bad response", response)
      return null;
    }
  } catch (error) {
    console.log(error);
    return null;
  }

  return data;
}