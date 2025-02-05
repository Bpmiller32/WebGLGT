import Emitter from "../webgl/utils/eventEmitter";
import { defineComponent, PropType, ref } from "vue";
import Experience from "../webgl/experience";
import ApiHandler from "../apiHandler";
import ActionButton from "./subcomponents/ActionButton";
import MailTypeButton from "./subcomponents/MailTypeButton";
import GroupTextArea from "./subcomponents/GroupTextArea";
import UserButton from "./subcomponents/UserButton";
import FileModal from "./subcomponents/FileModal";
import {
  ArrowDownOnSquareStackIcon,
  ArrowLeftEndOnRectangleIcon,
  FolderOpenIcon,
  HashtagIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/vue/16/solid";
import * as THREE from "three";

// Define interfaces for be/db data structures. TODO: move this somewhere else
interface Coordinate {
  x: number;
  y: number;
}

interface BoundingBox {
  topleft: { x: number; y: number };
  width: number;
  height: number;
}

// Interface for mesh data coming from selectionGroupManager
interface SourceMeshData {
  id?: string;
  position: { x: number; y: number; z: number };
  size: { width: number; height: number };
  coordinates: Coordinate[];
}

// Interface for mesh data after processing
interface MeshData {
  position: {
    x: number;
    y: number;
    z: number;
  };
  size: {
    width: number;
    height: number;
  };
  coordinates: BoundingBox;
}

interface SelectionGroup {
  text: string;
  coordinates: BoundingBox;
  boxes: MeshData[];
  type: string;
}

interface SelectionGroups {
  group0: SelectionGroup;
  group1: SelectionGroup;
  group2: SelectionGroup;
}

// Interface for selectionGroupManager data
interface SelectionGroupManagerData {
  selectionGroupPixelCoordinates0: THREE.Vector2[];
  selectionGroupPixelCoordinates1: THREE.Vector2[];
  selectionGroupPixelCoordinates2: THREE.Vector2[];
  selectionGroup0MeshData: SourceMeshData[];
  selectionGroup1MeshData: SourceMeshData[];
  selectionGroup2MeshData: SourceMeshData[];
}

// Helper function to calculate bounding box from coordinates
function calculateBoundingBox(coordinates: Coordinate[]): BoundingBox {
  if (!coordinates || coordinates.length === 0) {
    return {
      topleft: { x: 0, y: 0 },
      width: 0,
      height: 0,
    };
  }

  // Find min and max x,y values
  const xValues = coordinates.map((coord) => coord.x);
  const yValues = coordinates.map((coord) => coord.y);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);

  return {
    topleft: { x: minX, y: minY },
    width: maxX - minX,
    height: maxY - minY,
  };
}

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
    const showFileModal = ref<boolean>(false);
    const isLoading = ref<boolean>(true);

    // Group Text Areas
    const groupTextAreas = ref<
      { value: string; isActive: boolean; type: string }[]
    >([
      { value: "", isActive: false, type: "" },
      { value: "", isActive: false, type: "" },
      { value: "", isActive: false, type: "" },
    ]);

    // Default state for otherMailTags
    const otherMailTags = ref<{ type: string; active: boolean }[]>([]);

    // Icons for user buttons
    const userButtonConfig = {
      logout: <ArrowLeftEndOnRectangleIcon class="h-5 w-5" />,
      help: <QuestionMarkCircleIcon class="h-5 w-5" />,
      downloadJson: <ArrowDownOnSquareStackIcon class="h-5 w-5" />,
      gotoFile: <FolderOpenIcon class="h-5 w-5" />,
      grid: <HashtagIcon class="h-5 w-5" />,
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
            type: "",
          })
        );
      } else {
        // Default to 3 groups if no number or invalid number is provided
        groupTextAreas.value = [
          { value: "", isActive: false, type: "" },
          { value: "", isActive: false, type: "" },
          { value: "", isActive: false, type: "" },
        ];
      }
    });
    Emitter.on("fillInForm", async () => {
      await submitToDb();

      isLoading.value = true;
      await ApiHandler.handleNextImage(apiUrl, props.webglExperience);
      activateGroup(0);

      gtSavedCount.value++;
    });
    Emitter.on("loadedFromApi", () => {
      isLoading.value = false;
      activateGroup(0);
    });
    Emitter.on("gotoNextImage", async () => {
      isLoading.value = true;
      console.log("here, skipping sent");
      await ApiHandler.handleNextImage(apiUrl, props.webglExperience, true);
      activateGroup(0);
    });
    Emitter.on("gotoPrevImage", async () => {
      isLoading.value = true;
      await ApiHandler.handlePrevImage(apiUrl, props.webglExperience);
      activateGroup(0);
    });
    Emitter.on("changeSelectionGroup", (groupNumber) => {
      activateGroup(groupNumber);
    });
    Emitter.on("resetImage", () => {
      activateGroup(0);
    });
    Emitter.on("setGroupType", ({ groupId, type }) => {
      if (groupId >= 0 && groupId < groupTextAreas.value.length) {
        groupTextAreas.value[groupId].type = type;
      }
    });

    /* ---------------------------- Helper functions ---------------------------- */
    // Computed property to check if save should be enabled
    const canSave = () => {
      return groupTextAreas.value.some((group) =>
        ["MP", "HW", "Bad"].includes(group.type)
      );
    };

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
      // Extract selectionGroupManager from webglExperience.world with proper type assertion
      const selectionGroupManager = props.webglExperience.world
        .selectionGroupManager as unknown as SelectionGroupManagerData;

      // Initialize selectionGroups with default structure
      const defaultBoundingBox: BoundingBox = {
        topleft: { x: 0, y: 0 },
        width: 0,
        height: 0,
      };

      const selectionGroups: SelectionGroups = {
        group0: {
          text: "",
          coordinates: defaultBoundingBox,
          boxes: [],
          type: "",
        },
        group1: {
          text: "",
          coordinates: defaultBoundingBox,
          boxes: [],
          type: "",
        },
        group2: {
          text: "",
          coordinates: defaultBoundingBox,
          boxes: [],
          type: "",
        },
      };

      // Iterate over each group to populate selectionGroups
      groupTextAreas.value.forEach((group, index) => {
        // Construct keys dynamically for coordinates and mesh data
        const coordKey =
          `selectionGroupPixelCoordinates${index}` as keyof typeof selectionGroupManager;
        const meshDataKey =
          `selectionGroup${index}MeshData` as keyof typeof selectionGroupManager;

        // Extract and format pixel coordinates for the group
        const rawCoordinates = (selectionGroupManager[coordKey] ||
          []) as THREE.Vector2[];
        const coordinates = rawCoordinates.map((coord) => ({
          x: Math.round(coord.x),
          y: Math.round(coord.y),
        }));

        // Calculate bounding box for the group
        const groupBoundingBox = calculateBoundingBox(coordinates);

        // Extract mesh data and calculate bounding boxes for individual boxes
        const sourceMeshes = (selectionGroupManager[meshDataKey] ||
          []) as SourceMeshData[];
        const meshData: MeshData[] = sourceMeshes.map((sourceMesh) => {
          // Create new MeshData object with the calculated bounding box
          return {
            position: sourceMesh.position,
            size: sourceMesh.size,
            coordinates: calculateBoundingBox(
              sourceMesh.coordinates.map((coord) => ({
                x: Math.round(coord.x),
                y: Math.round(coord.y),
              }))
            ),
          };
        });

        // Assign extracted data to the corresponding group in selectionGroups
        selectionGroups[`group${index}` as keyof SelectionGroups] = {
          text: group.value || "", // Use provided text or default to an empty string
          coordinates: groupBoundingBox, // Store calculated bounding box
          boxes: meshData, // Store array of MeshData objects without the `id` field
          type: group.type || "", // Use provided type or default to an empty string
        };
      });

      // Prepare the update data to send in the API request
      const updateData = {
        status: "completed",
        rotation:
          props.webglExperience.world.imageContainer?.imageRotation || 0, // Get image rotation or default to 0
        timeOnImage:
          props.webglExperience.world.imageContainer?.stopwatch.elapsedTime ||
          0, // Get elapsed time or default to 0
        selectionGroups, // Include structured selection groups data
      };

      // Send the data update request
      await ApiHandler.updateImageData(apiUrl, updateData);
    };

    /* ----------------------------- Render function ---------------------------- */
    return () => (
      <article class="mt-5 ml-5">
        <FileModal
          show={showFileModal.value}
          onClose={() => {
            showFileModal.value = false;
          }}
          onAccept={async (filename) => {
            isLoading.value = true;
            await ApiHandler.handleImageByName(
              apiUrl,
              props.webglExperience,
              filename
            );
            activateGroup(0);
          }}
          webglExperience={props.webglExperience}
        />

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
                disabled={isLoading.value}
              />
              <ActionButton
                buttonType="Skip"
                roundLeftCorner={false}
                roundRightCorner={false}
                handleClick={() => Emitter.emit("gotoNextImage")}
                showText={true}
                disabled={isLoading.value}
              />
              <ActionButton
                buttonType="Save"
                roundLeftCorner={false}
                roundRightCorner={true}
                handleClick={() => Emitter.emit("fillInForm")}
                showText={true}
                disabled={!canSave()}
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
          <section class="flex justify-between items-center">
            <div class="flex gap-1">
              <UserButton
                icon={userButtonConfig.gotoFile}
                handleClick={() => {
                  showFileModal.value = true;
                }}
              />
              <UserButton
                icon={userButtonConfig.downloadJson}
                handleClick={async () => {
                  const projectName = localStorage.getItem("projectName");
                  if (projectName) {
                    await ApiHandler.exportToJson(apiUrl, projectName);
                  }
                }}
              />
              <UserButton
                icon={userButtonConfig.grid}
                handleClick={async () => {
                  Emitter.emit("toggleGrid");
                }}
              />
            </div>
            <div class="flex">
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
                  roundTopCorners={true}
                  roundBottomCorners={true}
                  handleClick={() => {
                    // Toggle the current button's active state
                    mailType.active = !mailType.active;
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
