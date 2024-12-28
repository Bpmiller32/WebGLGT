import Emitter from "../webgl/utils/eventEmitter";
import { defineComponent, PropType, ref } from "vue";
import Experience from "../webgl/experience";
import ApiHander from "../apiHandler";
import ActionButton from "./subcomponents/ActionButton";
import MailTypeButton from "./subcomponents/MailTypeButton";
import GroupTextArea from "./subcomponents/GroupTextArea";

export default defineComponent({
  props: {
    apiUrl: {
      type: String as PropType<string>,
      required: true,
    },
    webglExperience: {
      type: Object as PropType<Experience>,
      required: true,
    },
  },
  setup(props) {
    /* ------------------------ Component state and setup ----------------------- */
    // Template refs
    const imageNameRef = ref();

    const GroupTextArea0Value = ref();
    const GroupTextArea0Active = ref();

    const GroupTextArea1Value = ref();
    const GroupTextArea1Active = ref();

    const GroupTextArea2Value = ref();
    const GroupTextArea2Active = ref();

    // Status
    const gtSavedCount = ref(0);

    // MailType tags
    const isMpImage = ref(true); // Make this a default value
    const isHwImage = ref(false);
    const isBadImage = ref(false);
    const isVendorOnly = ref(false);

    /* ---------------------------- Lifecycle Events ---------------------------- */
    Emitter.on("fillInForm", async () => {
      await submitToDb();
      gtSavedCount.value++;
    });
    Emitter.on("gotoNextImage", async () => {
      await loadNextImage();

      GroupTextArea0Active.value = false;
      GroupTextArea1Active.value = false;
      GroupTextArea2Active.value = false;
    });
    Emitter.on("gotoPrevImage", async () => {
      await loadPrevImage();

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
      isHwImage.value = false;
      isBadImage.value = true;

      await submitToDb();
      gtSavedCount.value++;
    });

    /* ---------------------------- Helper functions ---------------------------- */
    const submitToDb = async () => {
      // Determine image type
      let imageType = "";
      if (isMpImage.value) imageType = "mp";
      if (isHwImage.value) imageType = "hw";
      if (isBadImage.value) imageType = "bad";

      // Prepare update data
      const updateData = {
        imageType: imageType,
        rotation:
          props.webglExperience.world.imageContainer?.imageRotation || 0,
        timeOnImage:
          props.webglExperience.world.imageContainer?.stopwatch.elapsedTime ||
          0,
        status: "completed",
        groupText0: GroupTextArea0Value.value || "",
        groupText1: GroupTextArea1Value.value || "",
        groupText2: GroupTextArea2Value.value || "",

        // Convert coordinates to plain objects with numeric values
        groupCoordinates0:
          props.webglExperience.world.selectionGroupManager?.selectionGroupPixelCoordinates0?.map(
            (coord) => ({
              x: Number(coord.x.toFixed(2)),
              y: Number(coord.y.toFixed(2)),
            })
          ) || [],
        groupCoordinates1:
          props.webglExperience.world.selectionGroupManager?.selectionGroupPixelCoordinates1?.map(
            (coord) => ({
              x: Number(coord.x.toFixed(2)),
              y: Number(coord.y.toFixed(2)),
            })
          ) || [],
        groupCoordinates2:
          props.webglExperience.world.selectionGroupManager?.selectionGroupPixelCoordinates2?.map(
            (coord) => ({
              x: Number(coord.x.toFixed(2)),
              y: Number(coord.y.toFixed(2)),
            })
          ) || [],
      };

      try {
        const requestBody = {
          projectName: localStorage.getItem("projectName") || "testTjx2",
          updateData,
        };

        // // Debug
        // console.log("Full request body:", JSON.stringify(requestBody, null, 2));

        // Send update request to server
        const response = await fetch(`${props.apiUrl}/updateImage`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`Failed to update image: ${response.statusText}`);
        }

        // Load next image after successful update
        // await loadNextImage();
      } catch (error) {
        console.error("Error updating image:", error);
      }
    };

    const loadNextImage = async () => {
      // Pull next viable image from backend
      await ApiHander.handleNextImage(props.apiUrl, props.webglExperience);

      // Clear all fields for new image, except isMpImage since that should be the default
      GroupTextArea0Value.value = "";
      GroupTextArea0Active.value = false;
      GroupTextArea1Value.value = "";
      GroupTextArea1Active.value = false;
      GroupTextArea2Value.value = "";
      GroupTextArea2Active.value = false;
      isMpImage.value = true;
      isBadImage.value = false;
      isVendorOnly.value = false;
    };

    const loadPrevImage = async () => {
      // Pull previous image from backend, user's history
      await ApiHander.handlePrevImage(props.apiUrl, props.webglExperience);

      // Clear all fields for new image, except isMpImage since that should be the default
      GroupTextArea0Value.value = "";
      GroupTextArea0Active.value = false;
      GroupTextArea1Value.value = "";
      GroupTextArea1Active.value = false;
      GroupTextArea2Value.value = "";
      GroupTextArea2Active.value = false;
      isMpImage.value = true;
      isBadImage.value = false;
      isVendorOnly.value = false;
    };

    /* ----------------------------- Render function ---------------------------- */
    return () => (
      <article class="overflow-hidden w-[27rem] mt-5 ml-5 p-4 bg-slate-800/85 rounded-2xl">
        {/* Filename, debug info, navigation buttons */}
        <section class="flex justify-between items-center">
          <div class="w-32">
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
                GT count:
              </p>
              <p class="mr-4 self-end overflow-hidden font-medium text-gray-100 text-xs text-ellipsis">
                {gtSavedCount.value}
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
            setTextArea={(newValue: string) =>
              (GroupTextArea0Value.value = newValue)
            }
          />
          <GroupTextArea
            color="red"
            id="dashboardTextarea1"
            isActive={GroupTextArea1Active.value}
            setTextArea={(newValue: string) =>
              (GroupTextArea1Value.value = newValue)
            }
          />
          <GroupTextArea
            color="blue"
            id="dashboardTextarea2"
            isActive={GroupTextArea2Active.value}
            setTextArea={(newValue: string) =>
              (GroupTextArea2Value.value = newValue)
            }
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
