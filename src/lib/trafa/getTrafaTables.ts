"use server";

import { externalDatasets } from "../api/utility";
import { StructureItem, TrafaDataResponse } from "./trafaTypes";

export default async function getTrafaTables(query?: string | null, language?: "sv" | "en") {
  const url = new URL('./structure', externalDatasets.Trafa?.baseUrl);
  url.searchParams.append('query', ``);
  language = "sv"
  if (language) url.searchParams.append('lang', language);

  let data: TrafaDataResponse | null = null;
  const tables: { tableId: string, label: string }[] = [];

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
    } else {
      console.log("bad response", response);
      return null;
    }
  } catch (error) {
    console.log(error);
    return null;
  }

  if (!data) {
    return null;
  }
  data.StructureItems.forEach((item: StructureItem) => {
    // TODO - item.Label needs to be manually translated here when internationalization is implemented
    const pushItem: { tableId: string, label: string } = {
      tableId: item.Name,
      label: `${item.Label} (${item.Name})`,
    };

    tables.push(pushItem);
  });

  if (query) {
    const regex = new RegExp(query as string, "i");
    return tables?.filter(table => regex.test(table.label)) ?? null;
  }

  return tables;

};

/* DataTypes
String
Time
Region */

/* Tables with H items
t10011
t10014
t10015
t10018
t0401
t10092
t10093
t10094
t08091
t08092
t04021
t04023
t10021
t10036
t1101
t0603
t10030
t0602
t0604_rt_ar
*/

/* Tables with multiple H items
(8) t0802
(6) t1004
(6) t10061
(5) t0901
(4) t10062
(4) t0808
(4) t1102
(4) t10016
(4) t0501
(4) t06013
(3) t08021
(3) t10039
(3) t06011
(2) t10012
(2) t0604
(2) t04022
(2) t1201
(2) t10023
(2) t10026
(2) t10029
(2) t1203
(2) t10013
(2) t0301
(2) atft
*/

/* -- On "lägg till historisk data" page --
get all tables
select table
get structure items and list them as options
if item type is H draw as dropdown with D items as options, (could multiple be selected?)
if a D item is selected, list DV and F items as options
get names of selected items and add as search queries when fetching data
must have at least one M item selected to be able to get any data?
All DV items should be selectable
F seems to overwrite the DV filters and only one F filter seems to be selectable at a time
*/

/* H seems to be a header and is not something that can be used as a search parameter
Examples: t1203|region and t10011|agare 
*/