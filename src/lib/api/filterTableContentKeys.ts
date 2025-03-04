// import filterPxWebTableContentKeys from "../pxWeb/filterPxWebTableContentKeys";
// import { PxWebApiV2TableContent } from "../pxWeb/pxWebApiV2Types";
// import { TrafaDataResponse } from "../trafa/trafaTypes";

// /**
//  * Try to "flatten" the responseJson by filtering out all keys that have the same value for all entries.
//  * If the `data` array has only 1 entry, the function will return null since it is not possible to filter out any keys.
//  * If any entry in the `data` array doesn't have exactly one value and one key the function will return null.
//  */
// export default function filterTableContentKeys(responseJson: TrafaDataResponse | PxWebApiV2TableContent | null | undefined) {
//   if (!responseJson) {
//     return null;
//   }
//   let returnJson: TrafaDataResponse | PxWebApiV2TableContent | null | unknown = responseJson;
//   if (typeof responseJson === 'undefined') {
//     return null;
//   } else if (typeof responseJson === 'object' && 'data' in responseJson) {
//     returnJson = filterPxWebTableContentKeys(responseJson as PxWebApiV2TableContent);
//   }

//   return responseJson;
// }
