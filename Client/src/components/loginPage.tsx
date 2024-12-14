import Emitter from "../webgl/utils/eventEmitter";
import { pingServer } from "../apiHandler";
import { defineComponent, onMounted, ref } from "vue";
import AppLogo from "./subcomponents/AppLogo";
import ServerStatusBadge from "./subcomponents/ServerStatusBadge";
import UserPassInputs from "./subcomponents/UserPassInputs";
import DebugButton from "./subcomponents/DebugButton";
import StartAppButton from "./subcomponents/StartAppButton";
import LoginErrorLabel from "./subcomponents/LoginErrorLabel";

export default defineComponent({
  props: {
    apiUrl: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    /* ------------------------ Component state and setup ----------------------- */
    const username = ref("");
    const password = ref("");
    const isServerOnline = ref(false);
    const isButtonEnabled = ref(true);
    const didLoginFail = ref(false);
    const isDebugEnabled = ref(false);
    const loginErrorLabelRef = ref<HTMLElement | null>(null);

    /* ----------------------------- Lifecycle Events ---------------------------- */
    onMounted(async () => {
      try {
        isServerOnline.value = await pingServer(props.apiUrl);
        isDebugEnabled.value = window.location.hash === "#debug";
      } catch (error) {
        console.error("Error during server ping:", error);
      }
    });

    /* ----------------------------- Template events ---------------------------- */
    const handleStartAppClicked = async () => {
      // TODO: add back after debug, enables Firebase logins again
      try {
        // const docSnap = await getDoc(doc(db, "logins", username.value));
        // if (docSnap.exists()) {
        //   const { password: storedPassword } = docSnap.data();
        //   if (password.value !== storedPassword)
        //     throw new Error("Invalid credentials");
        //   isButtonEnabled.value = false;
        //   Emitter.emit("startApp");
        // }
      } catch {
        handleLoginError();
      }

      // TODO: remove after debugging
      Emitter.emit("startApp");
      console.log("Debugging, login bypased");
    };

    const handleDebugButtonClicked = () => {
      console.log("debug button clicked");
    };

    const handleLoginError = () => {
      didLoginFail.value = true;
      console.error("Login failed: Incorrect username or password");

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
