'use server';

import { trafaStructureUrl } from "./trafaTypes";

export default async function getTrafaTables(language?: 'sv' | 'en') {
  const url = new URL(trafaStructureUrl);
  url.searchParams.append('query', ``);
  if (language) {
    url.searchParams.append('lang', language);
  }

  console.log(url);

  // let data: TrafaDataResponse | null = null;
  let data: unknown;
  let tables: string[] = [];

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

  // console.log(data);

  // await data.StructureItems.forEach((item: any) => {
  //   let pushItem: unknown = {
  //     id: item.Id,
  //     label: item.Label,
  //     name: item.Name,
  //     uniqueId: item.UniqueId,
  //     description: item.Description,
  //   }

  //   tables.push(pushItem);
  // });

  // console.log(data);
  return data;

};