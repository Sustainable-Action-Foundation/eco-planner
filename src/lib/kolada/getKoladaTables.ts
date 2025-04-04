import { externalDatasets } from "../api/utility";

export default async function getKoladaTables() {
  const url = new URL(`${externalDatasets.Kolada?.baseUrl}/municipality`);
  let data: unknown = null;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        // The data is available as either 'application/json' or 'application/xml', JSON is easier to parse
        'Accept': 'application/json',
      },
    });
    if (response.ok) {
      data = await response.json();
      console.log(data);
    } else {
      console.log("bad response", response);
      return null;
    }
  } catch (error) {
    console.log(error);
    return null;
  }
}