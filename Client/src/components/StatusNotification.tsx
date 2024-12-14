import Emitter from "../webgl/utils/eventEmitter";
import { defineComponent, ref, Transition } from "vue";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from "@heroicons/vue/16/solid";
import StatusAlert from "./subcomponents/StatusAlert";

export default defineComponent({
  setup() {
    /* ------------------------ Component state and setup ----------------------- */
    const isAlertEnabled = ref(false);
    const statusAlertText = ref<string | undefined>();
    const statusAlertColor = ref<"green" | "yellow" | "red" | undefined>();

    const statusAlertConfig = {
      green: {
        container: "bg-green-50",
        text: "text-green-800",
        icon: <CheckCircleIcon class="h-5 w-5 text-green-400" />,
      },
      yellow: {
        container: "bg-yellow-50",
        text: "text-yellow-800",
        icon: <ArrowPathIcon class="h-5 w-5 text-yellow-400 animate-spin" />,
      },
      red: {
        container: "bg-red-50",
        text: "text-red-800",
        icon: <ExclamationCircleIcon class="h-5 w-5 text-red-400" />,
      },
    };

    /* ---------------------------- Lifecycle Events ---------------------------- */
    Emitter.on("indicateLoading", () => {
      updateAlert("Loading....", "yellow");
    });

    Emitter.on("fillInForm", () => {
      // Covers case where resubmitting, indicate to user with 2nd animation by disabling/enabling
      if (
        statusAlertText.value === "Successfully uploaded" &&
        statusAlertColor.value === "green" &&
        isAlertEnabled.value
      ) {
        toggleAlert();
        return;
      }
      updateAlert("Successfully uploaded", "green");
    });

    Emitter.on("gotoNextImage", () => {
      updateAlert("Loading next image....", "yellow");
    });

    Emitter.on("loadedFromApi", () => {
      isAlertEnabled.value = false;
    });

    Emitter.on("appError", () => {
      updateAlert("Error", "red");
    });

    /* ---------------------------- Helper Methods ---------------------------- */
    const updateAlert = (text: string, color: "green" | "yellow" | "red") => {
      statusAlertText.value = text;
      statusAlertColor.value = color;
      isAlertEnabled.value = true;
    };

    const toggleAlert = () => {
      isAlertEnabled.value = false;
      setTimeout(() => {
        isAlertEnabled.value = true;
      }, 100);
    };

    /* ----------------------------- Render function ---------------------------- */
    return () => (
      <Transition
        enterFromClass="opacity-0 -translate-y-full"
        enterToClass="opacity-100 translate-y-0"
        enterActiveClass="transition duration-[500ms]"
        leaveFromClass="opacity-100 translate-y-0"
        leaveToClass="opacity-0 -translate-y-full"
        leaveActiveClass="transition duration-[500ms]"
      >
        {isAlertEnabled.value && (
          <article class="mt-4 max-w-60">
            <StatusAlert
              statusAlertColor={statusAlertColor.value}
              statusAlertText={statusAlertText.value || ""}
              statusAlertConfig={statusAlertConfig}
            />
          </article>
        )}
      </Transition>
    );
  },
});
