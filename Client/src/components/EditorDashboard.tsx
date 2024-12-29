import Emitter from "../webgl/utils/eventEmitter";
import { defineComponent, PropType, ref } from "vue";
import Experience from "../webgl/experience";
import ApiHandler from "../apiHandler";
import ActionButton from "./subcomponents/ActionButton";
import MailTypeButton from "./subcomponents/MailTypeButton";
import GroupTextArea from "./subcomponents/GroupTextArea";

export default defineComponent({
  props: {
    webglExperience: {
      type: Object as PropType<Experience>,
      required: true,
    },
  },
  setup(props) {
    /* ------------------------ Component state and setup ----------------------- */
    // Env variables
    const apiUrl = import.meta.env.VITE_NGROK_URL;

    // Template refs
    const imageNameRef = ref<HTMLParagraphElement | null>(null);
    const gtSavedCount = ref<number>(0);

    // Group Text Areas
    const groupTextAreas = ref<{ value: string; isActive: boolean }[]>([
      { value: "", isActive: false },
      { value: "", isActive: false },
      { value: "", isActive: false },
    ]);

    // MailType tags
    const mailTypes = ref<{
      isMpImage: boolean;
      isHwImage: boolean;
      isBadImage: boolean;
      isVendorOnly: boolean;
    }>({
      isMpImage: true, // Make this a default value
      isHwImage: false,
      isBadImage: false,
      isVendorOnly: false,
    });

    /* ---------------------------- Lifecycle Events ---------------------------- */
    Emitter.on("fillInForm", async () => {
      await submitToDb();
      gtSavedCount.value++;
    });
    Emitter.on("appLoading", () => {
      activateGroup(0);
    });
    Emitter.on("gotoNextImage", async () => {
      await loadNextImage();
      activateGroup(0);
    });
    Emitter.on("gotoPrevImage", async () => {
      await loadPrevImage();
      activateGroup(0);
    });
    Emitter.on("changeSelectionGroup", (groupNumber) => {
      activateGroup(groupNumber);
    });
    Emitter.on("resetImage", () => {
      activateGroup(0);
    });
    Emitter.on("badImage", async () => {
      Object.assign(mailTypes.value, {
        isMpImage: false,
        isHwImage: false,
        isBadImage: true,
        isVendorOnly: false,
      });

      await submitToDb();
      gtSavedCount.value++;
    });

    /* ---------------------------- Helper functions ---------------------------- */
    const activateGroup = (groupNumber: number) => {
      groupTextAreas.value.forEach((group, index) => {
        if (index === groupNumber) {
          // Activate the specified group
          group.isActive = true;
        } else {
          // Deactivate all other groups
          group.isActive = false;
        }
      });
    };

    const submitToDb = async () => {
      // Determine image type
      let imageType = "";
      if (mailTypes.value.isMpImage) {
        imageType = "mp";
      } else if (mailTypes.value.isHwImage) {
        imageType = "hw";
      } else if (mailTypes.value.isBadImage) {
        imageType = "bad";
      }

      // Prepare update data for request body
      const updateData = {
        imageType: imageType,
        status: "completed",
        rotation:
          props.webglExperience.world.imageContainer?.imageRotation || 0,
        timeOnImage:
          props.webglExperience.world.imageContainer?.stopwatch.elapsedTime ||
          0,
        groupText0: groupTextAreas.value[0].value || "",
        groupText1: groupTextAreas.value[1].value || "",
        groupText2: groupTextAreas.value[2].value || "",

        // Convert coordinates to plain objects with numeric values so they can be stored in Firebase
        groupCoordinates0:
          props.webglExperience.world.selectionGroupManager?.selectionGroupPixelCoordinates0?.map(
            (coord) => ({
              x: Number(coord.x.toFixed(4)),
              y: Number(coord.y.toFixed(4)),
            })
          ) || [],
        groupCoordinates1:
          props.webglExperience.world.selectionGroupManager?.selectionGroupPixelCoordinates1?.map(
            (coord) => ({
              x: Number(coord.x.toFixed(4)),
              y: Number(coord.y.toFixed(4)),
            })
          ) || [],
        groupCoordinates2:
          props.webglExperience.world.selectionGroupManager?.selectionGroupPixelCoordinates2?.map(
            (coord) => ({
              x: Number(coord.x.toFixed(4)),
              y: Number(coord.y.toFixed(4)),
            })
          ) || [],
      };

      // Send the update request
      await ApiHandler.updateImageData(apiUrl, updateData);
    };

    const loadNextImage = async () => {
      await ApiHandler.handleNextImage(apiUrl, props.webglExperience);
      activateGroup(0);

      Object.assign(mailTypes.value, {
        isMpImage: true,
        isHwImage: false,
        isBadImage: false,
        isVendorOnly: false,
      });
    };

    const loadPrevImage = async () => {
      await ApiHandler.handlePrevImage(apiUrl, props.webglExperience);
      activateGroup(0);

      Object.assign(mailTypes.value, {
        isMpImage: true,
        isHwImage: false,
        isBadImage: false,
        isVendorOnly: false,
      });
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
            isActive={groupTextAreas.value[0].isActive}
            setTextArea={(newValue: string) =>
              (groupTextAreas.value[0].value = newValue)
            }
          />
          <GroupTextArea
            color="red"
            id="dashboardTextarea1"
            isActive={groupTextAreas.value[1].isActive}
            setTextArea={(newValue: string) =>
              (groupTextAreas.value[1].value = newValue)
            }
          />
          <GroupTextArea
            color="blue"
            id="dashboardTextarea2"
            isActive={groupTextAreas.value[2].isActive}
            setTextArea={(newValue: string) =>
              (groupTextAreas.value[2].value = newValue)
            }
          />
        </section>

        {/* Mail type, Image Action buttons */}
        <section class="mt-2 flex justify-between items-center">
          <div class="flex">
            <MailTypeButton
              buttonType="MP"
              buttonVariable={mailTypes.value.isMpImage}
              roundLeftCorner={true}
              roundRightCorner={false}
              handleClick={() => {
                Object.assign(mailTypes.value, {
                  isMpImage: !mailTypes.value.isMpImage,
                  isHwImage: false,
                  isBadImage: false,
                  isVendorOnly: mailTypes.value.isVendorOnly,
                });
              }}
            />
            <MailTypeButton
              buttonType="HW"
              buttonVariable={mailTypes.value.isHwImage}
              roundLeftCorner={false}
              roundRightCorner={false}
              handleClick={() => {
                Object.assign(mailTypes.value, {
                  isMpImage: false,
                  isHwImage: !mailTypes.value.isHwImage,
                  isBadImage: false,
                  isVendorOnly: mailTypes.value.isVendorOnly,
                });
              }}
            />
            <MailTypeButton
              buttonType="Bad"
              buttonVariable={mailTypes.value.isBadImage}
              roundLeftCorner={false}
              roundRightCorner={true}
              handleClick={() => {
                Object.assign(mailTypes.value, {
                  isMpImage: false,
                  isHwImage: false,
                  isBadImage: !mailTypes.value.isBadImage,
                  isVendorOnly: mailTypes.value.isVendorOnly,
                });
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
              buttonVariable={mailTypes.value.isVendorOnly}
              roundLeftCorner={true}
              roundRightCorner={true}
              handleClick={() =>
                (mailTypes.value.isVendorOnly = !mailTypes.value.isVendorOnly)
              }
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
