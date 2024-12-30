import { AdjustmentsHorizontalIcon, XMarkIcon } from "@heroicons/vue/16/solid";
import { defineComponent, PropType, ref } from "vue";
import ProjectSelect from "./subcomponents/ProjectSelect";
import ApiHander from "../apiHandler";

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
    // Env variables
    const apiUrl = import.meta.env.VITE_NGROK_URL;

    const closeModal = () => props.setIsOpen(false);

    // Form states
    const projectName = ref<string>("");
    const selectedProject = ref<string>("");

    const createState = ref({ pending: false, success: false, error: false });
    const exportState = ref({ pending: false, success: false, error: false });

    /* ---------------------------- Helper Functions ---------------------------- */
    const resetStateWithDelay = (state: typeof createState) => {
      setTimeout(() => {
        state.value.pending = false;
        state.value.success = false;
        state.value.error = false;
      }, 3000);
    };

    const setState = (
      state: typeof createState,
      type: "pending" | "success" | "error"
    ) => {
      state.value.pending = type === "pending";
      state.value.success = type === "success";
      state.value.error = type === "error";
    };

    /* ----------------------------- Button Handlers ---------------------------- */
    const handleCreateClick = async () => {
      setState(createState, "pending");

      try {
        if (!projectName.value.trim()) {
          throw new Error("Project name is required.");
        }

        const creationSuccess = await ApiHander.createImageDatabase(
          apiUrl,
          projectName.value
        );

        if (!creationSuccess) {
          throw new Error("Project creation failed.");
        }

        setState(createState, "success");
      } catch {
        setState(createState, "error");
      } finally {
        resetStateWithDelay(createState);
      }
    };

    const handleExportClick = async () => {
      setState(exportState, "pending");

      try {
        if (!selectedProject.value.trim()) {
          throw new Error("Project selection is required.");
        }

        const exportSuccess = await ApiHander.exportToCsv(
          apiUrl,
          selectedProject.value
        );

        if (!exportSuccess) {
          throw new Error("Export failed.");
        }

        setState(exportState, "success");
      } catch {
        setState(exportState, "error");
      } finally {
        resetStateWithDelay(exportState);
      }
    };

    const handleStatsClick = async () => {
      try {
        if (!selectedProject.value.trim()) {
          throw new Error("Project selection is required.");
        }

        const stats = await ApiHander.getProjectStats(
          apiUrl,
          selectedProject.value
        );

        if (!stats) {
          throw new Error("Error retrieving project stats.");
        }

        // Process userCounts
        const userCountsFormatted = Object.entries(stats.userCounts)
          .map(([user, count]) => `${user}: ${count}`)
          .join("\n");

        alert(
          `
          Project: ${selectedProject.value}
          
          Completed: ${stats.completedDocuments}
          Total: ${stats.totalDocuments}
          ${((stats.completedDocuments / stats.totalDocuments) * 100).toFixed(
            2
          )}%
          
          User counts
          ${userCountsFormatted}
          `
        );
      } catch {
        alert("Error retrieving stats.");
      }
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

            {/* Main body */}
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
                  Ensure that the project name matches the folder name of where
                  the images are stored. You can rerun an existing project to
                  update it with any new images added. Additionally,{" "}
                  <span class="text-yellow-600">
                    wait 5+ minutes after first creation before logging in.
                  </span>{" "}
                  The database entries will be created quickly but building the
                  indicies may take some time.
                </p>
                <div class="mt-4 gap-4 flex justify-between">
                  <input
                    type="text"
                    class={[
                      "w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 sm:text-sm/6",
                      createState.value.pending
                        ? "outline-yellow-500"
                        : createState.value.error
                        ? "outline-red-500"
                        : createState.value.success
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
                  Get quick project stats
                </p>
                <p class="mt-2 text-sm text-gray-500">
                  Retrieve the total number of images and the count of completed
                  ones for a specific project.
                </p>
                <div class="mt-4 gap-4 flex justify-between">
                  <div class="w-full">
                    <ProjectSelect
                      projectList={props.projectList}
                      setSelectedProjectName={(newSelectedProject: string) =>
                        (selectedProject.value = newSelectedProject)
                      }
                    />
                  </div>
                  <button
                    onClick={handleStatsClick}
                    class="inline-flex w-auto justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                  >
                    Export
                  </button>
                </div>

                {/* Admin action 3 */}
                <p class="mt-2 text-base text-gray-900">
                  Export full results to csv
                </p>
                <p class="mt-2 text-sm text-gray-500">
                  This will export all data for a specific project to a CSV
                  file, stored in the directory defined by the IMAGES_PATH
                  environment variable on the server. Note that any existing
                  export will be overwritten.
                </p>
                <div class="mt-4 gap-4 flex justify-between">
                  <div
                    class={[
                      "w-full",
                      exportState.value.pending
                        ? "rounded-md ring-1 ring-offset-[0.5px] ring-yellow-500"
                        : exportState.value.error
                        ? "rounded-md ring-1 ring-offset-[0.5px] ring-red-500"
                        : exportState.value.success
                        ? "rounded-md ring-1 ring-offset-[0.5px] ring-green-500"
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
