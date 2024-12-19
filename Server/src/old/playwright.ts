import { Browser, chromium, Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

export async function startBrowser(
  url: string
): Promise<{ browser: Browser; page: Page }> {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Navigate to the webpage
  await page.goto(url);

  //   Now on: Login page
  /* ----------------------------- Input username ----------------------------- */
  // Wait for the element to be visible
  const usernameSelector = "#gtuser";
  await page.waitForSelector(usernameSelector, { state: "visible" });

  // Focus on the text input
  await page.click(usernameSelector); // This will focus the input field

  // Clear the input field by setting an empty value
  await page.fill(usernameSelector, ""); // Clears the input field

  // Define the text to type into the input
  const username = "billym";

  // Type the text into the input
  await page.fill(usernameSelector, username);

  /* ----------------------------- Input password ----------------------------- */
  // Focus on the text input
  const passwordSelector = "#pass";
  await page.click(passwordSelector); // This will focus the input field

  // Clear the input field by setting an empty value
  await page.fill(passwordSelector, ""); // Clears the input field

  // Define the text to type into the input
  const password = "truth!bm";

  // Type the text into the input
  await page.fill(passwordSelector, password);

  /* ------------------------------ Input project ----------------------------- */
  const projectSelector = "#projectid";
  await page.click(projectSelector); // This will focus the input field

  // Clear the input field by setting an empty value
  await page.fill(projectSelector, ""); // Clears the input field

  // Define the text to type into the input
  const project = "USPS_NPI_Address";

  // Type the text into the input
  await page.fill(projectSelector, project);

  /* ---------------------------- Login to main app --------------------------- */
  const loginButtonSelector = "#login > input[type=submit]:nth-child(14)";
  await page.click(loginButtonSelector);

  // Now on: Main app page
  const instructionsExit = "#instructionstextdiv";
  await page.waitForSelector(instructionsExit, { state: "visible" });

  await page.click(instructionsExit);

  return { browser: browser, page: page };
}

export async function stopBrowser(browser: Browser) {
  await browser.close();
}

export async function getImageName(page: Page): Promise<string> {
  const url = page.url();

  // Regular expression to match the fileid parameter
  const regex = /[?&]fileid=([^&]*)/;
  const match = url.match(regex);

  // If match is found, return the captured fileid, otherwise return empty string
  let output = "";
  if (match) {
    output = match[1];
  } else {
    output = "";
  }

  return output;
}

export async function downloadImage(page: Page): Promise<Buffer> {
  // Define image's selector
  const imageSelector = "#viewer > img";

  // Find the image element by its selector and get the image URL (relative or full)
  const relativeImageUrl = await page.getAttribute(imageSelector, "src"); // Replace with actual image selector

  // Working method, requires navigation
  if (!relativeImageUrl) {
    throw new Error("Could not find image on the page");
  }

  // Construct the full URL if necessary
  const baseUrl = "http://groundtruth.raf.com"; // Replace with the actual base URL of the site
  const fullImageUrl = relativeImageUrl.startsWith("http")
    ? relativeImageUrl
    : `${baseUrl}${relativeImageUrl}`;

  // Fetch the image
  const imageResponse = await page.goto(fullImageUrl);

  const buffer = await imageResponse!.body();

  // Debug: save image to disk
  // const imagePath = path.resolve("downloaded-image.png"); // Define desired file name and path
  // fs.writeFileSync(imagePath, buffer);
  // console.log(`Image downloaded to ${imagePath}`);

  // Navigate back to the previous page
  await page.goBack();

  // Return the image as a data buffer
  return buffer;
}

export async function fillInForm(
  page: Page,
  requestData: {
    address: string;
    isMpImage: boolean;
    isHwImage: boolean;
    isBadImage: boolean;
  }
) {
  // Wait for the element to be visible
  const addressFieldSelector = "#destaddress";
  await page.waitForSelector(addressFieldSelector, { state: "visible" });

  // Fill in the textarea
  await page.fill(addressFieldSelector, requestData.address);

  // Check the appropriate imageType checkbox
  if (requestData.isMpImage) {
    const checkboxSelector = "#destmp";
    await page.waitForSelector(checkboxSelector, { state: "visible" });

    await page.check(checkboxSelector);
  }
  if (requestData.isHwImage) {
    const checkboxSelector = "#desthw";
    await page.waitForSelector(checkboxSelector, { state: "visible" });

    await page.check(checkboxSelector);
  }
  if (requestData.isBadImage) {
    const checkboxSelector = "#destbad";
    await page.waitForSelector(checkboxSelector, { state: "visible" });

    await page.check(checkboxSelector);
  }

  // Save the result
  await saveForm(page);
}

export async function saveForm(page: Page) {
  // Wait for the element to be visible
  const saveButtonSelector = "#save";
  await page.waitForSelector(saveButtonSelector, { state: "visible" });

  // Click on the next button
  await page.click(saveButtonSelector);
}

export async function gotoNextImage(page: Page) {
  // Check if the instructions div is present again (happens if instance was afk for a while)
  const instructionsExitSelector = "#instructionstextdiv";
  const element = page.locator(instructionsExitSelector);

  if ((await element.count()) > 0) {
    // If the element is present, click dismiss button
    await page.waitForSelector(instructionsExitSelector, { state: "visible" });
    await page.click(instructionsExitSelector);
  }

  // Wait for the element to be visible
  const nextButtonSelector = "#next";
  await page.waitForSelector(nextButtonSelector, { state: "visible" });

  // Click on the next button
  await page.click(nextButtonSelector);

  // Wait for the page to be fully loaded, should ensure the next image is present and available to extract
  await page.waitForLoadState("networkidle");
}

/* ---------------------------------- Debug --------------------------------- */
export async function manualGotoImage(
  page: Page,
  incrementNavigation: boolean
) {
  const url = page.url();
  const urlObj = new URL(url);

  // Get the current fileid, increment or decrement it by 1
  const fileIdParam = urlObj.searchParams.get("fileid");

  if (fileIdParam) {
    let fileId = parseInt(fileIdParam, 10);
    if (incrementNavigation) {
      fileId = fileId + 1;
    } else {
      fileId = fileId - 1;
    }
    urlObj.searchParams.set("fileid", fileId.toString());

    // Navigate to new url
    await page.goto(urlObj.toString());

    // Wait for the page to be fully loaded, should ensure the next image is present and available to extract
    await page.waitForLoadState("networkidle");
  }
}

export async function getImageFromDisk(imageFilePath: string): Promise<Buffer> {
  // Resolve the absolute path to the image on disk
  const resolvedImagePath = path.resolve(imageFilePath);

  // Read the image file from disk and return it as a buffer
  const buffer = fs.readFileSync(resolvedImagePath);

  // Return the image buffer
  return buffer;
}

export async function getNextImageFromDisk(
  fileId: string,
  imageFolderPath: string
): Promise<Buffer> {
  // Read the contents of the directory
  const files = fs.readdirSync(imageFolderPath);

  // Filter for image files only (assuming .jpg, .jpeg, .png extensions)
  const imageFiles = files.filter((file) => /\.(jpg|jpeg|png)$/i.test(file));

  // Sort the image files alphabetically
  imageFiles.sort();

  // Find the current file index based on the fileId
  const currentFileIndex = imageFiles.findIndex((file) =>
    file.includes(fileId)
  );

  // If the current file is not found, return null
  if (currentFileIndex === -1) {
    throw new Error("File with the given fileId not found.");
  }

  // Get the next file in the sequence; if it's the last file, loop back to the first file
  const nextFile =
    currentFileIndex === imageFiles.length - 1
      ? imageFiles[0] // Loop back to the first file
      : imageFiles[currentFileIndex + 1];

  // GetImageFromDisk with the absolute path to the next image
  return await getImageFromDisk(path.resolve(imageFolderPath, nextFile));
}
