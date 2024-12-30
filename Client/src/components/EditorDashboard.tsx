import Emitter from "../webgl/utils/eventEmitter";
import { defineComponent, PropType, ref } from "vue";
import Experience from "../webgl/experience";
import ApiHandler from "../apiHandler";
import ActionButton from "./subcomponents/ActionButton";
import MailTypeButton from "./subcomponents/MailTypeButton";
import GroupTextArea from "./subcomponents/GroupTextArea";
import UserButton from "./subcomponents/UserButton";
import {
  ArrowLeftEndOnRectangleIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/vue/16/solid";

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
    const gtSavedCount = ref<number>(0);

    // Group Text Areas
    const groupTextAreas = ref<{ value: string; isActive: boolean }[]>([
      { value: "", isActive: false },
      { value: "", isActive: false },
      { value: "", isActive: false },
    ]);

    // MailType tags
    const textClassificationTags = ref<{ type: string; active: boolean }[]>([
      { type: "MP", active: true }, // Default active
      { type: "HW", active: false },
      { type: "Bad", active: false },
    ]);

    // Default state for otherMailTags
    const otherMailTags = ref<{ type: string; active: boolean }[]>([]);

    // Icons for user buttons
    const userButtonConfig = {
      logout: <ArrowLeftEndOnRectangleIcon class="h-5 w-5" />,
      help: <QuestionMarkCircleIcon class="h-5 w-5" />,
    };

    /* ---------------------------- Lifecycle Events ---------------------------- */
    Emitter.on("setEditorDashboard", ({ numberOfSelectionGroups, tags }) => {
      // Update otherMailTags
      if (tags && tags.length > 0) {
        otherMailTags.value = tags.map((tag) => ({
          type: tag,
          active: false, // Default inactive state
        }));
      } else {
        // Reset to default state if no strings are provided
        otherMailTags.value = [];
      }

      // Update groupTextAreas based on numberOfSelectionGroups
      if (numberOfSelectionGroups && numberOfSelectionGroups > 0) {
        groupTextAreas.value = Array.from(
          { length: numberOfSelectionGroups },
          () => ({
            value: "",
            isActive: false,
          })
        );
      } else {
        // Default to 3 groups if no number or invalid number is provided
        groupTextAreas.value = [
          { value: "", isActive: false },
          { value: "", isActive: false },
          { value: "", isActive: false },
        ];
      }

      // Ensure the first group is active
      Emitter.emit("changeSelectionGroup", 0);
    });
    Emitter.on("fillInForm", async () => {
      await submitToDb();
      gtSavedCount.value++;
    });
    Emitter.on("appSuccess", () => {
      activateGroup(0);
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
      Object.assign(textClassificationTags.value, {
        isMpImage: false,
        isHwImage: false,
        isBadImage: true,
        isVendorOnly: false,
        isForm3547: false,
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
      // Determine the active mail type
      const activeMailType = textClassificationTags.value.find(
        (mailType) => mailType.active
      );
      const imageType = activeMailType ? activeMailType.type.toLowerCase() : "";

      // Dynamically prepare group text and coordinates
      const groupTexts = Object.fromEntries(
        groupTextAreas.value.map((group, index) => [
          `groupText${index}`,
          group.value || "",
        ])
      );
      const groupCoordinates = Object.fromEntries(
        groupTextAreas.value.map((_, index) => {
          // Dynamically access the property and cast its type
          const key = `selectionGroupPixelCoordinates${index}`;
          const coordinates = (
            (
              props.webglExperience.world.selectionGroupManager as Record<
                string,
                any
              >
            )?.[key] || []
          ).map((coord: { x: number; y: number }) => ({
            x: Number(coord.x.toFixed(4)),
            y: Number(coord.y.toFixed(4)),
          }));

          return [`groupCoordinates${index}`, coordinates];
        })
      );

      // Prepare update data for request body
      const updateData = {
        imageType: imageType,
        status: "completed",
        rotation:
          props.webglExperience.world.imageContainer?.imageRotation || 0,
        timeOnImage:
          props.webglExperience.world.imageContainer?.stopwatch.elapsedTime ||
          0,

        ...groupTexts,
        ...groupCoordinates,
      };

      // Send the update request
      await ApiHandler.updateImageData(apiUrl, updateData);
    };

    const loadNextImage = async () => {
      await ApiHandler.handleNextImage(apiUrl, props.webglExperience);
      activateGroup(0);

      Object.assign(textClassificationTags.value, {
        isMpImage: true,
        isHwImage: false,
        isBadImage: false,
        isVendorOnly: false,
        isForm3547: false,
      });
    };

    const loadPrevImage = async () => {
      await ApiHandler.handlePrevImage(apiUrl, props.webglExperience);
      activateGroup(0);

      Object.assign(textClassificationTags.value, {
        isMpImage: true,
        isHwImage: false,
        isBadImage: false,
        isVendorOnly: false,
        isForm3547: false,
      });
    };

    /* ----------------------------- Render function ---------------------------- */
    return () => (
      <article class="mt-5 ml-5">
        {/* Image name, GT save count. Outside of controls */}
        <header class="w-[27rem] pb-2 pl-4 flex">
          <div class="overflow-hidden">
            <div class="mb-1 flex items-center w-full">
              <p class="mr-1 font-medium text-gray-100 text-xs text-ellipsis">
                Image:
              </p>
              <p
                id="gtImageName"
                class="mr-4 self-end overflow-hidden font-medium text-gray-100 text-xs text-ellipsis whitespace-nowrap"
              />
            </div>
            <div class="flex items-center w-full">
              <p class="mr-1 font-medium text-gray-100 text-xs text-ellipsis">
                GT count:
              </p>
              <p class="mr-4 self-end overflow-hidden font-medium text-gray-100 text-xs text-ellipsis whitespace-nowrap">
                {gtSavedCount.value}
              </p>
            </div>
          </div>
        </header>

        {/* Controls  */}
        <aside class="w-[27rem] p-4 bg-slate-800/85 rounded-2xl">
          {/* User, navigation buttons */}
          <section class="mb-4 flex justify-between items-center">
            <div class="flex gap-2">
              <UserButton
                icon={userButtonConfig.logout}
                handleClick={() => {
                  // Removes all items from localStorage
                  localStorage.clear();
                  // Refreshes the current page which will kick back to login screen
                  location.reload();
                }}
              />
              <UserButton
                icon={userButtonConfig.help}
                handleClick={async () => {
                  await ApiHandler.getPdf(apiUrl);
                }}
              />
            </div>
            <div class="flex">
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
          <section class="mb-4">
            {groupTextAreas.value.map((group, index) => (
              <GroupTextArea
                key={`groupTextArea-${index}`}
                color={["green", "red", "blue"][index % 3]} // Rotate colors if needed
                id={`dashboardTextarea${index}`}
                isActive={group.isActive}
                setTextArea={(newValue: string) => (group.value = newValue)}
              />
            ))}
          </section>

          {/* Mail type, Image Action buttons */}
          <section class="mb-2 flex justify-between items-center">
            <div class="flex">
              {textClassificationTags.value.map((mailType, index) => (
                <MailTypeButton
                  key={mailType.type}
                  buttonType={mailType.type}
                  buttonVariable={mailType.active}
                  roundLeftCorner={index === 0}
                  roundRightCorner={
                    index === textClassificationTags.value.length - 1
                  }
                  handleClick={() => {
                    if (mailType.active) {
                      // If the clicked button is already active, deactivate it
                      mailType.active = false;
                    } else {
                      // Deactivate all buttons first
                      textClassificationTags.value.forEach((tag) => {
                        tag.active = false;
                      });
                      // Activate the current button
                      mailType.active = true;
                    }
                  }}
                />
              ))}
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
          <section class="flex justify-between items-center">
            <div class="flex flex-wrap gap-2 max-w-[232px]">
              {otherMailTags.value.map((mailType) => (
                <MailTypeButton
                  key={mailType.type}
                  buttonType={mailType.type}
                  buttonVariable={mailType.active}
                  roundLeftCorner={true}
                  roundRightCorner={true}
                  handleClick={() => {
                    // Toggle the current button's active state
                    mailType.active = !mailType.active;
                  }}
                />
              ))}
            </div>
            <div class="flex self-start">
              {groupTextAreas.value.length > 1 &&
                groupTextAreas.value.map((_, index) => (
                  <ActionButton
                    key={`actionButton-${index}`}
                    buttonType={`Group${index}`}
                    roundLeftCorner={index === 0}
                    roundRightCorner={index === groupTextAreas.value.length - 1}
                    handleClick={() => {
                      Emitter.emit("changeSelectionGroup", index);
                    }}
                  />
                ))}
            </div>
          </section>
        </aside>
      </article>
    );
  },
});
