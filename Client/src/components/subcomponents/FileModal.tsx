import { defineComponent, PropType, ref, watch } from "vue";
import Experience from "../../webgl/experience";
import Emitter from "../../webgl/utils/eventEmitter";
import ApiHandler from "../../apiHandler";

export default defineComponent({
  name: "FileModal",
  props: {
    show: {
      type: Boolean,
      required: true,
    },
    onClose: {
      type: Function as PropType<() => void>,
      required: true,
    },
    onAccept: {
      type: Function as PropType<(filename: string) => Promise<void>>,
      required: true,
    },
    webglExperience: {
      type: Object as PropType<Experience>,
      required: true,
    },
  },
  setup(props) {
    const apiUrl = import.meta.env.VITE_NGROK_URL;
    const filename = ref<string>("");
    const projectImages = ref<{ name: string; status: string }[]>([]);
    const searchQuery = ref<string>("");
    const isLoadingImages = ref<boolean>(false);

    // Load project images when modal is shown
    watch(
      () => props.show,
      async (newValue: boolean) => {
        if (newValue) {
          const projectName = localStorage.getItem("projectName");
          if (projectName) {
            isLoadingImages.value = true;
            try {
              const images = await ApiHandler.getProjectImages(
                apiUrl,
                projectName
              );
              projectImages.value = images;
            } catch (error) {
              console.error("Error loading project images:", error);
            } finally {
              isLoadingImages.value = false;
            }
          }
        }
      }
    );

    // Computed property for filtered images
    const filteredImages = () => {
      const query = searchQuery.value.toLowerCase();
      return projectImages.value.filter((img) =>
        img.name.toLowerCase().includes(query)
      );
    };

    // Get status color class
    const getStatusColor = (status: string) => {
      switch (status.toLowerCase()) {
        case "completed":
          return "bg-green-100 text-green-800";
        case "inprogress":
          return "bg-yellow-100 text-yellow-800";
        case "unclaimed":
          return "bg-gray-100 text-gray-800";
        default:
          return "bg-gray-100 text-gray-800";
      }
    };

    // Handle image selection
    const handleImageSelect = async (imageName: string) => {
      try {
        props.onClose(); // Close modal first
        Emitter.emit("appLoading", "Loading image...");
        await ApiHandler.handleImageByName(
          apiUrl,
          props.webglExperience,
          imageName
        );
        Emitter.emit("changeSelectionGroup", 0);
      } catch {
        Emitter.emit(
          "appError",
          "Could not load image. Please check the image name and try again."
        );
      }
    };

    // Handle manual filename submission
    const handleAccept = async () => {
      const trimmedFilename = filename.value.trim();
      props.onClose(); // Close modal first
      filename.value = ""; // Reset input

      if (trimmedFilename) {
        try {
          Emitter.emit("appLoading", "Loading image...");
          await props.onAccept(trimmedFilename);
        } catch {
          Emitter.emit(
            "appError",
            "Could not load image. Please check the image name and try again."
          );
        }
      }
    };

    return () =>
      props.show ? (
        <div class="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur">
          <div class="flex min-h-full items-center justify-center p-4">
            <div class="relative w-full max-w-lg bg-slate-100 rounded-lg shadow-xl modal-content">
              <div class="p-6">
                {/* Search input */}
                <div class="mb-4">
                  <input
                    type="text"
                    class="w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300"
                    v-model={searchQuery.value}
                    placeholder="Search images..."
                  />
                </div>

                {/* Image list */}
                <div class="mb-4 max-h-[17rem] overflow-y-auto border border-gray-200 rounded-md allow-scroll">
                  {isLoadingImages.value ? (
                    <div class="flex justify-center items-center h-full">
                      <p class="text-gray-500">Loading images...</p>
                    </div>
                  ) : projectImages.value.length === 0 ? (
                    <div class="flex justify-center items-center h-full">
                      <p class="text-gray-500">No images found</p>
                    </div>
                  ) : (
                    <div class="space-y-1 p-2">
                      {filteredImages().map((image) => (
                        <div
                          key={image.name}
                          onClick={() => handleImageSelect(image.name)}
                          class="flex items-center justify-between p-2 rounded-md hover:bg-slate-200 cursor-pointer"
                        >
                          <span class="text-sm text-gray-900">
                            {image.name}
                          </span>
                          <span
                            class={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                              image.status
                            )}`}
                          >
                            {image.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div class="relative my-4">
                  <div class="absolute inset-0 flex items-center">
                    <div class="w-full border-t border-gray-300"></div>
                  </div>
                  <div class="relative flex justify-center text-sm">
                    <span class="bg-slate-100 px-2 text-gray-500">or</span>
                  </div>
                </div>

                {/* Manual filename input */}
                <div class="mb-4">
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Enter image filename
                  </label>
                  <input
                    type="text"
                    class="w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300"
                    v-model={filename.value}
                    placeholder="filename.tif"
                  />
                </div>

                {/* Action buttons */}
                <div class="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      props.onClose();
                      filename.value = "";
                    }}
                    class="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAccept}
                    class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                  >
                    Accept
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null;
  },
});
