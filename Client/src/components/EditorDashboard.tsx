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
import * as THREE from "three";

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
      await loadImage("next");
      activateGroup(0);
    });
    Emitter.on("gotoPrevImage", async () => {
      await loadImage("prev");
      activateGroup(0);
    });
    Emitter.on("changeSelectionGroup", (groupNumber) => {
      activateGroup(groupNumber);
    });
    Emitter.on("resetImage", () => {
      activateGroup(0);
    });
    Emitter.on("fastImageClassify", async (value: "mp" | "hw" | "bad") => {
      toggleClassificationTag(value.toLowerCase());
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

    const toggleClassificationTag = (tag: string) => {
      textClassificationTags.value.forEach((mailType) => {
        mailType.active = mailType.type.toLowerCase() === tag.toLowerCase();
      });
    };

    const loadImage = async (direction: "next" | "prev") => {
      let prevImage = null;

      if (direction === "next") {
        await ApiHandler.handleNextImage(apiUrl, props.webglExperience);
      } else {
        prevImage =
          (await ApiHandler.handlePrevImage(apiUrl, props.webglExperience)) ||
          null;
      }

      // Update classification tags based on direction and image type
      textClassificationTags.value.forEach((tag) => {
        tag.active =
          direction === "prev"
            ? tag.type.toLowerCase() === prevImage?.imageType?.toLowerCase()
            : tag.type === "MP";
      });
    };

    const submitToDb = async () => {
      // Determine the active mail type
      const activeMailType = textClassificationTags.value.find(
        (mailType) => mailType.active
      );
      const imageType = activeMailType ? activeMailType.type.toLowerCase() : "";

      // Define interfaces for our data structures
      interface Coordinate {
        x: number;
        y: number;
      }

      interface SelectionGroup {
        text: string;
        coordinates: Coordinate[] | string;
        meshes: { [key: string]: unknown };
        type: string;
      }

      interface SelectionGroups {
        group0: SelectionGroup;
        group1: SelectionGroup;
        group2: SelectionGroup;
      }

      // Type assertion for selectionGroupManager
      const selectionGroupManager = props.webglExperience.world
        .selectionGroupManager as {
        selectionGroupPixelCoordinates0: THREE.Vector2[];
        selectionGroupPixelCoordinates1: THREE.Vector2[];
        selectionGroupPixelCoordinates2: THREE.Vector2[];
      };

      // Prepare selection groups data
      const selectionGroups: SelectionGroups = {
        group0: { text: "", coordinates: "", meshes: {}, type: "" },
        group1: { text: "", coordinates: "", meshes: {}, type: "" },
        group2: { text: "", coordinates: "", meshes: {}, type: "" },
      };

      // Fill in the data for each group
      groupTextAreas.value.forEach((group, index) => {
        const key =
          `selectionGroupPixelCoordinates${index}` as keyof typeof selectionGroupManager;
        const rawCoordinates = selectionGroupManager[key] || [];

        const coordinates = rawCoordinates.map((coord) => ({
          x: parseFloat(coord.x.toFixed(4)),
          y: parseFloat(coord.y.toFixed(4)),
        }));

        selectionGroups[`group${index}` as keyof SelectionGroups] = {
          text: group.value || "",
          coordinates: coordinates.length > 0 ? coordinates : "",
          meshes: {},
          type: "",
        };
      });

      // Prepare update data for request body
      const updateData = {
        imageType: imageType,
        status: "completed",
        rotation:
          props.webglExperience.world.imageContainer?.imageRotation || 0,
        timeOnImage:
          props.webglExperience.world.imageContainer?.stopwatch.elapsedTime ||
          0,
        selectionGroups,
      };

      // Send the update request
      await ApiHandler.updateImageData(apiUrl, updateData);
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
                GT save count:
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
                  // Set a timestamp to trigger the event, used for logging out of other tabs
                  localStorage.setItem("loggedOut", Date.now().toString());
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
                buttonType="Save"
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
                id={index}
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
