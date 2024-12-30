import { defineComponent, ref, onMounted, PropType } from "vue";

export default defineComponent({
  props: {
    projectList: {
      type: Array as PropType<string[]>,
      required: true,
    },
    setSelectedProjectName: {
      type: Function as PropType<(newProjectName: string) => string>,
      required: true,
    },
  },
  setup(props) {
    const projects = ref<string[]>(props.projectList);
    const selectedProject = ref<string>("");

    const handleProjectChange = (event: Event) => {
      const target = event.target as HTMLSelectElement;
      selectedProject.value = target.value;
      props.setSelectedProjectName(target.value);

      // Note: projectName and directoryPath must be the same, directoryPath folder must exist in IMAGES_PATH env variable in Server
      localStorage.setItem("projectName", target.value);
      localStorage.setItem("directoryPath", target.value);
    };

    onMounted(async () => {
      // Shouldn't be here
      if (projects.value.length < 1) {
        return;
      }

      // Assuming there are projects, select the first one by default
      selectedProject.value = projects.value[0];
      props.setSelectedProjectName(projects.value[0]);

      // Note: projectName and directoryPath must be the same, directoryPath folder must exist in IMAGES_PATH env variable in Server
      localStorage.setItem("projectName", projects.value[0]);
      localStorage.setItem("directoryPath", projects.value[0]);
    });

    return () => (
      <div>
        <select
          value={selectedProject.value}
          onChange={handleProjectChange}
          class="w-full cursor-pointer col-start-1 row-start-1 appearance-none rounded-md py-1.5 pl-3 pr-8 text-base outline outline-1 -outline-offset-1 bg-white text-gray-900 outline-gray-300 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
        >
          {projects.value.map((project) => (
            <option key={project} value={project}>
              {project}
            </option>
          ))}
        </select>
      </div>
    );
  },
});
