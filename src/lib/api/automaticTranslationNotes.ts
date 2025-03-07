/* 10:20 - 11:10
1. https://www.npmjs.com/package/translate
2. https://github.com/Mr-vero/AutoTranslate
3. https://github.com/muaz-khan/Translator
4. https://javascripts.com/translate-text-with-javascript/
5. https://www.codewithrandom.com/2023/01/01/language-translator-using-javascript/
6. https://learning.workfall.com/learning/blog/how-to-translate-text-using-the-translate-npm-package-and-the-libre-engine/
7. https://medium.com/@sanghunhan/how-to-make-multi-language-translator-using-node-js-8027277218da */

// Translations can possibly be done by finding all html elements with class: ".autotranslate" for example

// npm translate uses api key
// Supports engines: google, yandex, libre, deepl

// AutoTranslate seems to not use api key

// muaz-khan/Translator seems to not need to install module
// Uses api key
// Seems to have tts and stt

// Link 4 is a guide on how to use google translate api
// Seemingly no need to install no module

// Link 5 is a tutorial using MyMemory api which seems very simple to use
// no import/install/api key?

// Link 6 is more about npm translate package specific to libre engine

// Link 7 is a tutorial that uses google-translate-api module


// ----- This approach takes WAY too long and runs out of translations quickly -----
// export async function translateText(text: string, fromLang: string, toLang: string) {
//   const apiUrl = `https://api.mymemory.translated.net/get?q=${text}&langpair=${fromLang}|${toLang}`;
//   let translatedText = "";
//   try {
//     await fetch(apiUrl)
//       .then((response) => response.json())
//       .then((data) => {
//         // console.log("data:",data);
//         // console.log("data.responseData.translatedText:",data.responseData.translatedText);
//         translatedText = data.responseData.translatedText;
//         data.matches.forEach((data: { id: number; translation: string; }) => {
//           if (data.id === 0) {
//             // console.log("translation:",data.translation)
//             translatedText = data.translation;
//           }
//         })
//         return translatedText;
//       })
//   } catch (error) {
//     console.log(error);
//   }

//   return translatedText;
// }