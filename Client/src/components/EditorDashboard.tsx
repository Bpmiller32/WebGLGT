import Emitter from "../webgl/utils/eventEmitter";
import { defineComponent, PropType, ref } from "vue";
import Experience from "../webgl/experience";
import { fillInForm, gotoNextImage } from "../apiHandler";
import { db } from "../firebase";
import { collection, doc, addDoc, getDoc, updateDoc } from "firebase/firestore";
import ActionButton from "./subcomponents/ActionButton";
import MailTypeButton from "./subcomponents/MailTypeButton";
import GroupTextArea from "./subcomponents/GroupTextArea";

export default defineComponent({
  props: {
    apiUrl: {
      type: String as PropType<string>,
      required: true,
    },
  },
  setup(props) {
    /* ------------------------ Component state and setup ----------------------- */
    // Template refs
    const imageNameRef = ref();
    const GroupTextArea0Active = ref();
    const GroupTextArea1Active = ref();
    const GroupTextArea2Active = ref();

    // GL, api setup
    const experience = Experience.getInstance();
    let haveUpdatedFirebaseOnce = false;
    const imageDownloadCount = ref(0);

    // MailType tags
    const isMpImage = ref(true); // Make this a default value
    const isHwImage = ref(false);
    const isBadImage = ref(false);
    const isVendorOnly = ref(false);

    /* ---------------------------- Lifecycle Events ---------------------------- */
    Emitter.on("fillInForm", async () => {
      await submitToDb();
    });
    Emitter.on("gotoNextImage", async () => {
      await loadNextImage();

      GroupTextArea0Active.value = false;
      GroupTextArea1Active.value = false;
      GroupTextArea2Active.value = false;
    });
    Emitter.on("changeSelectionGroup", (groupNumber) => {
      if (groupNumber == 0) {
        GroupTextArea0Active.value = true;
        GroupTextArea1Active.value = false;
        GroupTextArea2Active.value = false;
      }
      if (groupNumber == 1) {
        GroupTextArea0Active.value = false;
        GroupTextArea1Active.value = true;
        GroupTextArea2Active.value = false;
      }
      if (groupNumber == 2) {
        GroupTextArea0Active.value = false;
        GroupTextArea1Active.value = false;
        GroupTextArea2Active.value = true;
      }
    });
    Emitter.on("resetImage", () => {
      GroupTextArea0Active.value = false;
      GroupTextArea1Active.value = false;
      GroupTextArea2Active.value = false;
    });
    Emitter.on("badImage", async () => {
      isMpImage.value = false;
      isBadImage.value = true;

      await submitToDb();
      await loadNextImage();
    });
    Emitter.on("loadedFromApi", () => {
      imageDownloadCount.value++;
    });

    /* ---------------------------- Helper functions ---------------------------- */
    const submitToDb = async () => {
      // Define data request body
      const data = {
        address: GroupTextArea0Active.value.value,

        isMpImage: isMpImage.value,
        isHwImage: false,
        isBadImage: isBadImage.value,
      };

      // Change the data based on gui, get the textarea content and split into lines
      const lines = GroupTextArea0Active.value.value.split("\n");

      // Prepend each line with the corresponding prefix
      const prefixes = ["PO:", "VS:", "TS:"];

      // Hacky vendor only
      if (isVendorOnly.value) {
        data.address = "VS:" + GroupTextArea0Active.value.value;
      } else {
        const modifiedLines = lines.map(
          (line: string, index: number) => `${prefixes[index] || ""}${line}`
        );

        data.address = modifiedLines.join("\n");
      }

      // Don't prepend if the textArea is blank
      if (lines.length === 1 && lines[0] === "") {
        data.address = "";
      }

      // Send POST request to server
      await fillInForm(props.apiUrl, data);

      // Gate to prevent multiple firebase calls on same session/image
      if (haveUpdatedFirebaseOnce === true) {
        return;
      }

      // Update firebase stats
      try {
        // Get a reference to the document
        const docRef = doc(db, "globalStats", "tjxStatistics");

        // Fetch the document
        const docSnap = await getDoc(docRef);

        // Update specific fields in the document
        const document = docSnap.data()!;
        document.imagesProcessed++;
        if (isMpImage.value) {
          document.numberOfMpImages++;
        }
        if (isBadImage.value) {
          document.numberOfBadImages++;
        }

        // Update the document in firestore
        await updateDoc(docRef, {
          imagesProcessed: document.imagesProcessed,
          numberOfMpImages: document.numberOfMpImages,
          numberOfHwImages: document.numberOfHwImages,
          numberOfBadImages: document.numberOfBadImages,
        });

        // Set firebase gate to stop multiple uploads
        haveUpdatedFirebaseOnce = true;
      } catch {
        console.error("Error getting stats document from firestore");
      }

      // Add image data to firebase
      try {
        // Reference to the collection
        const collectionRef = collection(db, "tjxImageData");

        // Set image type as a string
        let imageType = "";
        if (isMpImage.value) {
          imageType = "mp";
        }
        if (isBadImage.value) {
          imageType = "bad";
        }

        // Data to be added
        const newData = {
          imageName: imageNameRef.value.innerText,
          imageType: imageType,
          timeOnImage: experience.world.imageContainer?.stopwatch.elapsedTime,
          rotation: experience.world.imageContainer?.imageRotation,
          addressSubmitted: data.address,
          dateSubmitted: new Date(),
        };

        // Add a new document with an auto-generated ID
        await addDoc(collectionRef, newData);
      } catch {
        console.error("Error adding image data document to firestore");
      }
    };

    const loadNextImage = async () => {
      // Navigate to the next image then download
      const image = await gotoNextImage(props.apiUrl);

      if (!image) {
        return;
      }

      // Reset firebase gate
      haveUpdatedFirebaseOnce = false;

      // Start image load into webgl scene as a texture, resourceLoader will trigger an event when finished loading
      experience.resources.loadGtImageFromApi(image.imageBlob);

      // Set the image's name in the gui
      imageNameRef.value.innerText = image.imageName + ".jpg";

      // Clear all fields for new image, except isMpImage since that should be the default
      GroupTextArea0Active.value.value = "";
      isMpImage.value = true;
      isBadImage.value = false;
      isVendorOnly.value = false;
    };

    /* ----------------------------- Render function ---------------------------- */
    return () => (
      <article class="overflow-hidden w-[27rem] mt-5 ml-5 p-4 bg-slate-800/85 rounded-2xl">
        {/* Filename, debug info, navigation buttons */}
        <section class="flex justify-between items-center">
          <div>
            <div class="flex items-center w-full">
              <p class="mr-1 font-medium text-gray-100 text-xs text-ellipsis">
                Image:
              </p>
              <p
                id="gtImageName"
                ref={imageNameRef}
                class="mr-4 self-end overflow-hidden font-medium text-gray-100 text-xs text-ellipsis"
              />
            </div>
            <div class="mt-1 flex items-center w-full">
              <p class="mr-1 font-medium text-gray-100 text-xs text-ellipsis">
                Download count:
              </p>
              <p class="mr-4 self-end overflow-hidden font-medium text-gray-100 text-xs text-ellipsis">
                {imageDownloadCount.value}
              </p>
            </div>
          </div>
          <div class="flex self-start">
            <ActionButton
              buttonType="Prev"
              roundLeftCorner={true}
              roundRightCorner={false}
              handleClick={() => Emitter.emit("gotoPrevImage")}
              showText={true}
            />
            <ActionButton
              buttonType="Next"
              roundLeftCorner={false}
              roundRightCorner={false}
              handleClick={() => Emitter.emit("gotoNextImage")}
              showText={true}
            />
            <ActionButton
              buttonType="Send"
              roundLeftCorner={false}
              roundRightCorner={true}
              handleClick={() => Emitter.emit("fillInForm")}
              showText={true}
            />
          </div>
        </section>

        {/* Textareas for Groups */}
        <section class="mt-4 mb-4">
          <GroupTextArea
            color="green"
            id="dashboardTextarea0"
            isActive={GroupTextArea0Active.value}
          />
          <GroupTextArea
            color="red"
            id="dashboardTextarea1"
            isActive={GroupTextArea1Active.value}
          />
          <GroupTextArea
            color="blue"
            id="dashboardTextarea2"
            isActive={GroupTextArea2Active.value}
          />
        </section>

        {/* Mail type, Image Action buttons */}
        <section class="mt-2 flex justify-between items-center">
          <div class="flex">
            <MailTypeButton
              buttonType="MP"
              buttonVariable={isMpImage.value}
              roundLeftCorner={true}
              roundRightCorner={false}
              handleClick={() => {
                isMpImage.value = !isMpImage.value;
                isHwImage.value = false;
                isBadImage.value = false;
              }}
            />
            <MailTypeButton
              buttonType="HW"
              buttonVariable={isHwImage.value}
              roundLeftCorner={false}
              roundRightCorner={false}
              handleClick={() => {
                isMpImage.value = false;
                isHwImage.value = !isHwImage.value;
                isBadImage.value = false;
              }}
            />
            <MailTypeButton
              buttonType="Bad"
              buttonVariable={isBadImage.value}
              roundLeftCorner={false}
              roundRightCorner={true}
              handleClick={() => {
                isMpImage.value = false;
                isHwImage.value = false;
                isBadImage.value = !isBadImage.value;
              }}
            />
          </div>
          <div class="flex">
            <ActionButton
              buttonType="Cut"
              roundLeftCorner={true}
              roundRightCorner={false}
              handleClick={() => Emitter.emit("stitchBoxes")}
            />
            <ActionButton
              buttonType="SendToVision"
              roundLeftCorner={false}
              roundRightCorner={false}
              handleClick={() => Emitter.emit("screenshotImage")}
            />
            <ActionButton
              buttonType="Reset"
              roundLeftCorner={false}
              roundRightCorner={true}
              handleClick={() => Emitter.emit("resetImage")}
            />
          </div>
        </section>

        {/* Special mail tagging, Group Action buttons */}
        <section class="mt-2 flex justify-between items-center">
          <div class="flex gap-2">
            <MailTypeButton
              buttonType="Vendor Only"
              buttonVariable={isVendorOnly.value}
              roundLeftCorner={true}
              roundRightCorner={true}
              handleClick={() => {
                isVendorOnly.value = !isVendorOnly.value;
              }}
            />
          </div>
          <div class="flex self-start">
            <ActionButton
              buttonType="Group0"
              roundLeftCorner={true}
              roundRightCorner={false}
              handleClick={() => {
                Emitter.emit("changeSelectionGroup", 0);
              }}
            />
            <ActionButton
              buttonType="Group1"
              roundLeftCorner={false}
              roundRightCorner={false}
              handleClick={() => {
                Emitter.emit("changeSelectionGroup", 1);
              }}
            />
            <ActionButton
              buttonType="Group2"
              roundLeftCorner={false}
              roundRightCorner={true}
              handleClick={() => {
                Emitter.emit("changeSelectionGroup", 2);
              }}
            />
          </div>
        </section>
      </article>
    );
  },
});
