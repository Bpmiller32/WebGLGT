import { AdjustmentsHorizontalIcon, XMarkIcon } from "@heroicons/vue/16/solid";
import { defineComponent, PropType, ref } from "vue";
import ProjectSelect from "./subcomponents/ProjectSelect";

export default defineComponent({
  props: {
    isOpen: {
      type: Boolean as PropType<boolean>,
      required: true,
    },
    setIsOpen: {
      type: Function as PropType<(value: boolean) => void>,
      required: true,
    },
    projectList: {
      type: Array as PropType<string[]>,
      required: true,
    },
  },
  setup(props) {
    const closeModal = () => props.setIsOpen(false);

    // Ref for the projectName input
    const projectName = ref<string>("");
    const isProjectCreateSuccess = ref<boolean>(false);
    const isProjectCreateError = ref<boolean>(false);

    // Ref for project select export
    const selectedProject = ref<string>("");
    const isProjectExportSuccess = ref<boolean>(false);
    const isProjectExportError = ref<boolean>(false);

    const resetProjectCreateValidation = () => {
      isProjectCreateSuccess.value = false;
      isProjectCreateError.value = false;
    };

    const resetProjectExportValidation = () => {
      isProjectExportSuccess.value = false;
      isProjectExportError.value = false;
    };

    const handleCreateClick = () => {
      if (!projectName.value.trim()) {
        // Show red border, reset green border
        isProjectCreateError.value = true;
        isProjectCreateSuccess.value = false;

        // Reset to default after delay
        setTimeout(() => {
          resetProjectCreateValidation();
        }, 3000);
        return;
      }
      // Reset red border, show green border
      isProjectCreateError.value = false;
      isProjectCreateSuccess.value = true;

      // Reset to default after delay
      setTimeout(() => {
        resetProjectCreateValidation();
      }, 3000);
    };

    const handleExportClick = () => {
      if (!projectName.value.trim()) {
        isProjectCreateError.value = true; // Show red border
        isProjectCreateSuccess.value = false; // Reset green border
        return;
      }
      isProjectCreateError.value = false; // Reset red border
      isProjectCreateSuccess.value = true; // Show green border

      resetProjectExportValidation();
    };

    return () => {
      if (!props.isOpen) return null;

      return (
        <div class="p-8 z-50 fixed inset-0 grid place-items-center bg-slate-900/20 backdrop-blur cursor-default">
          <div class="relative my-8 p-6 w-full max-w-lg rounded-lg bg-slate-100 text-left shadow-xl max-h-[calc(100vh-4rem)] overflow-y-auto">
            {/* Close button */}
            <div class="absolute right-0 top-0 pr-4 pt-4">
              <button class="rounded-md bg-slate-100 text-gray-400 hover:text-gray-500">
                <XMarkIcon
                  class="size-6"
                  aria-hidden="true"
                  onClick={closeModal}
                />
              </button>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-start">
              {/* Icon */}
              <div class="mx-auto mb-4 sm:mb-0 flex size-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 sm:mx-0 sm:size-10">
                <AdjustmentsHorizontalIcon
                  class="size-6 text-indigo-600"
                  aria-hidden="true"
                />
              </div>

              <div class="text-center sm:ml-4 sm:text-left">
                {/* Heading */}
                <div class="text-base font-semibold text-gray-900">
                  Admin Panel
                </div>

                {/* Admin action 1 */}
                <p class="mt-2 text-base text-gray-900">Create new project</p>
                <p class="mt-2 text-sm text-gray-500">
                  Ensure that the project name matches the folder name where the
                  images are stored. Additionally, the folder containing the
                  images must be located in the directory specified by the
                  IMAGES_PATH environment variable on the server.
                </p>
                <div class="mt-4 gap-4 flex justify-between">
                  <input
                    type="email"
                    class={[
                      "w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 sm:text-sm/6",
                      isProjectCreateError.value
                        ? "outline-red-500"
                        : isProjectCreateSuccess.value
                        ? "outline-green-500"
                        : "outline-gray-300",
                    ]}
                    placeholder="name of GT project"
                    v-model={projectName.value}
                  />
                  <button
                    onClick={handleCreateClick}
                    class="inline-flex w-auto justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                  >
                    Create
                  </button>
                </div>

                {/* Admin action 2 */}
                <p class="mt-2 text-base text-gray-900">
                  Export results to csv
                </p>
                <p class="mt-2 text-sm text-gray-500">
                  This will export all the data for a specific project to a CSV
                  file, saved in the directory specified by the IMAGES_PATH
                  environment variable on the server.
                </p>
                <div class="mt-4 gap-4 flex justify-between">
                  <div
                    class={[
                      "w-full",
                      isProjectExportError.value
                        ? "outline outline-2 outline-red-500"
                        : isProjectExportSuccess.value
                        ? "outline outline-2 outline-green-500"
                        : "",
                    ]}
                  >
                    <ProjectSelect
                      projectList={props.projectList}
                      setSelectedProjectName={(newSelectedProject: string) =>
                        (selectedProject.value = newSelectedProject)
                      }
                    />
                  </div>
                  <button
                    onClick={handleExportClick}
                    class="inline-flex w-auto justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                  >
                    Export
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    };
  },
});
