import fs from "node:fs";

const viewPage = fs.readFileSync("tests/screenshotViewer/screenshotViewer.html").toString();
const cardComponent = fs.readFileSync("tests/screenshotViewer/components/card.html").toString();
const imgComponent = fs.readFileSync("tests/screenshotViewer/components/img.html").toString();
const screenshotDirs = fs.readdirSync("tests/screenshots");


/*

Currently to make this work, you must run 'yarn tsx screenshotViewer.ts' in you command console after having run the screenshot tests

*/



function createViewPage() {
  let page;

  const cards = [""];

  screenshotDirs.forEach(catName => {
    let card = "";
    let fullPageCard = "";

    let img = "";
    let imgCard = "";
    const imgCards = [""];
    const fullPageImgs = [""];

    const thisDir = fs.readdirSync("tests/screenshots/" + catName);
    thisDir.forEach(capture => {
      if (capture.endsWith("fullPage.jpeg")) {
        card = cardComponent.replace("{{HEADER}}", catName + "FullPage");

        img = imgComponent.replace("{{PROJECT}}", capture);
        img = img.replace("{{SRC}}", "../screenshots/" + catName + "/" + capture);
        imgCard = img.replace("{{ALT}}", capture);
        fullPageImgs.push(imgCard);
      } else {
        fullPageCard = cardComponent.replace("{{HEADER}}", catName);

        img = imgComponent.replace("{{PROJECT}}", capture);
        img = img.replace("{{SRC}}", "../screenshots/" + catName + "/" + capture);
        imgCard = img.replace("{{ALT}}", capture);
        imgCards.push(imgCard);
      }
    });
    card = card.replace("{{IMGS}}", imgCards.toString());
    fullPageCard = fullPageCard.replace("{{IMGS}}", fullPageImgs.toString());

    cards.push(card);
    cards.push(fullPageCard);
  });
  page = viewPage.replace("{{BODY}}", cards.toString());
  page = page.replaceAll(",", "");
  fs.writeFileSync("tests/screenshotViewer/screenshotViewPage.html", page);
}

createViewPage();