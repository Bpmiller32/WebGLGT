import Emitter from "../webgl/utils/eventEmitter";
import ApiHandler from "../apiHandler";
import { defineComponent, onMounted, PropType, ref } from "vue";
import AppLogo from "./subcomponents/AppLogo";
import ServerStatusBadge from "./subcomponents/ServerStatusBadge";
import UserPassInputs from "./subcomponents/UserPassInputs";
import DebugButton from "./subcomponents/DebugButton";
import StartAppButton from "./subcomponents/StartAppButton";
import LoginErrorLabel from "./subcomponents/LoginErrorLabel";

export default defineComponent({
  props: {
    apiUrl: {
      type: String as PropType<string>,
      required: true,
    },
  },
  setup(props) {
    /* ------------------------ Component state and setup ----------------------- */
    // Template ref
    const loginErrorLabelRef = ref<HTMLElement | null>(null);

    const username = ref("");
    const password = ref("");

    const isServerOnline = ref(false);
    const isButtonEnabled = ref(true);
    const isDebugEnabled = ref(false);
    const didLoginFail = ref(false);

    onMounted(async () => {
      try {
        isServerOnline.value = await ApiHandler.pingServer(props.apiUrl);
        isDebugEnabled.value = window.location.hash === "#debug";
      } catch (error) {
        console.error("Error during server ping:", error);
      }
    });

    /* ----------------------------- Template events ---------------------------- */
    const handleStartAppClicked = async () => {
      // TODO: remove after debug
      // Retrieve the token from localStorage
      const token = localStorage.getItem("jwtToken");
      if (!token) {
        throw new Error("No token found. Please log in.");
      }

      // Emitter.emit("startApp");
      // return;

      const isAuthenticated = await ApiHandler.login(
        props.apiUrl,
        username.value,
        password.value
      );

      if (isAuthenticated) {
        Emitter.emit("startApp");
      } else {
        handleLoginError();
      }
    };

    const handleDebugButtonClicked = () => {
      console.log("debug button clicked");
    };

    const handleLoginError = () => {
      didLoginFail.value = true;

      if (loginErrorLabelRef.value) {
        loginErrorLabelRef.value.classList.remove("animate-shake");
        setTimeout(() => {
          loginErrorLabelRef.value?.classList.add("animate-shake");
        }, 100);
      }
    };

    /* ----------------------------- Render Function ---------------------------- */
    return () => (
      <article class="w-screen h-screen flex justify-center items-center">
        <section>
          {/* App logo */}
          <AppLogo />

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
          <div class="grid grid-cols-3 justify-between mt-2">
            <DebugButton
              isDebugEnabled={isDebugEnabled.value}
              handleDebugButtonClicked={handleDebugButtonClicked}
            />
            <StartAppButton
              isButtonEnabled={isButtonEnabled.value}
              isServerOnline={isServerOnline.value}
              handleStartAppClicked={handleStartAppClicked}
            />
            <LoginErrorLabel didLoginFail={didLoginFail.value} />
          </div>
        </section>
      </article>
    );
  },
});
