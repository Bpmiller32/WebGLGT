import ApiHandler from "../apiHandler";
import { defineComponent, onMounted, PropType, ref, Transition } from "vue";
import AppLogo from "./subcomponents/AppLogo";
import ServerStatusBadge from "./subcomponents/ServerStatusBadge";
import UserPassInputs from "./subcomponents/UserPassInputs";
import DebugButton from "./subcomponents/DebugButton";
import StartAppButton from "./subcomponents/StartAppButton";
import LoginErrorLabel from "./subcomponents/LoginErrorLabel";
import ProjectSelect from "./subcomponents/ProjectSelect";
import { logTrackedEvent } from "../firebase/logTrackedEvent";
import AdminPanel from "./AdminPanel";

export default defineComponent({
  props: {
    sessionId: {
      type: String as PropType<string>,
      required: true,
    },
    handleStartApp: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    /* ------------------------ Component state and setup ----------------------- */
    // Env variables
    const apiUrl = import.meta.env.VITE_NGROK_URL;

    // Template ref
    const username = ref<string>("");
    const password = ref<string>("");

    const projectList = ref<string[]>([]);
    const selectedProject = ref<string>("");

    const isAdminOpen = ref<boolean>(false);

    const appLogoClickCount = ref<number>(0);
    const isServerOnline = ref<boolean>(false);

    const isStartButtonEnabled = ref<boolean>(true);
    const isDebugButtonEnabled = ref<boolean>(true);

    const didLoginFail = ref<boolean>(false);
    const loginFailAnimationToggle = ref<boolean>(false);

    onMounted(async () => {
      isServerOnline.value = await ApiHandler.pingServer(apiUrl);
      projectList.value = await ApiHandler.getProjects(apiUrl);
      isDebugButtonEnabled.value = window.location.hash === "#debug";

      if (projectList.value.length < 1) {
        isStartButtonEnabled.value = false;
      }
    });

    /* ---------------------------- Template handlers --------------------------- */
    const handleAppLogoClicked = () => {
      if (appLogoClickCount.value >= 4) {
        isDebugButtonEnabled.value = true;
        return;
      }

      appLogoClickCount.value++;
    };

    const handleStartAppButtonClicked = async () => {
      await logTrackedEvent(props.sessionId, "clicked start button");

      const isAuthenticated = await ApiHandler.login(
        apiUrl,
        username.value,
        password.value,
        true,
        selectedProject.value,
        selectedProject.value
      );

      if (isAuthenticated) {
        props.handleStartApp();
      } else {
        await handleLoginError();
      }
    };

    const handleAdminButtonClicked = async () => {
      const isAdmin = await ApiHandler.login(
        apiUrl,
        username.value,
        password.value,
        false
      );

      if (isAdmin) {
        didLoginFail.value = false;
        isAdminOpen.value = true;
      } else {
        await handleLoginError();
      }
    };

    const handleLoginError = async () => {
      await logTrackedEvent(props.sessionId, "failed login");

      didLoginFail.value = true;
      loginFailAnimationToggle.value = !loginFailAnimationToggle.value;
    };

    /* ----------------------------- Render Function ---------------------------- */
    return () => (
      <article class="w-screen h-screen flex justify-center items-center">
        {/* Test */}
        <AdminPanel
          isOpen={isAdminOpen.value}
          setIsOpen={(value: boolean) => (isAdminOpen.value = value)}
          projectList={projectList.value}
        />

        <section>
          <Transition
            appear={true}
            css={true}
            enterFromClass="opacity-0 translate-y-4"
            enterToClass="opacity-100 translate-y-0"
            enterActiveClass="transform-gpu transition-all duration-[500ms] ease-out"
          >
            <div class="transform-gpu">
              {/* App logo */}
              <div onClick={handleAppLogoClicked}>
                <AppLogo />
              </div>

              {/* Server status */}

              <div class="flex justify-end">
                <ServerStatusBadge isServerOnline={isServerOnline.value} />
              </div>

              {/* Username and password inputs */}
              <UserPassInputs
                setUsername={(newUsername: string) =>
                  (username.value = newUsername)
                }
                setPassword={(newPassword: string) =>
                  (password.value = newPassword)
                }
              />

              {/* Buttons and login feedback */}
              <div class="grid grid-cols-3 justify-between items-center mt-2">
                <DebugButton
                  isButtonEnabled={true}
                  handleButtonClicked={handleAdminButtonClicked}
                />
                <StartAppButton
                  isButtonEnabled={isStartButtonEnabled.value}
                  isServerOnline={isServerOnline.value}
                  handleButtonClicked={handleStartAppButtonClicked}
                />
                <LoginErrorLabel
                  didLoginFail={didLoginFail.value}
                  loginFailAnimationToggle={loginFailAnimationToggle.value}
                />
              </div>
            </div>
          </Transition>

          {/* Project selection - container with fixed height */}
          <div class="relative h-32">
            <Transition
              appear={true}
              css={true}
              enterFromClass="opacity-0 translate-y-4"
              enterToClass="opacity-100 translate-y-0"
              enterActiveClass="transform-gpu transition-all duration-[500ms] ease-out"
            >
              {projectList.value.length !== 0 ? (
                <div class="delay-[250ms] absolute top-0 left-0 right-0 transform-gpu">
                  <label class="mt-8 mb-2 block text-sm/6 font-medium text-gray-100">
                    Project Selection
                  </label>
                  <ProjectSelect
                    projectList={projectList.value}
                    setSelectedProjectName={(newSelectedProjectName: string) =>
                      (selectedProject.value = newSelectedProjectName)
                    }
                  />
                </div>
              ) : null}
            </Transition>
          </div>
        </section>
      </article>
    );
  },
});
