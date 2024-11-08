import Emitter from "../eventEmitter";
import { defineComponent, ref } from "vue";
import Experience from "../webgl/experience";
import { fillInForm, gotoNextImage } from "./apiHandler";
import {
  ArrowUpCircleIcon,
  ArrowUturnLeftIcon,
  ForwardIcon,
  MagnifyingGlassCircleIcon,
  ScissorsIcon,
} from "@heroicons/vue/16/solid";
import { db } from "../firebase";
import { collection, doc, addDoc, getDoc, updateDoc } from "firebase/firestore";

export default defineComponent({
  props: {
    apiUrl: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    /* ------------------------ Component state and setup ----------------------- */
    // Template refs
    const imageNameRef = ref();
    const textAreaRef = ref();

    const experience = Experience.getInstance();

    let haveUpdatedFirebaseOnce = false;

    const isMpImage = ref(true); // Make this a default value
    const isHWImage = ref(false);
    const isBadImage = ref(false);

    const isRts = ref(false);
    const isFwd = ref(false);
    const is3547 = ref(false);
    const isDblFeed = ref(false);

    /* --------------------------------- Events --------------------------------- */
    Emitter.on("fillInForm", async () => {
      await FormHelper();
    });
    Emitter.on("gotoNextImage", async () => {
      await NextImageHelper();
    });

    /* ----------------------------- Template events ---------------------------- */
    const MailTypeButtonClicked = (buttonType: string) => {
      switch (buttonType) {
        case "MP":
          isMpImage.value = !isMpImage.value;
          isHWImage.value = false;
          isBadImage.value = false;
          break;

        case "HW":
          isMpImage.value = false;
          isHWImage.value = !isHWImage.value;
          isBadImage.value = false;
          break;

        case "Bad":
          isMpImage.value = false;
          isHWImage.value = false;
          isBadImage.value = !isBadImage.value;
          break;

        case "RTS/RFS":
          isRts.value = !isRts.value;
          isFwd.value = false;
          is3547.value = false;
          isDblFeed.value = false;
          break;

        case "FWD":
          isRts.value = false;
          isFwd.value = !isFwd.value;
          is3547.value = false;
          isDblFeed.value = false;
          break;

        case "Form 3547":
          isRts.value = false;
          isFwd.value = false;
          is3547.value = !is3547.value;
          isDblFeed.value = false;
          break;

        case "DBL Feed":
          isRts.value = false;
          isFwd.value = false;
          is3547.value = false;
          isDblFeed.value = !isDblFeed.value;
          break;

        default:
          break;
      }
    };

    const NavButtonClicked = (buttonType: string) => {
      if (buttonType === "Send") {
        Emitter.emit("fillInForm");
        return;
      }

      if (buttonType === "Next") {
        Emitter.emit("gotoNextImage");
        return;
      }
    };

    const ActionButtonClicked = (buttonType: string) => {
      switch (buttonType) {
        case "Cut":
          Emitter.emit("stitchBoxes");
          break;
        case "SendToVision":
          Emitter.emit("screenshotImage");
          break;
        case "Reset":
          Emitter.emit("resetImage");
          break;

        default:
          break;
      }
    };

    /* ---------------------------- Helper functions ---------------------------- */
    const FormHelper = async () => {
      // Define data request body
      const data = {
        address: textAreaRef.value.value,

        isMpImage: isMpImage.value,
        isHwImage: isHWImage.value,
        isBadImage: isBadImage.value,
      };

      // Change the data based on gui
      if (isRts.value) {
        data.address = "RTS\n" + textAreaRef.value.value;
      }
      if (isFwd.value) {
        data.address = "FWD\n" + textAreaRef.value.value;
      }
      if (is3547.value) {
        data.address = "FORM3547\n" + textAreaRef.value.value;
      }
      if (isDblFeed.value) {
        data.address = "DBL FEED\n" + textAreaRef.value.value;
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
        const docRef = doc(db, "globalStats", "statistics");

        // Fetch the document
        const docSnap = await getDoc(docRef);

        // Update specific fields in the document
        const document = docSnap.data()!;
        document.imagesProcessed++;
        if (isMpImage.value) {
          document.numberOfMpImages++;
        }
        if (isHWImage.value) {
          document.numberOfHwImages++;
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
        const collectionRef = collection(db, "imageData");

        // Set image type as a string
        let imageType = "";
        if (isMpImage.value) {
          imageType = "mp";
        }
        if (isHWImage.value) {
          imageType = "hw";
        }
        if (isBadImage.value) {
          imageType = "bad";
        }

        // Data to be added
        const newData = {
          imageName: imageNameRef.value.innerText,
          imageType: imageType,
          timeOnImage: experience.world.imageBoxHandler?.stopwatch.elapsedTime,
          rotation: experience.world.imageBoxHandler?.debugRotation,
          addressSubmitted: data.address,
          boundingBoxMinX:
            experience.world.clipBoxHandler?.combinedBoundingBox.min.x,
          boundingBoxMinY:
            experience.world.clipBoxHandler?.combinedBoundingBox.min.y,
          boundingBoxMaxX:
            experience.world.clipBoxHandler?.combinedBoundingBox.max.x,
          boundingBoxMaxY:
            experience.world.clipBoxHandler?.combinedBoundingBox.max.y,
          dateSubmitted: new Date(),
        };

        // Add a new document with an auto-generated ID
        await addDoc(collectionRef, newData);
      } catch {
        console.error("Error adding image data document to firestore");
      }
    };

    const NextImageHelper = async () => {
      // Navigate to the next image then download
      const image = await gotoNextImage(props.apiUrl);

      if (!image) {
        return;
      }

      // Reset firebase gate
      haveUpdatedFirebaseOnce = false;

      // Start image load into webgl scene as a texture, resourceLoader will trigger an event when finished loading
      experience.resources.loadFromApi(image.imageBlob);

      // Set the image's name in the gui
      imageNameRef.value.innerText = image.imageName + ".jpg";

      // Clear all fields for new image, except isMpImage since that should be the default
      textAreaRef.value.value = "";
      isMpImage.value = true;
      isHWImage.value = false;
      isBadImage.value = false;
      isRts.value = false;
      isFwd.value = false;
      is3547.value = false;
      isDblFeed.value = false;
    };

    /* ------------------------------ Subcomponents ----------------------------- */
    const MailTypeButton = (
      buttonType: string,
      buttonVariable: boolean,
      roundLeftCorner: boolean,
      roundRightCorner: boolean
    ) => {
      return (
        <button
          onClick={() => MailTypeButtonClicked(buttonType)}
          class={{
            "flex items-center py-2 px-3 gap-2 border border-white/50 group hover:border-indigo-600 duration-300":
              true,
            "rounded-l-xl": roundLeftCorner,
            "rounded-r-xl": roundRightCorner,
          }}
        >
          <div
            class={{
              "h-5 w-5 rounded-full duration-300": true,
              "bg-green-500 ring-1 ring-white":
                buttonType !== "Bad" && buttonVariable,
              "bg-red-500 ring-1 ring-white":
                buttonType === "Bad" && buttonVariable,
              "ring-1 ring-white": !buttonVariable,
            }}
          />
          <p class="text-white text-sm group-hover:text-indigo-200 duration-300">
            {buttonType}
          </p>
        </button>
      );
    };

    const NavButton = (
      buttonType: string,
      roundLeftCorner: boolean,
      roundRightCorner: boolean
    ) => {
      return (
        <button
          onClick={() => NavButtonClicked(buttonType)}
          class={{
            "flex items-center py-2 px-3 gap-2 border border-white/50 group hover:border-indigo-600 duration-300":
              true,
            "rounded-l-xl": roundLeftCorner,
            "rounded-r-xl": roundRightCorner,
          }}
        >
          {NavButtonIconSelector(buttonType)}
          <p class="text-white text-sm group-hover:text-indigo-100 duration-300">
            {buttonType}
          </p>
        </button>
      );
    };

    const NavButtonIconSelector = (buttonType: string) => {
      if (buttonType === "Send") {
        return (
          <ArrowUpCircleIcon class="h-5 w-5 text-gray-100 transition-colors group-hover:text-indigo-100 duration-300" />
        );
      }
      if (buttonType === "Next") {
        return (
          <ForwardIcon class="h-5 w-5 text-gray-100 transition-colors group-hover:text-indigo-100 duration-300" />
        );
      }
    };

    const ActionButton = (
      buttonType: string,
      roundLeftCorner: boolean,
      roundRightCorner: boolean
    ) => {
      return (
        <button
          onClick={() => ActionButtonClicked(buttonType)}
          class={{
            "py-2 px-3 border border-white/50 transition-colors group hover:border-indigo-600 duration-300":
              true,
            "rounded-l-xl": roundLeftCorner,
            "rounded-r-xl": roundRightCorner,
          }}
        >
          {ActionButtonIconSelector(buttonType)}
        </button>
      );
    };

    const ActionButtonIconSelector = (buttonType: string) => {
      switch (buttonType) {
        case "Cut":
          return (
            <ScissorsIcon class="h-5 w-5 text-gray-100 group-hover:text-indigo-100 duration-300" />
          );

        case "SendToVision":
          return (
            <MagnifyingGlassCircleIcon class="h-5 w-5 text-gray-100 group-hover:text-indigo-100 duration-300" />
          );

        case "Reset":
          return (
            <ArrowUturnLeftIcon class="h-5 w-5 text-gray-100 group-hover:text-indigo-100 duration-300" />
          );

        default:
          break;
      }
    };

    /* ----------------------------- Render function ---------------------------- */
    return () => (
      <article class="overflow-hidden pt-5 pl-5">
        {/* Filename, textarea, clipboard copy button */}
        <section class="w-[27rem]">
          <div class="flex justify-between items-center">
            <label
              id="gtImageName"
              ref={imageNameRef}
              for="comment"
              class="mr-4 self-end overflow-hidden font-medium leading-6 text-gray-100 text-xs text-ellipsis"
            ></label>
            <div class="flex">
              {NavButton("Send", true, false)}
              {NavButton("Next", false, true)}
            </div>
          </div>
          <div class="mt-2">
            <textarea
              ref={textAreaRef}
              rows="4"
              id="guiTextArea"
              class="bg-transparent text-gray-100 text-sm leading-6 resize-none w-full rounded-md border-0 py-1.5 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
            />
          </div>
        </section>

        {/* Mail type and nav buttons */}
        <section class="mt-2 flex justify-between items-center">
          <div class="flex">
            {MailTypeButton("MP", isMpImage.value, true, false)}
            {MailTypeButton("HW", isHWImage.value, false, false)}
            {MailTypeButton("Bad", isBadImage.value, false, true)}
          </div>
          <div class="flex">
            {ActionButton("Cut", true, false)}
            {ActionButton("SendToVision", false, false)}
            {ActionButton("Reset", false, true)}
          </div>
        </section>

        {/* Special mail designations */}
        <section class="mt-2 flex items-center">
          <div class="flex">
            {MailTypeButton("RTS/RFS", isRts.value, true, false)}
            {MailTypeButton("FWD", isFwd.value, false, false)}
            {MailTypeButton("Form 3547", is3547.value, false, false)}
            {MailTypeButton("DBL Feed", isDblFeed.value, false, true)}
          </div>
        </section>
      </article>
    );
  },
});
